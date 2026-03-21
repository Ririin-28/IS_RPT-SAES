import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePerformanceSchema } from "@/lib/performance/schema";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";
import { getTeacherSessionFromCookies } from "@/lib/server/teacher-session";

export const dynamic = "force-dynamic";

const MONTHLY_OVERRIDE_TABLE = "student_monthly_progress_override";
const REPORT_TIME_ZONE = "Asia/Manila";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const normalizeLevelKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveSchoolYear = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  const { year, monthIndex } = getCurrentManilaDateParts();
  if (monthIndex >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
};

const getCurrentManilaDateParts = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "", 10);
  const monthNumber = Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "", 10);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonthNumber =
    Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= 12
      ? monthNumber
      : new Date().getMonth() + 1;

  return {
    year: safeYear,
    monthNumber: safeMonthNumber,
    monthIndex: safeMonthNumber - 1,
  };
};

const createEmptyLevelsByStudent = (studentIds: string[]): Record<string, Record<string, string>> => {
  const levelsByStudent: Record<string, Record<string, string>> = {};
  for (const studentId of studentIds) {
    levelsByStudent[studentId] = {};
  }
  return levelsByStudent;
};

const applyLevelsByStudent = (
  target: Record<string, Record<string, string>>,
  source: Record<string, Record<string, string>>,
) => {
  for (const [studentId, monthValues] of Object.entries(source)) {
    target[studentId] = {
      ...(target[studentId] ?? {}),
      ...monthValues,
    };
  }
};

type MonthlyAssessmentPayload = {
  subject?: string | null;
  subjectId?: number | string | null;
  studentIds?: Array<string | number>;
  months?: number[];
  schoolYear?: string | null;
};

type MonthlyAssessmentSaveEntryPayload = {
  studentId?: string | number | null;
  month?: number | string | null;
  levelName?: string | null;
};

type MonthlyAssessmentSavePayload = MonthlyAssessmentPayload & {
  entries?: MonthlyAssessmentSaveEntryPayload[];
  editorUserId?: number | string | null;
  editorRole?: string | null;
};

type MonthlyAssessmentRow = RowDataPacket & {
  student_id: string | null;
  assessed_month: number | null;
  assessed_at: string | Date | null;
  level_name: string | null;
};

type MonthlyOverrideRow = RowDataPacket & {
  student_id: string | null;
  month_no: number | null;
  level_name_snapshot: string | null;
  phonemic_level_name: string | null;
};

type PhonemicLevelRow = RowDataPacket & {
  phonemic_id: number | null;
  level_name: string | null;
};

const resolveSubjectId = async (
  subjectIdInput: number | null,
  subjectName: string | null,
): Promise<number | null> => {
  if (subjectIdInput) {
    return subjectIdInput;
  }
  if (!subjectName) {
    return null;
  }
  const [rows] = await query<RowDataPacket[]>(
    "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = LOWER(TRIM(?)) LIMIT 1",
    [subjectName],
  );
  return toNumber(rows[0]?.subject_id ?? null);
};

const loadAssessmentLevels = async (
  subjectId: number,
  studentIds: string[],
  months: number[],
): Promise<Record<string, Record<string, string>>> => {
  const levelsByStudent = createEmptyLevelsByStudent(studentIds);
  if (!studentIds.length || !months.length) {
    return levelsByStudent;
  }

  const studentPlaceholders = studentIds.map(() => "?").join(", ");
  const monthPlaceholders = months.map(() => "?").join(", ");
  const sql = `
    SELECT
      ssa.student_id,
      MONTH(ssa.assessed_at) AS assessed_month,
      ssa.assessed_at,
      pl.level_name
    FROM student_subject_assessment ssa
    LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id
    WHERE ssa.subject_id = ?
      AND ssa.student_id IN (${studentPlaceholders})
      AND MONTH(ssa.assessed_at) IN (${monthPlaceholders})
    ORDER BY ssa.student_id ASC, assessed_month ASC, ssa.assessed_at DESC, ssa.assessment_id DESC
  `;

  const params: Array<string | number> = [subjectId, ...studentIds, ...months];
  const [rows] = await query<MonthlyAssessmentRow[]>(sql, params);

  for (const row of rows) {
    const studentId = toString(row.student_id);
    const month = toNumber(row.assessed_month);
    if (!studentId || !month) continue;
    const key = `m${month}`;
    if (levelsByStudent[studentId]?.[key]) continue;
    levelsByStudent[studentId] = {
      ...(levelsByStudent[studentId] ?? {}),
      [key]: toString(row.level_name) ?? "",
    };
  }

  return levelsByStudent;
};

const loadOverrideLevels = async (
  subjectId: number,
  schoolYear: string,
  studentIds: string[],
  months: number[],
): Promise<Record<string, Record<string, string>>> => {
  const levelsByStudent = createEmptyLevelsByStudent(studentIds);
  if (!studentIds.length || !months.length) {
    return levelsByStudent;
  }

  const studentPlaceholders = studentIds.map(() => "?").join(", ");
  const monthPlaceholders = months.map(() => "?").join(", ");
  const sql = `
    SELECT
      mo.student_id,
      mo.month_no,
      mo.level_name_snapshot,
      pl.level_name AS phonemic_level_name
    FROM ${MONTHLY_OVERRIDE_TABLE} mo
    LEFT JOIN phonemic_level pl ON pl.phonemic_id = mo.phonemic_id
    WHERE mo.subject_id = ?
      AND mo.school_year = ?
      AND mo.student_id IN (${studentPlaceholders})
      AND mo.month_no IN (${monthPlaceholders})
  `;

  const params: Array<string | number> = [subjectId, schoolYear, ...studentIds, ...months];
  const [rows] = await query<MonthlyOverrideRow[]>(sql, params);

  for (const row of rows) {
    const studentId = toString(row.student_id);
    const month = toNumber(row.month_no);
    if (!studentId || !month) continue;
    const levelName = toString(row.level_name_snapshot) ?? toString(row.phonemic_level_name) ?? "";
    levelsByStudent[studentId] = {
      ...(levelsByStudent[studentId] ?? {}),
      [`m${month}`]: levelName,
    };
  }

  return levelsByStudent;
};

const loadPhonemicLevelMap = async (subjectId: number) => {
  const [rows] = await query<PhonemicLevelRow[]>(
    "SELECT phonemic_id, level_name FROM phonemic_level WHERE subject_id = ? ORDER BY phonemic_id ASC",
    [subjectId],
  );

  const byNormalizedName = new Map<string, { phonemicId: number | null; levelName: string }>();
  for (const row of rows) {
    const levelName = toString(row.level_name);
    if (!levelName) continue;
    const normalized = normalizeLevelKey(levelName);
    if (!normalized || byNormalizedName.has(normalized)) continue;
    byNormalizedName.set(normalized, {
      phonemicId: toNumber(row.phonemic_id),
      levelName,
    });
  }

  return byNormalizedName;
};

const normalizeSaveEntries = (entries: unknown): Array<{ studentId: string; month: number; levelName: string }> => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const deduped = new Map<string, { studentId: string; month: number; levelName: string }>();
  for (const entry of entries as MonthlyAssessmentSaveEntryPayload[]) {
    const studentId = toString(entry?.studentId);
    const month = toNumber(entry?.month);
    if (!studentId || !month || month < 1 || month > 12) {
      continue;
    }
    const levelName = String(entry?.levelName ?? "").trim();
    deduped.set(`${studentId}:${month}`, { studentId, month, levelName });
  }

  return Array.from(deduped.values());
};

const resolveEditorMetadata = async (
  payload: MonthlyAssessmentSavePayload | null,
): Promise<{ editorUserId: number | null; editorRole: string | null }> => {
  const teacherSession = await getTeacherSessionFromCookies().catch(() => null);
  if (teacherSession?.userId) {
    return {
      editorUserId: teacherSession.userId,
      editorRole: "teacher",
    };
  }

  const masterTeacherSession = await getMasterTeacherSessionFromCookies().catch(() => null);
  if (masterTeacherSession?.userId) {
    return {
      editorUserId: masterTeacherSession.userId,
      editorRole: masterTeacherSession.roleContext === "remedial" ? "master_teacher_remedial" : "master_teacher",
    };
  }

  return {
    editorUserId: toNumber(payload?.editorUserId ?? null),
    editorRole: toString(payload?.editorRole ?? null),
  };
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as MonthlyAssessmentPayload | null;
    const subjectName = toString(payload?.subject ?? null);
    const subjectIdInput = toNumber(payload?.subjectId ?? null);
    const schoolYear = resolveSchoolYear(payload?.schoolYear ?? null);

    const rawStudentIds = Array.isArray(payload?.studentIds) ? payload?.studentIds : [];
    const studentIds = rawStudentIds.map((value) => toString(value)).filter((value): value is string => Boolean(value));

    const rawMonths = Array.isArray(payload?.months) ? payload?.months : [];
    const months = rawMonths
      .map((value) => toNumber(value))
      .filter((value): value is number => Boolean(value && value >= 1 && value <= 12));

    if (!studentIds.length || !months.length) {
      return NextResponse.json({ success: true, levelsByStudent: {} });
    }

    const subjectId = await resolveSubjectId(subjectIdInput, subjectName);
    if (!subjectId) {
      return NextResponse.json({ success: false, error: "Subject not found." }, { status: 400 });
    }

    await ensurePerformanceSchema();

    const levelsByStudent = await loadAssessmentLevels(subjectId, studentIds, months);
    const overrideLevelsByStudent = await loadOverrideLevels(subjectId, schoolYear, studentIds, months);
    const { monthNumber: currentMonthNumber } = getCurrentManilaDateParts();
    if (schoolYear === resolveSchoolYear(null)) {
      const currentMonthKey = `m${currentMonthNumber}`;
      for (const studentId of Object.keys(overrideLevelsByStudent)) {
        if (!overrideLevelsByStudent[studentId]?.[currentMonthKey]) {
          continue;
        }
        delete overrideLevelsByStudent[studentId][currentMonthKey];
        if (!Object.keys(overrideLevelsByStudent[studentId]).length) {
          delete overrideLevelsByStudent[studentId];
        }
      }
    }
    applyLevelsByStudent(levelsByStudent, overrideLevelsByStudent);

    return NextResponse.json({ success: true, schoolYear, levelsByStudent });
  } catch (error) {
    console.error("Failed to load monthly assessment levels", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as MonthlyAssessmentSavePayload | null;
    const subjectName = toString(payload?.subject ?? null);
    const subjectIdInput = toNumber(payload?.subjectId ?? null);
    const schoolYear = resolveSchoolYear(payload?.schoolYear ?? null);
    const entries = normalizeSaveEntries(payload?.entries);
    const { monthNumber: currentMonthNumber } = getCurrentManilaDateParts();
    const currentSchoolYear = resolveSchoolYear(null);

    if (!entries.length) {
      return NextResponse.json({
        success: true,
        schoolYear,
        savedEntries: [],
        clearedEntries: [],
        savedCount: 0,
        clearedCount: 0,
      });
    }

    if (schoolYear === currentSchoolYear && entries.some((entry) => entry.month === currentMonthNumber)) {
      const lockedMonthLabel = MONTH_NAMES[currentMonthNumber - 1] ?? "Current month";
      return NextResponse.json(
        {
          success: false,
          error: `${lockedMonthLabel} is read-only in the report. Update the student's official remedial level through the assessment/remedial flow instead.`,
        },
        { status: 409 },
      );
    }

    const subjectId = await resolveSubjectId(subjectIdInput, subjectName);
    if (!subjectId) {
      return NextResponse.json({ success: false, error: "Subject not found." }, { status: 400 });
    }

    await ensurePerformanceSchema();

    const { editorUserId, editorRole } = await resolveEditorMetadata(payload);
    const phonemicLevelMap = await loadPhonemicLevelMap(subjectId);

    const savedEntries: Array<{ studentId: string; month: number; key: string; levelName: string }> = [];
    const clearedEntries: Array<{ studentId: string; month: number; key: string }> = [];

    for (const entry of entries) {
      const key = `m${entry.month}`;

      if (!entry.levelName) {
        await query(
          `DELETE FROM ${MONTHLY_OVERRIDE_TABLE}
           WHERE student_id = ? AND subject_id = ? AND school_year = ? AND month_no = ?
           LIMIT 1`,
          [entry.studentId, subjectId, schoolYear, entry.month],
        );
        clearedEntries.push({
          studentId: entry.studentId,
          month: entry.month,
          key,
        });
        continue;
      }

      const matchedLevel = phonemicLevelMap.get(normalizeLevelKey(entry.levelName));
      const phonemicId = matchedLevel?.phonemicId ?? null;
      const levelName = matchedLevel?.levelName ?? entry.levelName;

      await query(
        `INSERT INTO ${MONTHLY_OVERRIDE_TABLE}
          (student_id, subject_id, school_year, month_no, phonemic_id, level_name_snapshot, edited_by_user_id, edited_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phonemic_id = VALUES(phonemic_id),
           level_name_snapshot = VALUES(level_name_snapshot),
           edited_by_user_id = VALUES(edited_by_user_id),
           edited_by_role = VALUES(edited_by_role),
           updated_at = CURRENT_TIMESTAMP`,
        [entry.studentId, subjectId, schoolYear, entry.month, phonemicId, levelName, editorUserId, editorRole],
      );

      savedEntries.push({
        studentId: entry.studentId,
        month: entry.month,
        key,
        levelName,
      });
    }

    return NextResponse.json({
      success: true,
      schoolYear,
      savedEntries,
      clearedEntries,
      savedCount: savedEntries.length,
      clearedCount: clearedEntries.length,
    });
  } catch (error) {
    console.error("Failed to save monthly assessment overrides", error);
    return NextResponse.json({ success: false, error: "Unable to save monthly report changes." }, { status: 500 });
  }
}
