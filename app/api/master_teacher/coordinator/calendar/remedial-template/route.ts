import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const SUBJECT_TABLE_CANDIDATES = ["subjects", "subject"] as const;

const DEFAULT_SUBJECTS: Record<number, string> = {
  1: "Assessment",
  2: "English",
  3: "Filipino",
  4: "Math",
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

const resolveSchoolYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const parseSchoolYear = (schoolYear: string): { startYear: number; endYear: number } | null => {
  const [start, end] = schoolYear.split("-").map((part) => Number(part));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { startYear: start, endYear: end };
};

const yearForMonth = (schoolYear: string, month: number): number | null => {
  const parsed = parseSchoolYear(schoolYear);
  if (!parsed) return null;
  return month >= 6 ? parsed.startYear : parsed.endYear;
};

const buildQuarterRange = (schoolYear: string, startMonth: number, endMonth: number): { start: Date; end: Date } | null => {
  const startYear = yearForMonth(schoolYear, startMonth);
  const endYear = yearForMonth(schoolYear, endMonth);
  if (!startYear || !endYear) return null;
  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isWeekday = (date: Date): boolean => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSubjectTable = async () => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    try {
      const columns = await getTableColumns(table);
      const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
      const nameColumn = columns.has("name")
        ? "name"
        : columns.has("subject_name")
        ? "subject_name"
        : null;
      if (idColumn && nameColumn) return { table, idColumn, nameColumn };
    } catch {
      continue;
    }
  }
  return null;
};

const loadSubjectMap = async (): Promise<Map<number, string>> => {
  const map = new Map<number, string>();
  const lookup = await resolveSubjectTable();
  if (!lookup) {
    for (const [id, name] of Object.entries(DEFAULT_SUBJECTS)) {
      map.set(Number(id), name);
    }
    return map;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${lookup.idColumn} AS id, ${lookup.nameColumn} AS name FROM ${lookup.table}`,
  );

  for (const row of rows) {
    const id = normalizeNumber(row.id);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (id && name) {
      map.set(id, name);
    }
  }

  if (!map.size) {
    for (const [id, name] of Object.entries(DEFAULT_SUBJECTS)) {
      map.set(Number(id), name);
    }
  }

  return map;
};

const loadWeeklySubjectMap = async (gradeId: number): Promise<Map<string, number>> => {
  const columns = await getTableColumns(WEEKLY_SUBJECT_TABLE).catch(() => new Set<string>());
  const hasGradeId = columns.has("grade_id");
  const [rows] = await query<RowDataPacket[]>(
    hasGradeId
      ? `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE} WHERE grade_id = ?`
      : `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE}`,
    hasGradeId ? [gradeId] : [],
  );

  const map = new Map<string, number>();
  for (const row of rows) {
    const day = row.day_of_week ? String(row.day_of_week).trim() : "";
    const subjectId = normalizeNumber(row.subject_id);
    if (day && subjectId) {
      map.set(day, subjectId);
    }
  }
  return map;
};

const loadAssignments = async (
  teacherIds: Array<string | number>,
  coordinatorRoleId: string | null,
): Promise<Array<{ subjectId: number; gradeId: number }>> => {
  const columns = await getTableColumns(MT_HANDLED_TABLE).catch(() => new Set<string>());
  const canUseRoleId = Boolean(coordinatorRoleId) && columns.has("coordinator_role_id");
  const filterIds = canUseRoleId ? [coordinatorRoleId as string] : teacherIds;
  if (!filterIds.length) return [];

  const filterColumn = canUseRoleId ? "coordinator_role_id" : "master_teacher_id";
  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, grade_id FROM ${MT_HANDLED_TABLE} WHERE ${filterColumn} IN (${filterIds.map(() => "?").join(", ")})`,
    filterIds,
  );

  return rows
    .map((row) => ({
      subjectId: Number(row.subject_id),
      gradeId: Number(row.grade_id),
    }))
    .filter((row) => Number.isFinite(row.subjectId) && Number.isFinite(row.gradeId));
};

export async function GET() {
  try {
    const session = await getMasterTeacherSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
    }

    const coordinatorRoleId = session.coordinatorRoleId ? String(session.coordinatorRoleId) : null;
    const teacherIds = (coordinatorRoleId
      ? [coordinatorRoleId]
      : [session.masterTeacherId, String(session.userId)]
    ).filter((value): value is string => {
      if (value === null || value === undefined) return false;
      return String(value).trim().length > 0;
    });

    const assignments = await loadAssignments(teacherIds, coordinatorRoleId);
    if (!assignments.length) {
      return NextResponse.json({ success: false, error: "No subject assignments found for this master teacher." }, { status: 404 });
    }

    const schoolYear = resolveSchoolYear();
    const [quarters] = await query<RowDataPacket[]>(
      `SELECT quarter_id, quarter_name, start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} WHERE school_year = ?`,
      [schoolYear],
    );

    if (!quarters.length) {
      return NextResponse.json({ success: false, error: "Remedial period is not set for the current school year." }, { status: 404 });
    }

    const subjectMap = await loadSubjectMap();

    const rows: Array<Record<string, string>> = [];
    const dedupe = new Set<string>();

    for (const assignment of assignments) {
      const weeklyMap = await loadWeeklySubjectMap(assignment.gradeId);
      if (!weeklyMap.size) {
        continue;
      }

      for (const quarter of quarters) {
        const startMonth = normalizeNumber(quarter.start_month);
        const endMonth = normalizeNumber(quarter.end_month);
        if (!startMonth || !endMonth) {
          continue;
        }

        const range = buildQuarterRange(schoolYear, startMonth, endMonth);
        if (!range) {
          continue;
        }

        const current = new Date(range.start);
        while (current <= range.end) {
          if (isWeekday(current)) {
            const weekdayLabel = WEEKDAYS[current.getDay() - 1] ?? "";
            const subjectId = weeklyMap.get(weekdayLabel);
            if (subjectId && subjectId === assignment.subjectId) {
              const subjectLabel = subjectMap.get(subjectId) ?? `Subject ${subjectId}`;
              const gradeLabel = `Grade ${assignment.gradeId}`;
              const dateLabel = formatDate(current);
              const key = `${quarter.quarter_name}-${dateLabel}-${subjectId}-${assignment.gradeId}`;

              if (!dedupe.has(key)) {
                dedupe.add(key);
                rows.push({
                  Quarter: String(quarter.quarter_name ?? ""),
                  Date: dateLabel,
                  Day: weekdayLabel,
                  Subject: subjectLabel,
                  Grade: gradeLabel,
                  Title: "",
                });
              }
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    if (!rows.length) {
      return NextResponse.json({ success: false, error: "No template rows were generated for your assignment." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      meta: { schoolYear },
      rows,
    });
  } catch (error) {
    console.error("Failed to build remedial template", error);
    return NextResponse.json({ success: false, error: "Unable to build remedial template." }, { status: 500 });
  }
}
