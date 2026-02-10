import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_TABLE = "subject" as const;
const STUDENT_TABLE = "student" as const;
const ASSIGNMENT_TABLE = "student_teacher_assignment" as const;
const TEACHER_TABLE = "teacher" as const;
const TEACHER_HANDLED_TABLE = "teacher_handled" as const;
const USERS_TABLE = "users" as const;
const STUDENT_REMEDIAL_SESSION_TABLE = "student_remedial_session" as const;
const PHONEMIC_LEVEL_TABLE = "phonemic_level" as const;

const SUBJECT_NAMES = ["English", "Filipino", "Math"] as const;
type SubjectName = (typeof SUBJECT_NAMES)[number];
type SubjectCounts = Record<SubjectName, number>;


type TrendSubjectData = {
  weekly: number[];
  monthly: number[];
  levelLabels: string[];
  levelDistributionByMonth: Record<string, number[]>;
};

type TrendPayload = {
  months: Array<{ key: string; label: string }>;
  weeks: string[];
  subjects: Record<SubjectName, TrendSubjectData>;
};

const STUDENT_ID_COLUMNS = ["student_id", "studentId", "studentID", "id"] as const;
const SUBJECT_ID_COLUMNS = ["subject_id", "subjectId", "subjectID", "subjectid", "id"] as const;
const TEACHER_IDENTIFIER_COLUMNS = [
  "teacher_id",
  "teacherid",
  "employee_id",
  "faculty_id",
  "user_code",
  "id",
] as const;
const USER_TEACHER_COLUMNS = ["teacher_id", "user_code", "employee_id", "faculty_id"] as const;
const SESSION_PHONEMIC_COLUMNS = ["phonemic_id", "phonemicId", "phonemicid"] as const;
const SESSION_COMPLETED_COLUMNS = ["completed_at", "completedAt", "completeddate", "completed_date"] as const;
const SESSION_CREATED_COLUMNS = ["created_at", "createdAt", "createddate", "created_date"] as const;

const DEFAULT_COUNTS: SubjectCounts = {
  English: 0,
  Filipino: 0,
  Math: 0,
};

const DEFAULT_TRENDS: TrendPayload = {
  months: [],
  weeks: ["Week 1", "Week 2", "Week 3", "Week 4"],
  subjects: {
    English: { weekly: [], monthly: [], levelLabels: [], levelDistributionByMonth: {} },
    Filipino: { weekly: [], monthly: [], levelLabels: [], levelDistributionByMonth: {} },
    Math: { weekly: [], monthly: [], levelLabels: [], levelDistributionByMonth: {} },
  },
};

const buildRecentMonths = (count = 7) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const months: Array<{ key: string; label: string }> = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    months.push({ key, label });
  }
  return months;
};

const getMonthKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getWeekIndex = (value: Date) => {
  const week = Math.floor((value.getDate() - 1) / 7) + 1;
  return Math.min(Math.max(week, 1), 4);
};

const sanitize = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

async function safeGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
}

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  const lowerLookup = new Map<string, string>();
  for (const column of columns) {
    lowerLookup.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lowerLookup.get(candidate.toLowerCase());
    if (resolved) {
      return resolved;
    }
  }

  for (const candidate of candidates) {
    const needle = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(needle)) {
        return column;
      }
    }
  }

  return null;
};

async function collectTeacherIdentifiers(
  userId: number,
  userColumns: Set<string>,
  teacherColumns: Set<string>,
): Promise<string[]> {
  const identifiers = new Set<string>();
  identifiers.add(String(userId));

  if (userColumns.has("user_id")) {
    const available = USER_TEACHER_COLUMNS.filter((column) => userColumns.has(column));
    const selectParts = ["user_id AS user_id"];
    available.forEach((column) => selectParts.push(`${column} AS ${column}`));

    const sql = `SELECT ${selectParts.join(", ")} FROM \`${USERS_TABLE}\` WHERE user_id = ? LIMIT 1`;
    const [rows] = await query<RowDataPacket[]>(sql, [userId]);
    if (rows.length) {
      const row = rows[0];
      const userIdentifier = sanitize(row.user_id);
      if (userIdentifier) {
        identifiers.add(userIdentifier);
      }
      available.forEach((column) => {
        const value = sanitize(row[column as keyof RowDataPacket]);
        if (value) {
          identifiers.add(value);
        }
      });
    }
  }

  if (!teacherColumns.size) {
    return Array.from(identifiers);
  }

  const teacherIdColumn = pickColumn(teacherColumns, TEACHER_IDENTIFIER_COLUMNS);
  if (!teacherIdColumn) {
    return Array.from(identifiers);
  }

  if (teacherColumns.has("user_id")) {
    const sql = `SELECT ${teacherIdColumn} AS teacher_identifier FROM \`${TEACHER_TABLE}\` WHERE user_id = ?`;
    const [rows] = await query<RowDataPacket[]>(sql, [userId]);
    rows.forEach((row) => {
      const value = sanitize(row.teacher_identifier ?? row[teacherIdColumn as keyof RowDataPacket]);
      if (value) {
        identifiers.add(value);
      }
    });
  }

  return Array.from(identifiers);
}

async function resolveTeacherId(userId: number, teacherColumns: Set<string>): Promise<string | null> {
  if (!teacherColumns.size || !teacherColumns.has("user_id")) {
    return null;
  }
  const teacherIdColumn = pickColumn(teacherColumns, TEACHER_IDENTIFIER_COLUMNS);
  if (!teacherIdColumn) {
    return null;
  }
  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${teacherIdColumn} AS teacher_id FROM \`${TEACHER_TABLE}\` WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const value = sanitize(rows[0]?.teacher_id);
  return value ?? null;
}

async function loadHandledGradeIds(
  teacherIds: string[],
  teacherHandledColumns: Set<string>,
): Promise<number[]> {
  if (!teacherIds.length || !teacherHandledColumns.size || !teacherHandledColumns.has("teacher_id")) {
    return [];
  }

  const gradeColumn = teacherHandledColumns.has("grade_id") ? "grade_id" : null;
  if (!gradeColumn) {
    return [];
  }

  const placeholders = teacherIds.map(() => "?").join(", ");
  const sql = `
    SELECT DISTINCT ${gradeColumn} AS resolved_grade
    FROM \`${TEACHER_HANDLED_TABLE}\`
    WHERE teacher_id IN (${placeholders})
  `;

  const [rows] = await query<RowDataPacket[]>(sql, teacherIds);
  const gradeSet = new Set<number>();
  rows.forEach((row) => {
    const raw = row.resolved_grade ?? row[gradeColumn as keyof RowDataPacket];
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      gradeSet.add(parsed);
    }
  });

  return Array.from(gradeSet);
}

async function resolveSubjectIds(names: readonly string[]): Promise<Map<string, number>> {
  const columns = await safeGetColumns(SUBJECT_TABLE);
  if (!columns.size || !columns.has("subject_id")) {
    return new Map();
  }

  const labelColumn = pickColumn(columns, ["subject_name", "subject", "name"]);
  if (!labelColumn) {
    return new Map();
  }

  const normalized = names.map((name) => name.trim().toLowerCase());
  const placeholders = normalized.map(() => "?").join(", ");
  const sql = `
    SELECT subject_id, LOWER(${labelColumn}) AS subject_name
    FROM \`${SUBJECT_TABLE}\`
    WHERE LOWER(${labelColumn}) IN (${placeholders})
  `;

  const [rows] = await query<RowDataPacket[]>(sql, normalized);
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const id = Number(row.subject_id);
    const name = typeof row.subject_name === "string" ? row.subject_name : null;
    if (Number.isFinite(id) && name) {
      map.set(name, id);
    }
  });

  return map;
}

async function countAssignedStudentsBySubject(
  teacherId: string | null,
  subjectMap: Map<string, number>,
): Promise<SubjectCounts> {
  const empty: SubjectCounts = { ...DEFAULT_COUNTS };
  if (!teacherId) {
    return empty;
  }

  const assignmentColumns = await safeGetColumns(ASSIGNMENT_TABLE);
  if (!assignmentColumns.size || !assignmentColumns.has("teacher_id") || !assignmentColumns.has("subject_id")) {
    return empty;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, COUNT(DISTINCT student_id) AS total
     FROM \`${ASSIGNMENT_TABLE}\`
     WHERE is_active = 1 AND teacher_id = ?
     GROUP BY subject_id`,
    [teacherId],
  );

  const inverted = new Map<number, SubjectName>();
  subjectMap.forEach((id, name) => {
    const subjectName = SUBJECT_NAMES.find((label) => label.toLowerCase() === name);
    if (subjectName) {
      inverted.set(id, subjectName);
    }
  });

  const counts: SubjectCounts = { ...DEFAULT_COUNTS };
  rows.forEach((row) => {
    const subjectId = Number(row.subject_id);
    const total = Number(row.total);
    if (!Number.isFinite(subjectId) || !Number.isFinite(total)) {
      return;
    }
    const label = inverted.get(subjectId);
    if (label) {
      counts[label] = total;
    }
  });

  return counts;
}

async function loadTeacherTrends(
  teacherId: string | null,
  subjectMap: Map<string, number>,
): Promise<TrendPayload> {
  if (!teacherId) {
    return { ...DEFAULT_TRENDS, months: buildRecentMonths() };
  }

  const [assignmentColumns, sessionColumns, phonemicColumns] = await Promise.all([
    safeGetColumns(ASSIGNMENT_TABLE),
    safeGetColumns(STUDENT_REMEDIAL_SESSION_TABLE),
    safeGetColumns(PHONEMIC_LEVEL_TABLE),
  ]);

  const assignmentStudentColumn = pickColumn(assignmentColumns, STUDENT_ID_COLUMNS);
  const assignmentTeacherColumn = assignmentColumns.has("teacher_id")
    ? "teacher_id"
    : pickColumn(assignmentColumns, TEACHER_IDENTIFIER_COLUMNS);

  const sessionStudentColumn = pickColumn(sessionColumns, STUDENT_ID_COLUMNS);
  const sessionSubjectColumn = pickColumn(sessionColumns, SUBJECT_ID_COLUMNS);
  const sessionPhonemicColumn = pickColumn(sessionColumns, SESSION_PHONEMIC_COLUMNS);
  const sessionCompletedColumn = pickColumn(sessionColumns, SESSION_COMPLETED_COLUMNS);
  const sessionCreatedColumn = pickColumn(sessionColumns, SESSION_CREATED_COLUMNS);

  if (!assignmentStudentColumn || !assignmentTeacherColumn || !sessionStudentColumn || !sessionSubjectColumn || !sessionPhonemicColumn) {
    return { ...DEFAULT_TRENDS, months: buildRecentMonths() };
  }

  const months = buildRecentMonths();
  const monthKeys = new Set(months.map((month) => month.key));

  const subjectIds = SUBJECT_NAMES.map((name) => subjectMap.get(name.toLowerCase())).filter((id): id is number => Number.isFinite(id));
  if (!subjectIds.length || !phonemicColumns.has("phonemic_id") || !phonemicColumns.has("level_name") || !phonemicColumns.has("subject_id")) {
    return { ...DEFAULT_TRENDS, months };
  }

  const placeholders = subjectIds.map(() => "?").join(", ");
  const [levelRows] = await query<RowDataPacket[]>(
    `SELECT phonemic_id, subject_id, level_name
     FROM ${PHONEMIC_LEVEL_TABLE}
     WHERE subject_id IN (${placeholders})
     ORDER BY subject_id ASC, phonemic_id ASC`,
    subjectIds,
  );

  const levelLabelsBySubject = new Map<number, string[]>();
  const levelIndexByPhonemic = new Map<number, number>();
  for (const row of levelRows ?? []) {
    const subjectId = Number(row.subject_id);
    const phonemicId = Number(row.phonemic_id);
    const levelName = typeof row.level_name === "string" ? row.level_name.trim() : "";
    if (!Number.isFinite(subjectId) || !Number.isFinite(phonemicId) || !levelName) {
      continue;
    }
    if (!levelLabelsBySubject.has(subjectId)) {
      levelLabelsBySubject.set(subjectId, []);
    }
    const list = levelLabelsBySubject.get(subjectId)!;
    list.push(levelName);
    levelIndexByPhonemic.set(phonemicId, list.length);
  }

  const activeColumn = assignmentColumns.has("is_active") ? "is_active" : null;
  const activeClause = activeColumn ? ` AND a.${activeColumn} = 1` : "";
  const dateSelectParts = [
    sessionCompletedColumn ? `s.${sessionCompletedColumn} AS completed_at` : "NULL AS completed_at",
    sessionCreatedColumn ? `s.${sessionCreatedColumn} AS created_at` : "NULL AS created_at",
  ];

  const [sessionRows] = await query<RowDataPacket[]>(
    `SELECT s.${sessionSubjectColumn} AS subject_id,
            s.${sessionPhonemicColumn} AS phonemic_id,
            ${dateSelectParts.join(", ")}
     FROM ${STUDENT_REMEDIAL_SESSION_TABLE} s
     JOIN ${ASSIGNMENT_TABLE} a ON a.${assignmentStudentColumn} = s.${sessionStudentColumn}
     WHERE a.${assignmentTeacherColumn} = ?${activeClause}`,
    [teacherId],
  );

  const subjects: Record<SubjectName, TrendSubjectData> = {
    English: { weekly: [0, 0, 0, 0], monthly: months.map(() => 0), levelLabels: [], levelDistributionByMonth: {} },
    Filipino: { weekly: [0, 0, 0, 0], monthly: months.map(() => 0), levelLabels: [], levelDistributionByMonth: {} },
    Math: { weekly: [0, 0, 0, 0], monthly: months.map(() => 0), levelLabels: [], levelDistributionByMonth: {} },
  };

  const subjectLookup = new Map<number, SubjectName>();
  SUBJECT_NAMES.forEach((name) => {
    const id = subjectMap.get(name.toLowerCase());
    if (Number.isFinite(id)) {
      subjectLookup.set(Number(id), name);
    }
  });

  const sumsBySubjectMonth = new Map<SubjectName, number[]>();
  const countsBySubjectMonth = new Map<SubjectName, number[]>();
  const sumsBySubjectWeek = new Map<SubjectName, number[]>();
  const countsBySubjectWeek = new Map<SubjectName, number[]>();

  SUBJECT_NAMES.forEach((name) => {
    sumsBySubjectMonth.set(name, months.map(() => 0));
    countsBySubjectMonth.set(name, months.map(() => 0));
    sumsBySubjectWeek.set(name, [0, 0, 0, 0]);
    countsBySubjectWeek.set(name, [0, 0, 0, 0]);
  });

  const monthIndexLookup = new Map<string, number>();
  months.forEach((month, index) => monthIndexLookup.set(month.key, index));

  const currentMonthKey = getMonthKey(new Date());

  for (const row of sessionRows ?? []) {
    const subjectId = Number(row.subject_id);
    const phonemicId = Number(row.phonemic_id);
    if (!Number.isFinite(subjectId) || !Number.isFinite(phonemicId)) {
      continue;
    }

    const subjectName = subjectLookup.get(subjectId);
    if (!subjectName) {
      continue;
    }

    const levelIndex = levelIndexByPhonemic.get(phonemicId);
    if (!levelIndex) {
      continue;
    }

    const completedRaw = row.completed_at ?? row.created_at;
    if (!completedRaw) {
      continue;
    }
    const date = completedRaw instanceof Date ? completedRaw : new Date(completedRaw);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const monthKey = getMonthKey(date);
    const monthIndex = monthIndexLookup.get(monthKey);
    if (monthIndex === undefined || !monthKeys.has(monthKey)) {
      continue;
    }

    const monthSums = sumsBySubjectMonth.get(subjectName)!;
    const monthCounts = countsBySubjectMonth.get(subjectName)!;
    monthSums[monthIndex] += levelIndex;
    monthCounts[monthIndex] += 1;

    const levelLabels = levelLabelsBySubject.get(subjectId) ?? [];
    if (levelLabels.length) {
      subjects[subjectName].levelLabels = levelLabels;
      if (!subjects[subjectName].levelDistributionByMonth[monthKey]) {
        subjects[subjectName].levelDistributionByMonth[monthKey] = levelLabels.map(() => 0);
      }
      const distribution = subjects[subjectName].levelDistributionByMonth[monthKey];
      const index = levelIndex - 1;
      if (distribution[index] !== undefined) {
        distribution[index] += 1;
      }
    }

    if (monthKey === currentMonthKey) {
      const weekIndex = getWeekIndex(date) - 1;
      const weekSums = sumsBySubjectWeek.get(subjectName)!;
      const weekCounts = countsBySubjectWeek.get(subjectName)!;
      weekSums[weekIndex] += levelIndex;
      weekCounts[weekIndex] += 1;
    }
  }

  SUBJECT_NAMES.forEach((name) => {
    const monthSums = sumsBySubjectMonth.get(name)!;
    const monthCounts = countsBySubjectMonth.get(name)!;
    const weekSums = sumsBySubjectWeek.get(name)!;
    const weekCounts = countsBySubjectWeek.get(name)!;

    subjects[name].monthly = monthSums.map((sum, index) =>
      monthCounts[index] ? Number((sum / monthCounts[index]).toFixed(2)) : 0,
    );
    subjects[name].weekly = weekSums.map((sum, index) =>
      weekCounts[index] ? Number((sum / weekCounts[index]).toFixed(2)) : 0,
    );
  });

  return {
    months,
    weeks: DEFAULT_TRENDS.weeks,
    subjects,
  };
}


export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid userId value." },
      { status: 400 },
    );
  }

  try {
    const [userColumns, teacherColumns, teacherHandledColumns, studentColumns] = await Promise.all([
      safeGetColumns(USERS_TABLE),
      safeGetColumns(TEACHER_TABLE),
      safeGetColumns(TEACHER_HANDLED_TABLE),
      safeGetColumns(STUDENT_TABLE),
    ]);

    if (!userColumns.size || !studentColumns.size) {
      return NextResponse.json(
        { success: false, error: "Required tables are unavailable." },
        { status: 500 },
      );
    }

    const teacherIds = await collectTeacherIdentifiers(userId, userColumns, teacherColumns);
    if (!teacherIds.length) {
      return NextResponse.json(
        { success: false, error: "No teacher record found for the provided user." },
        { status: 404 },
      );
    }

    const gradeIds = await loadHandledGradeIds(teacherIds, teacherHandledColumns);
    const [subjectMap, teacherId] = await Promise.all([
      resolveSubjectIds(SUBJECT_NAMES),
      resolveTeacherId(userId, teacherColumns),
    ]);

    const [assignedCounts, trends] = await Promise.all([
      countAssignedStudentsBySubject(teacherId, subjectMap),
      loadTeacherTrends(teacherId, subjectMap),
    ]);
    return NextResponse.json({
      success: true,
      counts: assignedCounts,
      trends,
      metadata: {
        teacherIds,
        gradeIds,
        hasHandledGrades: gradeIds.length > 0,
        source: "assignments",
      },
    });
  } catch (error) {
    console.error("Failed to load teacher dashboard counts", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
