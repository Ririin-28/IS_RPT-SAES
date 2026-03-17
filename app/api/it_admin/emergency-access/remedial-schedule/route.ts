import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import { canManagePrincipalCalendars, hasActiveEmergencyAccess, writeEmergencyAuditLog } from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

const TABLE = "remedial_quarter";

type QuarterName = "1st Quarter" | "2nd Quarter";

type QuarterRange = Record<QuarterName, { startMonth: number | null; endMonth: number | null }>;

const EMPTY_QUARTERS: QuarterRange = {
  "1st Quarter": { startMonth: null, endMonth: null },
  "2nd Quarter": { startMonth: null, endMonth: null },
};

function parseMonth(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 12) return null;
  return num;
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) return auth.response;

  const schoolYear = request.nextUrl.searchParams.get("school_year")?.trim() || "";

  try {
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalCalendars(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({ success: true, schedule: null, locked: true });
      }

      const columns = await getTableColumns(TABLE);
      const whereActive = columns.has("is_archived") ? " AND COALESCE(is_archived, 0) = 0" : "";
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT quarter_name, school_year, start_month, end_month
         FROM ${TABLE}
         WHERE school_year = ?${whereActive}`,
        [schoolYear],
      );

      if (!rows.length) {
        return NextResponse.json({ success: true, schedule: null, locked: false });
      }

      const quarters: QuarterRange = JSON.parse(JSON.stringify(EMPTY_QUARTERS));
      for (const row of rows) {
        const quarterName = String(row.quarter_name) as QuarterName;
        if (!(quarterName in quarters)) continue;
        quarters[quarterName] = {
          startMonth: parseMonth(row.start_month),
          endMonth: parseMonth(row.end_month),
        };
      }

      return NextResponse.json({
        success: true,
        locked: false,
        schedule: {
          schoolYear,
          quarters,
        },
      });
    });
  } catch (error) {
    console.error("Failed to load remedial schedule", error);
    return NextResponse.json({ success: false, error: "Unable to load remedial schedule." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    schoolYear?: unknown;
    quarters?: QuarterRange;
  } | null;

  const schoolYear = typeof payload?.schoolYear === "string" ? payload.schoolYear.trim() : "";
  const quarterValues = payload?.quarters ?? EMPTY_QUARTERS;
  const first = quarterValues["1st Quarter"] ?? { startMonth: null, endMonth: null };
  const second = quarterValues["2nd Quarter"] ?? { startMonth: null, endMonth: null };

  const firstStart = parseMonth(first.startMonth);
  const firstEnd = parseMonth(first.endMonth);
  const secondStart = parseMonth(second.startMonth);
  const secondEnd = parseMonth(second.endMonth);

  if (!schoolYear || !firstStart || !firstEnd || !secondStart || !secondEnd) {
    return NextResponse.json({ success: false, error: "Incomplete remedial period values." }, { status: 400 });
  }

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
        const [firstRows] = await connection.query<RowDataPacket[]>(
          `SELECT quarter_id FROM ${TABLE} WHERE school_year = ? AND quarter_name = '1st Quarter' LIMIT 1`,
          [schoolYear],
        );
        if (firstRows[0]?.quarter_id) {
          await connection.execute<ResultSetHeader>(
            `UPDATE ${TABLE} SET start_month = ?, end_month = ? WHERE quarter_id = ? LIMIT 1`,
            [firstStart, firstEnd, firstRows[0].quarter_id],
          );
        } else {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO ${TABLE} (school_year, quarter_name, start_month, end_month, created_by, created_at)
             VALUES (?, '1st Quarter', ?, ?, ?, NOW())`,
            [schoolYear, firstStart, firstEnd, auth.userId],
          );
        }

        const [secondRows] = await connection.query<RowDataPacket[]>(
          `SELECT quarter_id FROM ${TABLE} WHERE school_year = ? AND quarter_name = '2nd Quarter' LIMIT 1`,
          [schoolYear],
        );
        if (secondRows[0]?.quarter_id) {
          await connection.execute<ResultSetHeader>(
            `UPDATE ${TABLE} SET start_month = ?, end_month = ? WHERE quarter_id = ? LIMIT 1`,
            [secondStart, secondEnd, secondRows[0].quarter_id],
          );
        } else {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO ${TABLE} (school_year, quarter_name, start_month, end_month, created_by, created_at)
             VALUES (?, '2nd Quarter', ?, ?, ?, NOW())`,
            [schoolYear, secondStart, secondEnd, auth.userId],
          );
        }

        await writeEmergencyAuditLog(connection, {
          action: "EMERGENCY_REMEDIAL_QUARTER_UPDATED",
          userId: auth.userId,
          emergencyAccessId: Number(active.session.emergency_access_id),
          targetModule: "Calendars",
          targetRecordId: schoolYear,
          ipAddress,
          details: {
            performed_by_role: "IT Admin",
            performed_via: "Emergency Access",
            target_table: TABLE,
            school_year: schoolYear,
            new_value: quarterValues,
          },
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }

      return NextResponse.json({
        success: true,
        schedule: {
          schoolYear,
          quarters: {
            "1st Quarter": { startMonth: firstStart, endMonth: firstEnd },
            "2nd Quarter": { startMonth: secondStart, endMonth: secondEnd },
          },
        },
      });
    });
  } catch (error) {
    console.error("Failed to save remedial schedule", error);
    return NextResponse.json({ success: false, error: "Unable to save remedial schedule." }, { status: 500 });
  }
}
