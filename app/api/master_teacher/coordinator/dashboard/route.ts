import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["teacher"] as const;
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;
const MT_COORDINATOR_TABLE = "mt_coordinator_handled";
const STUDENT_SUBJECT_ASSESSMENT_TABLE = "student_subject_assessment";

const GRADE_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ROMAN_NUMERAL_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const STUDENT_TEXT_GRADE_COLUMNS = [
  "grade_level",
  "grade",
  "year_level",
  "handled_grade",
] as const;

const TEACHER_TEXT_GRADE_COLUMNS = [
  "handled_grade",
  "teacher_handled_grade",
  "grade",
  "grade_level",
  "gradeLevel",
  "year_level",
  "grade_section",
] as const;

const TEACHER_IDENTIFIER_COLUMNS = [
  "teacher_id",
  "teacherid",
  "employee_id",
  "faculty_id",
  "user_id",
  "id",
] as const;

type GradeContext = {
  gradeValue: string;
  gradeNumber: number | null;
  gradeTerms: string[];
  gradeIds: number[];
};

async function safeGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
}

async function resolveSubjectTable(): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of SUBJECT_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size > 0) {
      return { table: candidate, columns };
    }
  }
  return { table: null, columns: new Set<string>() };
}

function extractGradeNumber(raw: string): number | null {
  const digitMatch = raw.match(/(\d+)/);
  if (digitMatch) {
    const parsed = Number(digitMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const romanMatch = raw.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
  if (romanMatch) {
    const mapped = ROMAN_NUMERAL_TO_NUMBER[romanMatch[1].toLowerCase()];
    return Number.isFinite(mapped) ? mapped : null;
  }

  const wordMatch = raw.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (wordMatch) {
    const mapped = GRADE_WORD_TO_NUMBER[wordMatch[1].toLowerCase()];
    return Number.isFinite(mapped) ? mapped : null;
  }

  return null;
}

function buildGradeTerms(raw: string): string[] {
  const terms = new Set<string>();
  const trimmed = raw.trim().toLowerCase();
  if (trimmed) {
    terms.add(trimmed);
  }

  const numeric = extractGradeNumber(trimmed);
  if (numeric !== null) {
    terms.add(String(numeric));
    terms.add(`grade ${numeric}`);
  }

  const wordMatch = trimmed.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (wordMatch) {
    terms.add(wordMatch[1]);
    terms.add(`grade ${wordMatch[1]}`);
  }

  const romanMatch = trimmed.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/);
  if (romanMatch) {
    terms.add(romanMatch[1]);
    terms.add(`grade ${romanMatch[1]}`);
  }

  return Array.from(terms).filter(Boolean);
}

async function resolveGradeIds(gradeNumber: number | null, gradeTerms: string[]): Promise<number[]> {
  const columns = await safeGetColumns("grade");
  if (!columns.size || !columns.has("grade_id")) {
    return gradeNumber !== null ? [gradeNumber] : [];
  }

  const labelColumn = columns.has("grade_level")
    ? "grade_level"
    : columns.has("grade")
      ? "grade"
      : columns.has("level")
        ? "level"
        : null;

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (gradeNumber !== null) {
    clauses.push("CAST(grade_id AS SIGNED) = ?");
    params.push(gradeNumber);
  }

  if (labelColumn) {
    gradeTerms.forEach((term) => {
      clauses.push(`LOWER(CAST(${labelColumn} AS CHAR)) LIKE ?`);
      params.push(`%${term.toLowerCase()}%`);
    });
  }

  if (!clauses.length) {
    return gradeNumber !== null ? [gradeNumber] : [];
  }

  const sql = `SELECT DISTINCT grade_id FROM grade WHERE ${clauses.map((clause) => `(${clause})`).join(" OR ")}`;
  const [rows] = await query<RowDataPacket[]>(sql, params);

  const ids: number[] = [];
  for (const row of rows ?? []) {
    const parsed = Number(row.grade_id);
    if (Number.isFinite(parsed)) {
      ids.push(parsed);
    }
  }

  if (!ids.length && gradeNumber !== null) {
    return [gradeNumber];
  }
  return ids;
}

async function buildGradeContext(raw: string): Promise<GradeContext> {
  const trimmed = raw.trim();
  const gradeNumber = extractGradeNumber(trimmed);
  const gradeTerms = buildGradeTerms(trimmed);
  const gradeIds = await resolveGradeIds(gradeNumber, gradeTerms);
  return {
    gradeValue: trimmed,
    gradeNumber,
    gradeTerms,
    gradeIds,
  } satisfies GradeContext;
}

function buildGradeContextFromIds(gradeIds: number[]): GradeContext {
  const normalized = gradeIds.filter((value) => Number.isFinite(value));
  const primary = normalized.length ? normalized[0] : null;
  const gradeValue = primary !== null ? `Grade ${primary}` : "";
  const gradeNumber = primary !== null ? primary : null;
  const gradeTerms = primary !== null ? buildGradeTerms(String(primary)) : [];
  return {
    gradeValue,
    gradeNumber,
    gradeTerms,
    gradeIds: normalized,
  } satisfies GradeContext;
}

function normalizeIdValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function applyTextColumnClauses(
  clauses: string[],
  params: Array<string | number>,
  columnRef: string,
  context: GradeContext,
) {
  const columnClauses: string[] = [];
  if (context.gradeNumber !== null) {
    columnClauses.push(`CAST(${columnRef} AS SIGNED) = ?`);
    params.push(context.gradeNumber);
  }
  context.gradeTerms.forEach((term) => {
    columnClauses.push(`LOWER(CAST(${columnRef} AS CHAR)) LIKE ?`);
    params.push(`%${term.toLowerCase()}%`);
  });
  if (columnClauses.length) {
    clauses.push(`(${columnClauses.join(" OR ")})`);
  }
}

async function countStudentsByGrade(context: GradeContext): Promise<number> {
  const columns = await safeGetColumns("student");
  if (!columns.size) {
    return 0;
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (columns.has("grade_id")) {
    if (context.gradeIds.length) {
      clauses.push(`s.grade_id IN (${context.gradeIds.map(() => "?").join(", ")})`);
      params.push(...context.gradeIds);
    } else if (context.gradeNumber !== null) {
      clauses.push("s.grade_id = ?");
      params.push(context.gradeNumber);
    }
  }

  STUDENT_TEXT_GRADE_COLUMNS.forEach((column) => {
    if (!columns.has(column)) {
      return;
    }
    applyTextColumnClauses(clauses, params, `s.${column}`, context);
  });

  if (!clauses.length) {
    return 0;
  }

  const whereClause = clauses.map((clause) => `(${clause})`).join(" OR ");
  const sql = `SELECT COUNT(DISTINCT s.student_id) AS total FROM \`student\` s WHERE ${whereClause}`;
  const [rows] = await query<RowDataPacket[]>(sql, params);
  const totalRaw = rows?.[0]?.total ?? 0;
  return Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : 0;
}

async function resolveSubjectIdsByName(subjectRaw: string): Promise<number[]> {
  const trimmed = subjectRaw.trim();
  if (!trimmed) {
    return [];
  }

  const { table, columns } = await resolveSubjectTable();
  if (!table || !columns.size || !columns.has("subject_id")) {
    return [];
  }

  const nameColumn = columns.has("subject_name")
    ? "subject_name"
    : columns.has("name")
      ? "name"
      : null;

  if (!nameColumn) {
    return [];
  }

  const term = trimmed.toLowerCase();
  const [rows] = await query<RowDataPacket[]>(
    `SELECT DISTINCT subject_id FROM \`${table}\` WHERE LOWER(CAST(${nameColumn} AS CHAR)) = ? OR LOWER(CAST(${nameColumn} AS CHAR)) LIKE ?`,
    [term, `%${term}%`],
  );

  return (rows ?? [])
    .map((row) => Number(row.subject_id))
    .filter((value): value is number => Number.isFinite(value));
}

async function countStudentsByGradeAndSubject(
  context: GradeContext,
  subjectIds: number[],
): Promise<number> {
  if (!subjectIds.length) {
    return 0;
  }

  const [studentColumns, assessmentColumns] = await Promise.all([
    safeGetColumns("student"),
    safeGetColumns(STUDENT_SUBJECT_ASSESSMENT_TABLE),
  ]);

  if (!studentColumns.size || !assessmentColumns.size) {
    return 0;
  }

  const studentIdColumn = studentColumns.has("student_id")
    ? "student_id"
    : studentColumns.has("id")
      ? "id"
      : null;

  if (!studentIdColumn || !assessmentColumns.has("student_id") || !assessmentColumns.has("subject_id")) {
    return 0;
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  clauses.push(`ssa.subject_id IN (${subjectIds.map(() => "?").join(", ")})`);
  params.push(...subjectIds);

  if (studentColumns.has("grade_id")) {
    if (context.gradeIds.length) {
      clauses.push(`s.grade_id IN (${context.gradeIds.map(() => "?").join(", ")})`);
      params.push(...context.gradeIds);
    } else if (context.gradeNumber !== null) {
      clauses.push("s.grade_id = ?");
      params.push(context.gradeNumber);
    }
  }

  STUDENT_TEXT_GRADE_COLUMNS.forEach((column) => {
    if (!studentColumns.has(column)) {
      return;
    }
    applyTextColumnClauses(clauses, params, `s.${column}`, context);
  });

  if (!clauses.length) {
    return 0;
  }

  const sql = `
    SELECT COUNT(DISTINCT s.${studentIdColumn}) AS total
    FROM \`${STUDENT_SUBJECT_ASSESSMENT_TABLE}\` ssa
    JOIN \`student\` s ON s.${studentIdColumn} = ssa.student_id
    WHERE ${clauses.map((clause) => `(${clause})`).join(" AND ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  const totalRaw = rows?.[0]?.total ?? 0;
  return Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : 0;
}

async function countStudentsByHandledPairs(
  pairs: Array<{ gradeId: number; subjectId: number }>,
): Promise<number> {
  if (!pairs.length) {
    return 0;
  }

  const [studentColumns, assessmentColumns] = await Promise.all([
    safeGetColumns("student"),
    safeGetColumns(STUDENT_SUBJECT_ASSESSMENT_TABLE),
  ]);

  if (!studentColumns.size || !assessmentColumns.size) {
    return 0;
  }

  const studentIdColumn = studentColumns.has("student_id")
    ? "student_id"
    : studentColumns.has("id")
      ? "id"
      : null;

  if (!studentIdColumn || !studentColumns.has("grade_id") || !assessmentColumns.has("student_id") || !assessmentColumns.has("subject_id")) {
    return 0;
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  pairs.forEach((pair) => {
    clauses.push("(ssa.subject_id = ? AND s.grade_id = ?)");
    params.push(pair.subjectId, pair.gradeId);
  });

  const sql = `
    SELECT COUNT(DISTINCT s.${studentIdColumn}) AS total
    FROM \`${STUDENT_SUBJECT_ASSESSMENT_TABLE}\` ssa
    JOIN \`student\` s ON s.${studentIdColumn} = ssa.student_id
    WHERE ${clauses.join(" OR ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  const totalRaw = rows?.[0]?.total ?? 0;
  return Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : 0;
}

async function loadHandledPairs(masterTeacherId: string): Promise<Array<{ gradeId: number; subjectId: number }>> {
  if (!masterTeacherId.trim()) {
    return [];
  }

  const columns = await safeGetColumns(MT_COORDINATOR_TABLE);
  if (!columns.size || !columns.has("master_teacher_id") || !columns.has("grade_id") || !columns.has("subject_id")) {
    return [];
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT DISTINCT grade_id, subject_id FROM \`${MT_COORDINATOR_TABLE}\` WHERE master_teacher_id = ?`,
    [masterTeacherId],
  );

  return (rows ?? [])
    .map((row) => ({
      gradeId: Number(row.grade_id),
      subjectId: Number(row.subject_id),
    }))
    .filter((row) => Number.isFinite(row.gradeId) && Number.isFinite(row.subjectId));
}

async function buildUserRoleFilter(columns: Set<string>): Promise<{ sql: string | null; params: Array<string | number> }>
{
  if (columns.has("role")) {
    const placeholders = ROLE_FILTERS.map(() => "?").join(", ");
    return {
      sql: `LOWER(role) IN (${placeholders})`,
      params: ROLE_FILTERS.map((role) => role.toLowerCase()),
    };
  }

  if (columns.has("role_id")) {
    const roleColumns = await safeGetColumns("role");
    if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
      const placeholders = ROLE_FILTERS.map(() => "?").join(", ");
      const [roleRows] = await query<RowDataPacket[]>(
        `SELECT role_id FROM role WHERE LOWER(role_name) IN (${placeholders})`,
        ROLE_FILTERS.map((role) => role.toLowerCase()),
      );
      const roleIds = (roleRows ?? [])
        .map((row) => Number(row.role_id))
        .filter((value): value is number => Number.isFinite(value));
      if (roleIds.length) {
        return {
          sql: `role_id IN (${roleIds.map(() => "?").join(", ")})`,
          params: roleIds,
        };
      }
    }
  }

  return { sql: null, params: [] };
}

async function collectTeacherIdsFromTeacherTable(
  columns: Set<string>,
  context: GradeContext,
): Promise<string[]> {
  if (!columns.size) {
    return [];
  }

  const identifier = TEACHER_IDENTIFIER_COLUMNS.find((column) => columns.has(column));
  if (!identifier) {
    return [];
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (columns.has("grade_id")) {
    if (context.gradeIds.length) {
      clauses.push(`grade_id IN (${context.gradeIds.map(() => "?").join(", ")})`);
      params.push(...context.gradeIds);
    } else if (context.gradeNumber !== null) {
      clauses.push("grade_id = ?");
      params.push(context.gradeNumber);
    }
  }

  TEACHER_TEXT_GRADE_COLUMNS.forEach((column) => {
    if (!columns.has(column)) {
      return;
    }
    applyTextColumnClauses(clauses, params, column, context);
  });

  if (!clauses.length) {
    return [];
  }

  const sql = `
    SELECT DISTINCT ${identifier} AS teacher_id
    FROM \`teacher\`
    WHERE ${clauses.map((clause) => `(${clause})`).join(" OR ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  return (rows ?? [])
    .map((row) => normalizeIdValue(row.teacher_id))
    .filter((value): value is string => Boolean(value));
}

async function collectTeacherIdsFromTeacherHandled(
  columns: Set<string>,
  context: GradeContext,
): Promise<string[]> {
  if (!columns.size || !columns.has("teacher_id")) {
    return [];
  }

  if (!columns.has("grade_id") && context.gradeNumber === null && !context.gradeIds.length) {
    return [];
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (columns.has("grade_id")) {
    if (context.gradeIds.length) {
      clauses.push(`grade_id IN (${context.gradeIds.map(() => "?").join(", ")})`);
      params.push(...context.gradeIds);
    } else if (context.gradeNumber !== null) {
      clauses.push("grade_id = ?");
      params.push(context.gradeNumber);
    }
  }

  if (!clauses.length) {
    return [];
  }

  const sql = `
    SELECT DISTINCT teacher_id
    FROM \`teacher_handled\`
    WHERE ${clauses.map((clause) => `(${clause})`).join(" OR ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  return (rows ?? [])
    .map((row) => normalizeIdValue(row.teacher_id))
    .filter((value): value is string => Boolean(value));
}

async function collectTeacherIdsFromUsers(
  columns: Set<string>,
  context: GradeContext,
): Promise<string[]> {
  if (!columns.size) {
    return [];
  }

  const identifier = columns.has("teacher_id") ? "teacher_id" : columns.has("user_id") ? "user_id" : null;
  if (!identifier) {
    return [];
  }

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (columns.has("grade_id")) {
    if (context.gradeIds.length) {
      clauses.push(`grade_id IN (${context.gradeIds.map(() => "?").join(", ")})`);
      params.push(...context.gradeIds);
    } else if (context.gradeNumber !== null) {
      clauses.push("grade_id = ?");
      params.push(context.gradeNumber);
    }
  }

  TEACHER_TEXT_GRADE_COLUMNS.forEach((column) => {
    if (!columns.has(column)) {
      return;
    }
    applyTextColumnClauses(clauses, params, column, context);
  });

  if (!clauses.length) {
    return [];
  }

  const roleFilter = await buildUserRoleFilter(columns);

  const whereParts = [`(${clauses.map((clause) => `(${clause})`).join(" OR ")})`];
  if (roleFilter.sql) {
    whereParts.push(`(${roleFilter.sql})`);
  }

  const sql = `
    SELECT DISTINCT ${identifier} AS teacher_id
    FROM \`users\`
    WHERE ${whereParts.join(" AND ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, [...params, ...roleFilter.params]);
  return (rows ?? [])
    .map((row) => normalizeIdValue(row.teacher_id))
    .filter((value): value is string => Boolean(value));
}

async function collectTeacherIds(context: GradeContext): Promise<Set<string>> {
  const [teacherColumns, teacherHandledColumns, userColumns] = await Promise.all([
    safeGetColumns("teacher"),
    safeGetColumns("teacher_handled"),
    safeGetColumns("users"),
  ]);

  const identifiers = new Set<string>();
  const addIdentifiers = (values: string[]) => {
    values.forEach((value) => identifiers.add(value));
  };

  addIdentifiers(await collectTeacherIdsFromTeacherTable(teacherColumns, context));
  addIdentifiers(await collectTeacherIdsFromTeacherHandled(teacherHandledColumns, context));
  addIdentifiers(await collectTeacherIdsFromUsers(userColumns, context));

  return identifiers;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const gradeParam = url.searchParams.get("grade");
    const subjectParam = url.searchParams.get("subject");
    const userIdParam = url.searchParams.get("userId");

    let context: GradeContext | null = null;
    if (gradeParam && gradeParam.trim()) {
      context = await buildGradeContext(gradeParam);
    }

    const handledPairs = userIdParam ? await loadHandledPairs(String(userIdParam)) : [];

    let studentTotal = 0;
    let teacherIdentifiers = new Set<string>();

    if (handledPairs.length > 0) {
      studentTotal = await countStudentsByHandledPairs(handledPairs);
      const gradeIds = Array.from(new Set(handledPairs.map((pair) => pair.gradeId)));
      const gradeContext = gradeIds.length ? buildGradeContextFromIds(gradeIds) : context;
      if (gradeContext) {
        teacherIdentifiers = await collectTeacherIds(gradeContext);
        context = gradeContext;
      }
    } else {
      if (!context) {
        return NextResponse.json(
          { success: false, error: "Grade parameter is required." },
          { status: 400 },
        );
      }

      if (!subjectParam || !subjectParam.trim()) {
        return NextResponse.json(
          { success: false, error: "Subject parameter is required." },
          { status: 400 },
        );
      }

      const subjectIds = await resolveSubjectIdsByName(subjectParam);
      studentTotal = await countStudentsByGradeAndSubject(context, subjectIds);
      teacherIdentifiers = await collectTeacherIds(context);
    }

    return NextResponse.json({
      success: true,
      data: {
        students: studentTotal,
        teachers: teacherIdentifiers.size,
      },
      metadata: {
        grade: context?.gradeValue ?? null,
        matchedGradeIds: context?.gradeIds ?? [],
      },
    });
  } catch (error) {
    console.error("Failed to load coordinator dashboard counts", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
