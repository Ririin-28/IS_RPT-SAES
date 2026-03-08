import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getTeacherSessionFromCookies } from "@/lib/server/teacher-session";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const TEACHER_HANDLED_TABLE = "teacher_handled";
const MT_REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled";
const STUDENT_TEACHER_ASSIGNMENT_TABLE = "student_teacher_assignment";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

type WeeklyScheduleRow = RowDataPacket & {
  day_of_week: string;
  subject_id: number;
  start_time: string | null;
  end_time: string | null;
};

type QuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  quarter_name: string | null;
  start_month: number | null;
  end_month: number | null;
};

const resolveSchoolYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const parseSchoolYear = (schoolYear: string): { startYear: number; endYear: number } | null => {
  const [startYear, endYear] = schoolYear.split("-").map((value) => Number(value));
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return null;
  }
  return { startYear, endYear };
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

  const start = new Date(startYear, startMonth - 1, 1, 12, 0, 0, 0);
  const end = new Date(endYear, endMonth, 0, 12, 0, 0, 0);
  return { start, end };
};

const isDateWithinRange = (date: Date, range: { start: Date; end: Date }): boolean => {
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toIsoDateTime = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized.toISOString();
};

const resolveAssessmentSubjectId = async (): Promise<number> => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;

    const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
    const nameColumn = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
    if (!idColumn || !nameColumn) continue;

    const [rows] = await query<RowDataPacket[]>(
      `SELECT ${idColumn} AS subject_id FROM ${table} WHERE LOWER(TRIM(${nameColumn})) = 'assessment' LIMIT 1`,
    );

    const subjectId = rows[0]?.subject_id ? Number(rows[0].subject_id) : null;
    if (subjectId && Number.isFinite(subjectId)) {
      return subjectId;
    }
  }

  return 1;
};

const resolveTeacherGradeId = async (): Promise<number | null> => {
  const session = await getTeacherSessionFromCookies();
  if (!session) return null;

  const columns = await getTableColumns(TEACHER_HANDLED_TABLE).catch(() => new Set<string>());
  if (columns.has("teacher_id") && session.teacherId) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${TEACHER_HANDLED_TABLE} WHERE teacher_id = ? AND grade_id IS NOT NULL LIMIT 1`,
      [session.teacherId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  if (columns.has("user_id")) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${TEACHER_HANDLED_TABLE} WHERE user_id = ? AND grade_id IS NOT NULL LIMIT 1`,
      [session.userId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  const assignmentColumns = await getTableColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE).catch(() => new Set<string>());
  if (assignmentColumns.has("teacher_id") && session.teacherId && assignmentColumns.has("is_active")) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} WHERE teacher_id = ? AND is_active = 1 LIMIT 1`,
      [session.teacherId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  return null;
};

const resolveRemedialTeacherGradeId = async (): Promise<number | null> => {
  const session = await getMasterTeacherSessionFromCookies();
  if (!session) return null;

  const columns = await getTableColumns(MT_REMEDIAL_HANDLED_TABLE).catch(() => new Set<string>());
  if (columns.has("master_teacher_id")) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${MT_REMEDIAL_HANDLED_TABLE} WHERE master_teacher_id = ? AND grade_id IS NOT NULL LIMIT 1`,
      [session.masterTeacherId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  if (columns.has("remedial_role_id") && session.remedialRoleId) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${MT_REMEDIAL_HANDLED_TABLE} WHERE remedial_role_id = ? AND grade_id IS NOT NULL LIMIT 1`,
      [session.remedialRoleId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  const assignmentColumns = await getTableColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE).catch(() => new Set<string>());
  if (assignmentColumns.has("remedial_role_id") && session.remedialRoleId && assignmentColumns.has("is_active")) {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} WHERE remedial_role_id = ? AND is_active = 1 LIMIT 1`,
      [session.remedialRoleId],
    );
    const gradeId = rows[0]?.grade_id ? Number(rows[0].grade_id) : null;
    if (gradeId && Number.isFinite(gradeId)) return gradeId;
  }

  return null;
};

const resolveActiveGradeId = async (): Promise<number | null> => {
  return (await resolveTeacherGradeId()) ?? (await resolveRemedialTeacherGradeId());
};

export async function GET() {
  try {
    const gradeId = await resolveActiveGradeId();
    if (!gradeId) {
      return NextResponse.json({ success: false, error: "Grade could not be resolved for this assessment schedule." }, { status: 400 });
    }

    const weeklyColumns = await getTableColumns(WEEKLY_SUBJECT_TABLE).catch(() => new Set<string>());
    if (!weeklyColumns.has("day_of_week") || !weeklyColumns.has("subject_id")) {
      return NextResponse.json({ success: true, activities: [] });
    }

    const assessmentSubjectId = await resolveAssessmentSubjectId();
    const hasGradeId = weeklyColumns.has("grade_id");
    const [weeklyRows] = await query<WeeklyScheduleRow[]>(
      hasGradeId
        ? `SELECT day_of_week, subject_id, start_time, end_time FROM ${WEEKLY_SUBJECT_TABLE} WHERE grade_id = ?`
        : `SELECT day_of_week, subject_id, start_time, end_time FROM ${WEEKLY_SUBJECT_TABLE}`,
      hasGradeId ? [gradeId] : [],
    );

    const assessmentRows = weeklyRows.filter((row) => Number(row.subject_id) === assessmentSubjectId);
    if (!assessmentRows.length) {
      return NextResponse.json({ success: true, activities: [] });
    }

    const schoolYear = resolveSchoolYear();
    const [quarterRows] = await query<QuarterRow[]>(
      `SELECT quarter_id, school_year, quarter_name, start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} WHERE school_year = ?`,
      [schoolYear],
    );

    const today = new Date();
    const activeQuarter = quarterRows.find((quarter) => {
      const startMonth = Number(quarter.start_month);
      const endMonth = Number(quarter.end_month);
      if (!Number.isFinite(startMonth) || !Number.isFinite(endMonth)) {
        return false;
      }

      const range = buildQuarterRange(schoolYear, startMonth, endMonth);
      return range ? isDateWithinRange(today, range) : false;
    }) ?? null;

    if (!activeQuarter) {
      return NextResponse.json({
        success: true,
        activities: [],
        metadata: {
          gradeId,
          schoolYear,
          activeQuarter: null,
        },
      });
    }

    const activities = new Map<string, {
      id: string;
      title: string;
      subject: string;
      subjectId: number;
      gradeId: number;
      activityDate: string;
      day: string;
      startTime: string | null;
      endTime: string | null;
      quarter: string | null;
    }>();

    const activeStartMonth = Number(activeQuarter.start_month);
    const activeEndMonth = Number(activeQuarter.end_month);
    const activeRange = Number.isFinite(activeStartMonth) && Number.isFinite(activeEndMonth)
      ? buildQuarterRange(schoolYear, activeStartMonth, activeEndMonth)
      : null;

    if (!activeRange) {
      return NextResponse.json({
        success: true,
        activities: [],
        metadata: {
          gradeId,
          schoolYear,
          activeQuarter: activeQuarter.quarter_name ? String(activeQuarter.quarter_name) : null,
        },
      });
    }

    for (const row of assessmentRows) {
      const weekday = String(row.day_of_week ?? "").trim();
      const weekdayIndex = WEEKDAY_INDEX[weekday];
      if (!weekdayIndex) {
        continue;
      }

      const cursor = new Date(activeRange.start);
      const delta = (weekdayIndex - cursor.getDay() + 7) % 7;
      cursor.setDate(cursor.getDate() + delta);

      while (cursor.getTime() <= activeRange.end.getTime()) {
        const dateKey = toDateKey(cursor);
        if (!activities.has(dateKey)) {
          activities.set(dateKey, {
            id: `assessment-${gradeId}-${dateKey}`,
            title: "Assessment Day",
            subject: "Assessment",
            subjectId: assessmentSubjectId,
            gradeId,
            activityDate: toIsoDateTime(cursor),
            day: weekday,
            startTime: null,
            endTime: null,
            quarter: activeQuarter.quarter_name ? String(activeQuarter.quarter_name) : null,
          });
        }

        cursor.setDate(cursor.getDate() + 7);
      }
    }

    return NextResponse.json({
      success: true,
      activities: Array.from(activities.values()).sort((left, right) => Date.parse(left.activityDate) - Date.parse(right.activityDate)),
      metadata: {
        gradeId,
        schoolYear,
        activeQuarter: activeQuarter.quarter_name ? String(activeQuarter.quarter_name) : null,
      },
    });
  } catch (error) {
    console.error("Failed to load assessment days", error);
    return NextResponse.json({ success: false, error: "Unable to load assessment days." }, { status: 500 });
  }
}
