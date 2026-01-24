import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const STUDENT_TABLE = "student" as const;
const MASTER_TEACHER_TABLE = "master_teacher" as const;
const HANDLED_TABLE = "mt_remedialteacher_handled" as const;
const SUBJECT_TABLE = "subject" as const;
const STUDENT_SUBJECT_ASSESSMENT_TABLE = "student_subject_assessment" as const;
const ASSIGNMENT_TABLE = "student_teacher_assignment" as const;

const SUBJECT_NAMES = ["English", "Filipino", "Math"] as const;
type SubjectName = (typeof SUBJECT_NAMES)[number];

type SubjectCounts = Record<SubjectName, number>;

type GradeContext = {
  numericIds: number[];
  gradeTerms: string[];
  labels: string[];
  hasData: boolean;
};

type SubjectCountSource = {
  table: string;
  studentColumn: string;
  subjectColumn: string;
};

const STUDENT_ID_COLUMNS = [
  "student_id",
  "studentId",
  "studentID",
  "id",
] as const;

const SUBJECT_ID_COLUMNS = [
  "subject_id",
  "subjectId",
  "subjectID",
  "subjectid",
  "id",
] as const;

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
  "grade_section",
  "gradeLevel",
] as const;

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

async function resolveMasterTeacherIdentifiers(userId: number): Promise<string[]> {
  const identifiers = new Set<string>();
  identifiers.add(String(userId));

  const columns = await safeGetColumns(MASTER_TEACHER_TABLE);
  if (!columns.size || !columns.has("user_id")) {
    return Array.from(identifiers);
  }

  const hasMasterTeacherId = columns.has("master_teacher_id");
  const selectParts = ["user_id AS user_id"];
  if (hasMasterTeacherId) {
    selectParts.push("master_teacher_id AS master_teacher_id");
  }

  const sql = `SELECT ${selectParts.join(", ")} FROM \`${MASTER_TEACHER_TABLE}\` WHERE user_id = ? LIMIT 1`;
  const [rows] = await query<RowDataPacket[]>(sql, [userId]);

  if (!rows.length) {
    return Array.from(identifiers);
  }

  const row = rows[0];
  if (hasMasterTeacherId) {
    const mtId = sanitize(row.master_teacher_id);
    if (mtId) {
      identifiers.add(mtId);
    }
  }

  return Array.from(identifiers);
}

async function loadHandledGradeData(identifiers: string[]): Promise<{ gradeIds: number[]; labels: string[] }>
{
  if (!identifiers.length) {
    return { gradeIds: [], labels: [] };
  }

  const handledColumns = await safeGetColumns(HANDLED_TABLE);
  if (!handledColumns.size || !handledColumns.has("master_teacher_id")) {
    return { gradeIds: [], labels: [] };
  }

  const gradeIdColumn = handledColumns.has("grade_id") ? "grade_id" : null;
  const gradeLabelColumn = handledColumns.has("grade_level") ? "grade_level" : null;

  if (!gradeIdColumn && !gradeLabelColumn) {
    return { gradeIds: [], labels: [] };
  }

  const gradeColumns = gradeIdColumn ? await safeGetColumns("grade") : new Set<string>();
  const gradeTableLabelColumn = gradeColumns.size
    ? pickColumn(gradeColumns, ["grade_level", "grade", "level", "name", "label"])
    : null;

  const selectParts = ["mr.master_teacher_id"];
  if (gradeIdColumn) {
    selectParts.push(`mr.${gradeIdColumn} AS handled_grade_id`);
  }
  if (gradeLabelColumn) {
    selectParts.push(`mr.${gradeLabelColumn} AS handled_grade_label`);
  }
  if (gradeIdColumn && gradeTableLabelColumn) {
    selectParts.push(`g.${gradeTableLabelColumn} AS grade_table_label`);
  }

  const placeholders = identifiers.map(() => "?").join(", ");
  const joinClause = gradeIdColumn && gradeTableLabelColumn
    ? `LEFT JOIN grade g ON g.grade_id = mr.${gradeIdColumn}`
    : "";

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM \`${HANDLED_TABLE}\` AS mr
    ${joinClause}
    WHERE mr.master_teacher_id IN (${placeholders})
  `;

  const [rows] = await query<RowDataPacket[]>(sql, identifiers);

  const gradeIds: number[] = [];
  const labels: string[] = [];

  for (const row of rows ?? []) {
    if (gradeIdColumn) {
      const rawId = row.handled_grade_id ?? row[gradeIdColumn as keyof RowDataPacket];
      const parsed = Number(rawId);
      if (Number.isFinite(parsed)) {
        gradeIds.push(parsed);
      }
    }

    const labelCandidates: Array<string | null> = [];
    if (gradeLabelColumn) {
      const labelValue = row.handled_grade_label ?? row[gradeLabelColumn as keyof RowDataPacket];
      labelCandidates.push(sanitize(labelValue));
    }
    if (gradeTableLabelColumn) {
      const labelValue = row.grade_table_label ?? row[gradeTableLabelColumn as keyof RowDataPacket];
      labelCandidates.push(sanitize(labelValue));
    }

    labelCandidates.forEach((label) => {
      if (label) {
        labels.push(label);
      }
    });
  }

  return { gradeIds, labels };
}

function buildGradeContext(rawGradeIds: number[], rawLabels: string[]): GradeContext {
  const numericSet = new Set<number>();
  rawGradeIds.forEach((id) => {
    const parsed = Number(id);
    if (Number.isFinite(parsed)) {
      numericSet.add(parsed);
    }
  });

  const labelSet = new Set<string>();
  const termSet = new Set<string>();

  rawLabels.forEach((label) => {
    const text = sanitize(label);
    if (!text) {
      return;
    }
    labelSet.add(text);
    buildGradeTerms(text).forEach((term) => termSet.add(term));
    const extracted = extractGradeNumber(text);
    if (extracted !== null) {
      numericSet.add(extracted);
    }
  });

  numericSet.forEach((value) => {
    const term = String(value);
    termSet.add(term);
    termSet.add(`grade ${term}`);
  });

  return {
    numericIds: Array.from(numericSet),
    gradeTerms: Array.from(termSet),
    labels: Array.from(labelSet),
    hasData: numericSet.size > 0 || termSet.size > 0,
  } satisfies GradeContext;
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

  const normalizedNames = names.map((name) => name.trim().toLowerCase());
  const placeholders = normalizedNames.map(() => "?").join(", ");

  const sql = `
    SELECT subject_id, LOWER(${labelColumn}) AS subject_name
    FROM \`${SUBJECT_TABLE}\`
    WHERE LOWER(${labelColumn}) IN (${placeholders})
  `;

  const [rows] = await query<RowDataPacket[]>(sql, normalizedNames);
  const map = new Map<string, number>();

  for (const row of rows ?? []) {
    const id = Number(row.subject_id);
    const name = typeof row.subject_name === "string" ? row.subject_name : null;
    if (Number.isFinite(id) && name) {
      map.set(name, id);
    }
  }

  return map;
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

async function countAssignedStudentsBySubject(
  identifiers: string[],
  subjectMap: Map<string, number>,
): Promise<SubjectCounts | null> {
  if (!identifiers.length) {
    return null;
  }

  const assignmentColumns = await safeGetColumns(ASSIGNMENT_TABLE);
  if (!assignmentColumns.size || !assignmentColumns.has("master_teacher_id") || !assignmentColumns.has("subject_id")) {
    return null;
  }

  const placeholders = identifiers.map(() => "?").join(", ");
  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, COUNT(DISTINCT student_id) AS total
     FROM \`${ASSIGNMENT_TABLE}\`
     WHERE is_active = 1 AND teacher_type = 'master_remedial'
       AND master_teacher_id IN (${placeholders})
     GROUP BY subject_id`,
    identifiers,
  );

  if (!rows.length) {
    return null;
  }

  const inverted = new Map<number, SubjectName>();
  subjectMap.forEach((id, name) => {
    const label = SUBJECT_NAMES.find((subject) => subject.toLowerCase() === name);
    if (label) {
      inverted.set(id, label);
    }
  });

  const counts: SubjectCounts = {
    English: 0,
    Filipino: 0,
    Math: 0,
  };

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

function buildGradeFilterClause(
  studentColumns: Set<string>,
  alias: string,
  context: GradeContext,
): { sql: string | null; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (studentColumns.has("grade_id") && context.numericIds.length) {
    clauses.push(`${alias}.grade_id IN (${context.numericIds.map(() => "?").join(", ")})`);
    params.push(...context.numericIds);
  }

  for (const column of STUDENT_TEXT_GRADE_COLUMNS) {
    if (!studentColumns.has(column) || !context.gradeTerms.length) {
      continue;
    }
    const columnClauses: string[] = [];
    const columnParams: string[] = [];
    context.gradeTerms.forEach((term) => {
      columnClauses.push(`LOWER(CAST(${alias}.${column} AS CHAR)) LIKE ?`);
      columnParams.push(`%${term.toLowerCase()}%`);
    });
    if (columnClauses.length) {
      clauses.push(`(${columnClauses.join(" OR ")})`);
      params.push(...columnParams);
    }
  }

  if (!clauses.length) {
    return { sql: null, params: [] };
  }

  return {
    sql: clauses.map((clause) => `(${clause})`).join(" OR "),
    params,
  };
}

async function countStudentsBySubject(
  gradeContext: GradeContext,
  subjectMap: Map<string, number>,
  countSource: SubjectCountSource | null,
): Promise<SubjectCounts> {
  const empty: SubjectCounts = {
    English: 0,
    Filipino: 0,
    Math: 0,
  };

  if (!gradeContext.hasData || !countSource) {
    return empty;
  }

  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  if (!studentColumns.size) {
    return empty;
  }

  const studentIdColumn = pickColumn(studentColumns, STUDENT_ID_COLUMNS);

  if (!studentIdColumn) {
    return empty;
  }

  const gradeClause = buildGradeFilterClause(studentColumns, "s", gradeContext);
  if (!gradeClause.sql) {
    return empty;
  }

  const resolvedSubjects = SUBJECT_NAMES.map((name) => {
    const id = subjectMap.get(name.toLowerCase());
    return Number.isFinite(id) ? Number(id) : null;
  });

  const activeSubjects = resolvedSubjects.filter((value): value is number => Number.isFinite(value));
  if (!activeSubjects.length) {
    return empty;
  }

  const placeholders = activeSubjects.map(() => "?").join(", ");

  const sql = `
    SELECT ss.${countSource.subjectColumn} AS subject_id,
           COUNT(DISTINCT s.${studentIdColumn}) AS total
    FROM \`${countSource.table}\` AS ss
    JOIN \`${STUDENT_TABLE}\` AS s ON s.${studentIdColumn} = ss.${countSource.studentColumn}
    WHERE (${gradeClause.sql})
      AND ss.${countSource.subjectColumn} IN (${placeholders})
    GROUP BY ss.${countSource.subjectColumn}
  `;

  const params = [...gradeClause.params, ...activeSubjects];
  const [rows] = await query<RowDataPacket[]>(sql, params);

  const counts: SubjectCounts = { ...empty };
  const invertedMap = new Map<number, SubjectName>();
  resolvedSubjects.forEach((id, index) => {
    if (id !== null) {
      invertedMap.set(id, SUBJECT_NAMES[index]);
    }
  });

  for (const row of rows ?? []) {
    const subjectId = Number(row.subject_id);
    const total = Number(row.total);
    if (!Number.isFinite(subjectId) || !Number.isFinite(total)) {
      continue;
    }
    const subjectName = invertedMap.get(subjectId);
    if (subjectName) {
      counts[subjectName] = total;
    }
  }

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
    const [identifiers, subjectMap, countSource] = await Promise.all([
      resolveMasterTeacherIdentifiers(userId),
      resolveSubjectIds(SUBJECT_NAMES),
      resolveSubjectCountSource(),
    ]);

    const assignedCounts = await countAssignedStudentsBySubject(identifiers, subjectMap);
    if (assignedCounts) {
      return NextResponse.json({
        success: true,
        counts: assignedCounts,
        metadata: {
          gradeIds: [],
          gradeLabels: [],
          hasGradeContext: false,
          source: "assignments",
        },
      });
    }

    const handledData = await loadHandledGradeData(identifiers);
    const gradeContext = buildGradeContext(handledData.gradeIds, handledData.labels);

    const counts = await countStudentsBySubject(gradeContext, subjectMap, countSource);

    return NextResponse.json({
      success: true,
      counts,
      metadata: {
        gradeIds: gradeContext.numericIds,
        gradeLabels: gradeContext.labels,
        hasGradeContext: gradeContext.hasData,
      },
    });
  } catch (error) {
    console.error("Failed to load remedial dashboard data", error);
    return NextResponse.json(
      { success: false, error: "Failed to load remedial dashboard data." },
      { status: 500 },
    );
  }
}
