import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getTableColumns, runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import { canManagePrincipalCalendars, hasActiveEmergencyAccess } from "@/lib/server/emergency-access";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const REMEDIAL_WEEK_TABLE = "remedial_week";
const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const SUBJECTS_TABLE_CANDIDATES = ["subjects", "subject"] as const;

const VALID_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

async function fetchSubjectLookup(connection: PoolConnection): Promise<Map<number, string>> {
  for (const table of SUBJECTS_TABLE_CANDIDATES) {
    const cols = await getTableColumns(table).catch(() => new Set<string>());
    const idCol = cols.has("subject_id") ? "subject_id" : cols.has("id") ? "id" : null;
    const nameCol = cols.has("name") ? "name" : cols.has("subject_name") ? "subject_name" : null;
    if (!idCol || !nameCol) continue;

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${idCol}\` AS subject_id, \`${nameCol}\` AS subject_name FROM \`${table}\``,
    );
    const map = new Map<number, string>();
    for (const row of rows) {
      const id = Number(row.subject_id);
      const name = typeof row.subject_name === "string" ? row.subject_name.trim() : "";
      if (id && name) {
        map.set(id, name);
      }
    }
    return map;
  }
  return new Map<number, string>();
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

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

      const quarterCols = await getTableColumns(REMEDIAL_QUARTER_TABLE);
      const quarterWhere = quarterCols.has("is_archived") ? "WHERE COALESCE(is_archived, 0) = 0" : "";
      const [quarters] = await connection.query<RowDataPacket[]>(
        `SELECT quarter_id, school_year, quarter_name, start_month, end_month
         FROM ${REMEDIAL_QUARTER_TABLE}
         ${quarterWhere}
         ORDER BY school_year DESC, quarter_id ASC`,
      );

      const weekCols = await getTableColumns(REMEDIAL_WEEK_TABLE).catch(() => new Set<string>());
      const weekWhere = weekCols.has("is_archived") ? "WHERE COALESCE(is_archived, 0) = 0" : "";
      const [weeks] = await connection.query<RowDataPacket[]>(
        `SELECT week_id, quarter_id, week_number, week_start_date, week_end_date
         FROM ${REMEDIAL_WEEK_TABLE}
         ${weekWhere}
         ORDER BY quarter_id ASC, week_number ASC`,
      );

      const scheduleCols = await getTableColumns(WEEKLY_SUBJECT_TABLE).catch(() => new Set<string>());
      const scheduleWhere = scheduleCols.has("is_archived") ? "WHERE COALESCE(is_archived, 0) = 0" : "";
      const [scheduleRows] = await connection.query<RowDataPacket[]>(
        `SELECT day_of_week, subject_id, start_time, end_time
         FROM ${WEEKLY_SUBJECT_TABLE}
         ${scheduleWhere}
         ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')`,
      );

      const subjectLookup = await fetchSubjectLookup(connection);
      const weeklySchedule: Record<string, string> = Object.fromEntries(VALID_WEEKDAYS.map((day) => [day, ""]));
      let startTime = "";
      let endTime = "";
      for (const row of scheduleRows) {
        const day = typeof row.day_of_week === "string" ? row.day_of_week : "";
        if (!VALID_WEEKDAYS.includes(day as (typeof VALID_WEEKDAYS)[number])) {
          continue;
        }
        const subjectId = Number(row.subject_id);
        weeklySchedule[day] = subjectLookup.get(subjectId) ?? String(subjectId);
        if (!startTime && row.start_time) {
          startTime = String(row.start_time);
        }
        if (!endTime && row.end_time) {
          endTime = String(row.end_time);
        }
      }

      const approvedWhereParts: string[] = [];
      if ((await getTableColumns(APPROVED_REMEDIAL_TABLE)).has("is_archived")) {
        approvedWhereParts.push("COALESCE(is_archived, 0) = 0");
      }
      const approvedWhere = approvedWhereParts.length ? `WHERE ${approvedWhereParts.join(" AND ")}` : "";
      const [approvedRows] = await connection.query<RowDataPacket[]>(
        `SELECT request_id, title, subject_id, grade_id, schedule_date, day
         FROM ${APPROVED_REMEDIAL_TABLE}
         ${approvedWhere}
         ORDER BY schedule_date ASC
         LIMIT 500`,
      );

      return NextResponse.json({
        success: true,
        emergency_access: {
          emergency_access_id: Number(active.session.emergency_access_id),
          reason: String(active.session.reason),
          activated_at: String(active.session.activated_at),
          expires_at: active.session.expires_at ? String(active.session.expires_at) : null,
        },
        data: {
          remedial_quarters: quarters,
          remedial_weeks: weeks,
          weekly_schedule: {
            ...weeklySchedule,
            startTime,
            endTime,
          },
          approved_remedial_schedule: approvedRows,
        },
      });
    });
  } catch (error) {
    console.error("Failed to load emergency calendars", error);
    return NextResponse.json({ success: false, error: "Unable to load emergency calendar data." }, { status: 500 });
  }
}
