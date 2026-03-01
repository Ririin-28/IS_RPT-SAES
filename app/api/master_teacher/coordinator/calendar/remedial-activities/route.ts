import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const SUBJECT_TABLE_CANDIDATES = ["subjects", "subject"] as const;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

type IncomingActivity = {
  title?: string | null;
  date?: string | null;
  day?: string | null;
  subject?: string | null;
};

type QuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  quarter_name: string;
  start_month: number | null;
  end_month: number | null;
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const resolveSubjectLookup = async (): Promise<{ table: string; idColumn: string; nameColumn: string } | null> => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;
    const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
    const nameColumn = columns.has("name")
      ? "name"
      : columns.has("subject_name")
      ? "subject_name"
      : null;
    if (idColumn && nameColumn) {
      return { table, idColumn, nameColumn };
    }
  }
  return null;
};

const loadSubjectNameMap = async (): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  const lookup = await resolveSubjectLookup();
  if (!lookup) return map;

  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${lookup.idColumn} AS subject_id, ${lookup.nameColumn} AS subject_name FROM ${lookup.table}`,
  );
  for (const row of rows) {
    const id = toNumber(row.subject_id);
    const name = toText(row.subject_name)?.toLowerCase();
    if (id && name) {
      map.set(name, id);
    }
  }
  return map;
};

const parseActivityDate = (value: string): Date | null => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const resolveSchoolYearFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const monthInRange = (month: number, start: number, end: number): boolean => {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
};

const parseGradeIdFromLabel = (label: string | null): number | null => {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  return Number(match[1]);
};

const resolveGradeId = async (gradeId: number | null, gradeLabel: string | null): Promise<number | null> => {
  if (gradeId && Number.isFinite(gradeId)) return gradeId;
  const parsed = parseGradeIdFromLabel(gradeLabel);
  if (parsed && Number.isFinite(parsed)) return parsed;

  if (!gradeLabel) return null;

  const columns = await getTableColumns("grade").catch(() => new Set<string>());
  if (!columns.size || !columns.has("grade_id")) return null;

  const labelColumn = columns.has("grade_level")
    ? "grade_level"
    : columns.has("label")
      ? "label"
      : columns.has("name")
        ? "name"
        : columns.has("grade")
          ? "grade"
          : null;

  if (!labelColumn) return null;

  const [rows] = await query<RowDataPacket[]>(
    `SELECT grade_id FROM grade WHERE LOWER(${labelColumn}) = LOWER(?) LIMIT 1`,
    [gradeLabel],
  );

  const row = rows[0];
  return row?.grade_id ? Number(row.grade_id) : null;
};

const loadWeeklySubjectMap = async (gradeId: number | null): Promise<Map<string, number>> => {
  const columns = await getTableColumns(WEEKLY_SUBJECT_TABLE).catch(() => new Set<string>());
  const hasGradeId = columns.has("grade_id");
  const [rows] = await query<RowDataPacket[]>(
    hasGradeId && gradeId
      ? `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE} WHERE grade_id = ?`
      : `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE}`,
    hasGradeId && gradeId ? [gradeId] : [],
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


export async function POST(request: NextRequest) {
  try {
    const session = await getMasterTeacherSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      gradeId?: number | null;
      gradeLabel?: string | null;
      activities?: IncomingActivity[] | null;
    } | null;

    if (!payload?.activities || payload.activities.length === 0) {
      return NextResponse.json({ success: false, error: "No activities were provided." }, { status: 400 });
    }

    const gradeId = await resolveGradeId(toNumber(payload.gradeId), toText(payload.gradeLabel));
    if (!gradeId) {
      return NextResponse.json({ success: false, error: "Grade could not be resolved for this schedule." }, { status: 400 });
    }

    const coordinatorRoleId = session.coordinatorRoleId ? String(session.coordinatorRoleId) : null;
    const handledIds = (coordinatorRoleId
      ? [coordinatorRoleId]
      : [session.masterTeacherId, String(session.userId)]
    ).filter((value): value is string => {
      if (value === null || value === undefined) return false;
      return String(value).trim().length > 0;
    });

    const assignments = await loadHandledAssignments(handledIds, gradeId, coordinatorRoleId);
    if (!assignments.length) {
      return NextResponse.json({ success: false, error: "No subject assignment found for this master teacher." }, { status: 403 });
    }

    const assignmentBySubject = new Map<number, number>();
    const gradeBySubject = new Map<number, number>();
    for (const assignment of assignments) {
      assignmentBySubject.set(assignment.subject_id, assignment.subject_id);
      gradeBySubject.set(assignment.subject_id, assignment.grade_id);
    }

    const weeklySubjectMap = await loadWeeklySubjectMap(gradeId);
    if (!weeklySubjectMap.size) {
      return NextResponse.json({ success: false, error: "Weekly subject schedule is not configured yet." }, { status: 400 });
    }
    const subjectNameMap = await loadSubjectNameMap();

    const submittedBy = String(session.masterTeacherId ?? session.userId ?? "");
    const skipped: Array<{ title: string; reason: string }> = [];
    let inserted = 0;

    for (const activity of payload.activities) {
      const title = toText(activity.title);
      if (!title) {
        skipped.push({ title: "(untitled)", reason: "Missing activity title." });
        continue;
      }

      const dateText = toText(activity.date);
      if (!dateText) {
        skipped.push({ title, reason: "Missing activity date." });
        continue;
      }

      const parsedDate = parseActivityDate(dateText);
      if (!parsedDate) {
        skipped.push({ title, reason: "Invalid activity date." });
        continue;
      }

      const incomingDay = toText(activity.day);
      const weekday =
        incomingDay && WEEKDAYS.includes(incomingDay as (typeof WEEKDAYS)[number])
          ? incomingDay
          : WEEKDAYS[parsedDate.getDay() - 1] ?? null;
      if (!weekday) {
        skipped.push({ title, reason: "Invalid weekday." });
        continue;
      }

      const weeklySubjectId = weeklySubjectMap.get(weekday) ?? null;
      const providedSubjectName = toText(activity.subject);
      const providedSubjectId = providedSubjectName ? subjectNameMap.get(providedSubjectName.toLowerCase()) ?? null : null;
      const subjectId = providedSubjectId ?? weeklySubjectId;
      if (!subjectId) {
        skipped.push({ title, reason: `No subject assigned for ${weekday}.` });
        continue;
      }

      const subjectHandled = assignmentBySubject.get(subjectId);
      if (!subjectHandled) {
        skipped.push({ title, reason: `You are not assigned to the subject scheduled on ${weekday}.` });
        continue;
      }

      const assignmentGradeId = gradeBySubject.get(subjectId) ?? gradeId;

      const quarter = await loadQuarterForDate(parsedDate);
      if (!quarter) {
        skipped.push({ title, reason: "No remedial quarter found for this date." });
        continue;
      }

      const scheduleDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
      const [existing] = await query<RowDataPacket[]>(
        `SELECT request_id FROM ${REQUEST_REMEDIAL_TABLE}
         WHERE quarter_id = ? AND schedule_date = ? AND subject_id = ? AND grade_id = ? AND title = ? AND submitted_by = ?
         LIMIT 1`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
        ],
      );

      if (existing.length > 0) {
        skipped.push({ title, reason: "Request already submitted for this date." });
        continue;
      }

      await query<ResultSetHeader>(
        `INSERT INTO ${REQUEST_REMEDIAL_TABLE}
          (quarter_id, schedule_date, day, subject_id, grade_id, title, submitted_by, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          weekday,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
          "Pending",
        ],
      );

      inserted += 1;
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error("Failed to save remedial weekly activities", error);
    const message = error instanceof Error ? error.message : "Unable to save remedial activities.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
