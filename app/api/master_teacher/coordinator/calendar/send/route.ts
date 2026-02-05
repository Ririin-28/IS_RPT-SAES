import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const PRINCIPAL_NOTIFICATION_TABLE = "principal_notifications";

const PRINCIPAL_TABLE_CANDIDATES = [
  "principal",
  "principals",
  "principal_info",
  "principal_profile",
  "principal_profiles",
] as const;

const PRINCIPAL_ID_COLUMNS = ["principal_id", "user_code", "user_id"] as const;

type IncomingActivity = {
  title?: string | null;
  date?: string | null;
};

type QuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  quarter_name: string;
  start_month: number | null;
  end_month: number | null;
};

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSchoolYearFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

// const parseSchoolYear = (schoolYear: string): { startYear: number; endYear: number } | null => {
//   const [start, end] = schoolYear.split("-").map((part) => Number(part));
//   if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
//   return { startYear: start, endYear: end };
// };

const monthInRange = (month: number, start: number, end: number): boolean => {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
};


const loadWeeklySubjectMap = async (): Promise<Map<string, number>> => {
  const [rows] = await query<RowDataPacket[]>(
    `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE}`,
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = row.day_of_week ? String(row.day_of_week).trim() : "";
    const subjectId = toNumber(row.subject_id);
    if (day && subjectId) {
      map.set(day, subjectId);
    }
  }
  return map;
};

const loadHandledAssignments = async (
  masterTeacherIds: Array<string | number>,
  gradeId: number | null,
  coordinatorRoleId: string | null,
) => {
  const columns = await getTableColumns(MT_HANDLED_TABLE).catch(() => new Set<string>());
  const canUseRoleId = Boolean(coordinatorRoleId) && columns.has("coordinator_role_id");
  const filterIds = canUseRoleId ? [coordinatorRoleId as string] : masterTeacherIds;
  if (!filterIds.length) return [] as Array<{ subject_id: number; grade_id: number }>;

  const params: Array<string | number> = [...filterIds];
  const gradeFilter = gradeId && Number.isFinite(gradeId) ? " AND grade_id = ?" : "";
  if (gradeFilter) params.push(gradeId as number);

  const filterColumn = canUseRoleId ? "coordinator_role_id" : "master_teacher_id";
  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, grade_id FROM ${MT_HANDLED_TABLE} WHERE ${filterColumn} IN (${filterIds.map(() => "?").join(", ")})${gradeFilter}`,
    params,
  );

  return rows
    .map((row) => ({
      subject_id: Number(row.subject_id),
      grade_id: Number(row.grade_id),
    }))
    .filter((row) => Number.isFinite(row.subject_id));
};


const loadQuarterForDate = async (date: Date): Promise<QuarterRow | null> => {
  const schoolYear = resolveSchoolYearFromDate(date);
  const [rows] = await query<QuarterRow[]>(
    `SELECT quarter_id, school_year, quarter_name, start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} WHERE school_year = ?`,
    [schoolYear],
  );
  const month = date.getMonth() + 1;
  for (const row of rows) {
    const start = toNumber(row.start_month);
    const end = toNumber(row.end_month);
    if (!start || !end) continue;
    if (monthInRange(month, start, end)) {
      return row;
    }
  }
  return null;
};

const ensurePrincipalNotificationsTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${PRINCIPAL_NOTIFICATION_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      principal_id VARCHAR(64) NULL,
      message TEXT NOT NULL,
      status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_principal_notifications_principal (principal_id),
      KEY idx_principal_notifications_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};

const resolvePrincipalIds = async (): Promise<string[]> => {
  for (const table of PRINCIPAL_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;
    const idColumn = PRINCIPAL_ID_COLUMNS.find((candidate) => columns.has(candidate));
    if (!idColumn) continue;

    const [rows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT ${idColumn} AS principal_id FROM ${table} WHERE ${idColumn} IS NOT NULL`,
    );
    const ids = rows
      .map((row) => String(row.principal_id ?? "").trim())
      .filter((value) => value.length > 0);
    if (ids.length) {
      return ids;
    }
  }

  return [];
};

const insertPrincipalNotification = async (message: string) => {
  await ensurePrincipalNotificationsTable();
  const principalIds = await resolvePrincipalIds();

  if (!principalIds.length) {
    await query(
      `INSERT INTO ${PRINCIPAL_NOTIFICATION_TABLE} (principal_id, message, status)
       VALUES (?, ?, 'unread')`,
      [null, message],
    );
    return;
  }

  const placeholders = principalIds.map(() => "(?, ?, 'unread')").join(", ");
  const values = principalIds.flatMap((id) => [id, message]);
  await query(
    `INSERT INTO ${PRINCIPAL_NOTIFICATION_TABLE} (principal_id, message, status)
     VALUES ${placeholders}`,
    values,
  );
};

export async function POST(request: NextRequest) {
  try {
    const session = await getMasterTeacherSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      gradeLevel?: string | null;
      activities?: IncomingActivity[] | null;
    } | null;

    if (!payload?.activities || payload.activities.length === 0) {
      return NextResponse.json(
        { success: false, error: "No activities were provided for sending." },
        { status: 400 },
      );
    }

    const gradeId = payload.gradeLevel ? Number(String(payload.gradeLevel).match(/(\d+)/)?.[1]) : null;
    const coordinatorRoleId = session.coordinatorRoleId ? String(session.coordinatorRoleId) : null;
    const handledIds = (coordinatorRoleId
      ? [coordinatorRoleId]
      : [String(session.masterTeacherId), String(session.userId)]
    ).filter((value): value is string => {
      if (value === null || value === undefined) return false;
      return String(value).trim().length > 0;
    });

    const assignments = await loadHandledAssignments(handledIds, gradeId ?? null, coordinatorRoleId);
    if (!assignments.length) {
      return NextResponse.json({ success: false, error: "No subject assignment found for this master teacher." }, { status: 403 });
    }

    const assignmentBySubject = new Map<number, number>();
    const gradeBySubject = new Map<number, number>();
    for (const assignment of assignments) {
      assignmentBySubject.set(assignment.subject_id, assignment.subject_id);
      gradeBySubject.set(assignment.subject_id, assignment.grade_id);
    }

    const resolvedGradeId = gradeId ?? assignments[0]?.grade_id ?? null;
    if (!resolvedGradeId) {
      return NextResponse.json({ success: false, error: "Grade could not be resolved for this schedule." }, { status: 400 });
    }

    const weeklySubjectMap = await loadWeeklySubjectMap();
    if (!weeklySubjectMap.size) {
      return NextResponse.json({ success: false, error: "Weekly subject schedule is not configured yet." }, { status: 400 });
    }

    const submittedBy = String(session.masterTeacherId ?? session.userId ?? "");
    const masterTeacherId = String(session.masterTeacherId ?? "").trim();
    const skipped: Array<{ title: string | null; reason: string }> = [];
    let inserted = 0;

    for (const activity of payload.activities) {
      const title = toText(activity.title);
      if (!title) {
        skipped.push({ title: null, reason: "Missing title." });
        continue;
      }

      const dateText = toText(activity.date);
      if (!dateText) {
        skipped.push({ title, reason: "Invalid or missing date." });
        continue;
      }

      const parsedDate = new Date(dateText);
      if (Number.isNaN(parsedDate.getTime())) {
        skipped.push({ title, reason: "Invalid or missing date." });
        continue;
      }

      const weekday = parsedDate.toLocaleDateString("en-US", { weekday: "long" });
      const subjectId = weeklySubjectMap.get(weekday);
      if (!subjectId) {
        skipped.push({ title, reason: `No subject assigned for ${weekday}.` });
        continue;
      }

      const subjectHandled = assignmentBySubject.get(subjectId);
      if (!subjectHandled) {
        skipped.push({ title, reason: `You are not assigned to the subject scheduled on ${weekday}.` });
        continue;
      }

      const assignmentGradeId = gradeBySubject.get(subjectId) ?? resolvedGradeId;

      const quarter = await loadQuarterForDate(parsedDate);
      if (!quarter) {
        skipped.push({ title, reason: "No remedial quarter found for this date." });
        continue;
      }

      const scheduleDate = parsedDate.toISOString().slice(0, 10);
      const [existing] = await query<RowDataPacket[]>(
        `SELECT request_id FROM ${REQUEST_REMEDIAL_TABLE}
         WHERE quarter_id = ? AND schedule_date = ? AND subject_id = ? AND grade_id = ? AND title = ? AND submitted_by = ? AND master_teacher_id = ?
         LIMIT 1`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
          masterTeacherId,
        ],
      );

      if (existing.length > 0) {
        skipped.push({ title, reason: "Activity already submitted for this week." });
        continue;
      }

      await query<ResultSetHeader>(
        `INSERT INTO ${REQUEST_REMEDIAL_TABLE}
          (quarter_id, schedule_date, day, subject_id, grade_id, title, submitted_by, master_teacher_id, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          weekday,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
          masterTeacherId,
          "Pending",
        ],
      );

      inserted += 1;
    }

    if (inserted > 0) {
      await insertPrincipalNotification(
        "An MT Coordinator requested a remedial activities. See full details in Requests",
      );
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error("Failed to send coordinator activities", error);
    return NextResponse.json(
      { success: false, error: "Unable to send activities at this time." },
      { status: 500 },
    );
  }
}
