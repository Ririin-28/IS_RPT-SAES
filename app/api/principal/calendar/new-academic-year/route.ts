import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";
import { resolveRequestIp, writeSecurityAuditLog } from "@/lib/server/security-audit";

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

const normalizeRoleToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isAllowedRole = (value: unknown): boolean => {
  const normalized = normalizeRoleToken(value);
  return normalized === "principal" || normalized.includes("admin");
};

const resolveColumnSet = async (connection: import("mysql2/promise").PoolConnection, tableName: string): Promise<Set<string>> => {
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
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const authorization = await runWithConnection(async (connection) => {
      const userColumns = await resolveColumnSet(connection, "users");
      if (!userColumns.size) {
        return { allowed: true, role: "principal_session" as string | null };
      }

      let rawRole: string | null = null;
      if (userColumns.has("role")) {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT role FROM users WHERE user_id = ? LIMIT 1",
          [session.userId],
        );
        rawRole = rows.length > 0 && rows[0]?.role != null ? String(rows[0].role) : null;
      } else if (userColumns.has("role_id")) {
        const roleColumns = await resolveColumnSet(connection, "role");
        if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
          const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT r.role_name
             FROM users u
             LEFT JOIN role r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1`,
            [session.userId],
          );
          rawRole = rows.length > 0 && rows[0]?.role_name != null ? String(rows[0].role_name) : null;
        }
      }

      return {
        allowed: rawRole ? isAllowedRole(rawRole) : true,
        role: rawRole ?? "principal_session",
      };
    });

    if (!authorization.allowed) {
      return NextResponse.json(
        { success: false, error: "Only Principal or Admin roles can start a new academic year." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as ResetPayload | null;
    const confirmText = typeof body?.confirmText === "string" ? body.confirmText.trim() : "";
    if (confirmText !== CONFIRM_TEXT) {
      return NextResponse.json(
        { success: false, error: `Type ${CONFIRM_TEXT} to continue.` },
        { status: 400 },
      );
    }

    const schoolYear = normalizeSchoolYear(body?.schoolYear);
    const ipAddress = resolveRequestIp(request);

    const result = await runWithConnection(async (connection) => {
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
          if (columns.has("archived_at")) {
            assignments.push("archived_at = NOW()");
          }
          if (columns.has("archived_by")) {
            assignments.push("archived_by = ?");
          }
          if (columns.has("updated_at")) {
            assignments.push("updated_at = NOW()");
          }

          const whereParts = ["COALESCE(is_archived, 0) = 0"];
          const params: Array<string | number> = [];

          if (columns.has("archived_by")) {
            params.push(session.userId);
          }

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

        await writeSecurityAuditLog(connection, {
          action: "principal_start_new_academic_year",
          userId: session.userId,
          ipAddress,
          details: {
            principalId: session.principalId,
            actorRole: authorization.role,
            schoolYear,
            confirmation: CONFIRM_TEXT,
            archivedCounts,
            skippedTables,
          },
        });

        await connection.commit();
        return { archivedCounts, skippedTables };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    return NextResponse.json({
      success: true,
      message: "Current remedial setup was archived. Calendar is ready for a new academic year.",
      archivedCounts: result.archivedCounts,
      skippedTables: result.skippedTables,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a new academic year.";
    console.error("Failed to start new academic year", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
