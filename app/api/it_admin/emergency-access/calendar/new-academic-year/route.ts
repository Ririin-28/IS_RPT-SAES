import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  canManagePrincipalCalendars,
  hasActiveEmergencyAccess,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

const CONFIRM_TEXT = "CONFIRM";

type ResetPayload = {
  confirmText?: string;
  schoolYear?: string | null;
};

type ArchiveTarget = {
  table: string;
  whereClause?: string;
};

const ARCHIVE_TARGETS: ArchiveTarget[] = [
  { table: "remedial_quarter", whereClause: "school_year = ?" },
  { table: "weekly_subject_schedule" },
  { table: "activities" },
  { table: "approved_remedial_schedule", whereClause: "school_year = ?" },
  { table: "remedial_materials" },
];

const normalizeSchoolYear = (value: unknown): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
};

const resolveColumnSet = async (
  connection: import("mysql2/promise").PoolConnection,
  tableName: string,
): Promise<Set<string>> => {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(rows.map((row) => String(row.Field)));
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR") {
      return new Set<string>();
    }
    throw error;
  }
};

export async function POST(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as ResetPayload | null;
  const confirmText = typeof body?.confirmText === "string" ? body.confirmText.trim() : "";
  if (confirmText !== CONFIRM_TEXT) {
    return NextResponse.json({ success: false, error: `Type ${CONFIRM_TEXT} to continue.` }, { status: 400 });
  }

  const schoolYear = normalizeSchoolYear(body?.schoolYear);
  const ipAddress = resolveRequestIp(request);

  try {
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalCalendars(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({ success: false, error: "Emergency Calendars access is not active." }, { status: 403 });
      }

      const active = await hasActiveEmergencyAccess(connection, auth.userId, "Calendars");
      if (!active.active || !active.session) {
        return NextResponse.json({ success: false, error: "Emergency Calendars access is not active." }, { status: 403 });
      }

      await connection.beginTransaction();
      try {
        const archivedCounts: Record<string, number> = {};
        const skippedTables: string[] = [];

        for (const target of ARCHIVE_TARGETS) {
          const columns = await resolveColumnSet(connection, target.table);
          if (!columns.size) {
            skippedTables.push(target.table);
            continue;
          }
          if (!columns.has("is_archived")) {
            throw new Error(`${target.table}.is_archived is required for safe academic year reset.`);
          }

          const assignments = ["is_archived = 1"];
          if (columns.has("archived_at")) assignments.push("archived_at = NOW()");
          if (columns.has("archived_by")) assignments.push("archived_by = ?");
          if (columns.has("updated_at")) assignments.push("updated_at = NOW()");

          const whereParts = ["COALESCE(is_archived, 0) = 0"];
          const params: Array<string | number> = [];
          if (columns.has("archived_by")) params.push(auth.userId);
          if (target.whereClause && schoolYear && columns.has("school_year")) {
            whereParts.push(target.whereClause);
            params.push(schoolYear);
          }

          const [updateResult] = await connection.query<ResultSetHeader>(
            `UPDATE \`${target.table}\`
             SET ${assignments.join(", ")}
             WHERE ${whereParts.join(" AND ")}`,
            params,
          );

          archivedCounts[target.table] = Number(updateResult.affectedRows ?? 0);
        }

        await writeEmergencyAuditLog(connection, {
          action: "EMERGENCY_CALENDAR_UPDATED",
          userId: auth.userId,
          emergencyAccessId: Number(active.session.emergency_access_id),
          targetModule: "Calendars",
          targetRecordId: schoolYear ?? "all",
          ipAddress,
          details: {
            performed_by_role: "IT Admin",
            performed_via: "Emergency Access",
            operation: "new_academic_year",
            schoolYear,
            archivedCounts,
            skippedTables,
          },
        });

        await connection.commit();
        return NextResponse.json({
          success: true,
          message: "Current remedial setup was archived. Calendar is ready for a new academic year.",
          archivedCounts,
          skippedTables,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a new academic year.";
    console.error("Failed to start new academic year", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
