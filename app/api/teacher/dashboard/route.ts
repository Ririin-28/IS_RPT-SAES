import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_TABLE = "subject" as const;
const STUDENT_TABLE = "student" as const;
const STUDENT_SUBJECT_ASSESSMENT_TABLE = "student_subject_assessment" as const;
const ASSIGNMENT_TABLE = "student_teacher_assignment" as const;
const TEACHER_TABLE = "teacher" as const;
const TEACHER_HANDLED_TABLE = "teacher_handled" as const;
const USERS_TABLE = "users" as const;

const SUBJECT_NAMES = ["English", "Filipino", "Math"] as const;
type SubjectName = (typeof SUBJECT_NAMES)[number];
type SubjectCounts = Record<SubjectName, number>;

type SubjectCountSource = {
  table: string;
  studentColumn: string;
  subjectColumn: string;
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

const DEFAULT_COUNTS: SubjectCounts = {
  English: 0,
  Filipino: 0,
  Math: 0,
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
): Promise<SubjectCounts | null> {
  if (!teacherId) {
    return null;
  }

  const assignmentColumns = await safeGetColumns(ASSIGNMENT_TABLE);
  if (!assignmentColumns.size || !assignmentColumns.has("teacher_id") || !assignmentColumns.has("subject_id")) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, COUNT(DISTINCT student_id) AS total
     FROM \`${ASSIGNMENT_TABLE}\`
     WHERE is_active = 1 AND teacher_type = 'regular_teacher' AND teacher_id = ?
     GROUP BY subject_id`,
    [teacherId],
  );

  if (!rows.length) {
    return null;
  }

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

async function resolveSubjectCountSource(): Promise<SubjectCountSource | null> {
  const assessmentColumns = await safeGetColumns(STUDENT_SUBJECT_ASSESSMENT_TABLE);
  if (assessmentColumns.size) {
    const studentColumn = pickColumn(assessmentColumns, STUDENT_ID_COLUMNS);
    const subjectColumn = pickColumn(assessmentColumns, SUBJECT_ID_COLUMNS);
    if (studentColumn && subjectColumn) {
      return {
        table: STUDENT_SUBJECT_ASSESSMENT_TABLE,
        studentColumn,
        subjectColumn,
      } satisfies SubjectCountSource;
    }
  }

  return null;
}

async function countStudentsBySubject(
  gradeIds: number[],
  subjectMap: Map<string, number>,
  countSource: SubjectCountSource | null,
  studentColumns: Set<string>,
): Promise<SubjectCounts> {
  const counts: SubjectCounts = { ...DEFAULT_COUNTS };
  if (!gradeIds.length || !countSource || !studentColumns.size) {
    return counts;
  }

  if (!studentColumns.has("grade_id")) {
    return counts;
  }

  const studentIdColumn = pickColumn(studentColumns, STUDENT_ID_COLUMNS);
  if (!studentIdColumn) {
    return counts;
  }

  const resolvedSubjects = SUBJECT_NAMES.map((name) => {
    const id = subjectMap.get(name.toLowerCase());
    return Number.isFinite(id) ? Number(id) : null;
  });

  const activeSubjectIds = resolvedSubjects.filter((value): value is number => Number.isFinite(value));
  if (!activeSubjectIds.length) {
    return counts;
  }

  const gradePlaceholders = gradeIds.map(() => "?").join(", ");
  const subjectPlaceholders = activeSubjectIds.map(() => "?").join(", ");

  const sql = `
    SELECT ss.${countSource.subjectColumn} AS subject_id,
           COUNT(DISTINCT s.${studentIdColumn}) AS total
    FROM \`${countSource.table}\` AS ss
    JOIN \`${STUDENT_TABLE}\` AS s ON s.${studentIdColumn} = ss.${countSource.studentColumn}
    WHERE s.grade_id IN (${gradePlaceholders})
      AND ss.${countSource.subjectColumn} IN (${subjectPlaceholders})
    GROUP BY ss.${countSource.subjectColumn}
  `;

  const params = [...gradeIds, ...activeSubjectIds];
  const [rows] = await query<RowDataPacket[]>(sql, params);

  const inverted = new Map<number, SubjectName>();
  resolvedSubjects.forEach((id, index) => {
    if (id !== null) {
      inverted.set(id, SUBJECT_NAMES[index]);
    }
  });

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
    const [subjectMap, countSource, teacherId] = await Promise.all([
      resolveSubjectIds(SUBJECT_NAMES),
      resolveSubjectCountSource(),
      resolveTeacherId(userId, teacherColumns),
    ]);

    const assignedCounts = await countAssignedStudentsBySubject(teacherId, subjectMap);
    if (assignedCounts) {
      return NextResponse.json({
        success: true,
        counts: assignedCounts,
        metadata: {
          teacherIds,
          gradeIds,
          hasHandledGrades: gradeIds.length > 0,
          source: "assignments",
        },
      });
    }

    if (!countSource) {
      return NextResponse.json(
        { success: false, error: "Subject relationship tables are unavailable." },
        { status: 500 },
      );
    }

    const counts = await countStudentsBySubject(gradeIds, subjectMap, countSource, studentColumns);

    return NextResponse.json({
      success: true,
      counts,
      metadata: {
        teacherIds,
        gradeIds,
        hasHandledGrades: gradeIds.length > 0,
      },
    });
  } catch (error) {
    console.error("Failed to load teacher dashboard counts", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
