import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_TABLE = "users" as const;
const REMEDIAL_TABLE = "remedial_teachers" as const;
const STUDENT_TABLE = "student" as const;

const USER_ID_COLUMNS = ["user_id", "id"] as const;
const USER_FIRST_NAME_COLUMNS = ["first_name", "firstname", "given_name", "first"] as const;
const USER_MIDDLE_NAME_COLUMNS = ["middle_name", "middlename", "middle", "mi"] as const;
const USER_LAST_NAME_COLUMNS = ["last_name", "lastname", "surname", "family_name", "last"] as const;

const REMEDIAL_USER_COLUMNS = [
  "user_id",
  "teacher_id",
  "master_teacher_id",
  "remedial_teacher_id",
  "employee_id",
] as const;
const REMEDIAL_ID_COLUMNS = ["remedial_id", "remedial_teacher_id", "remedialid", "id"] as const;

const STUDENT_USER_COLUMNS = ["user_id", "student_user_id", "userId"] as const;
const STUDENT_ID_COLUMNS = [
  "student_id",
  "studentId",
  "studentID",
  "english_student_id",
  "filipino_student_id",
  "math_student_id",
  "eng_student_id",
  "fil_student_id",
  "math_stud_id",
  "id",
] as const;
const STUDENT_REMEDIAL_COLUMNS = ["remedial_id", "remedial_teacher_id", "remedialid"] as const;
const STUDENT_IDENTIFIER_COLUMNS = ["student_identifier", "student_code", "student_number", "student_no"] as const;
const STUDENT_GRADE_COLUMNS = ["grade", "grade_level", "gradelevel", "year_level"] as const;
const STUDENT_SECTION_COLUMNS = ["section", "class_section", "section_name", "section_handled"] as const;
const STUDENT_ENGLISH_COLUMNS = ["english", "english_status", "english_proficiency"] as const;
const STUDENT_FILIPINO_COLUMNS = ["filipino", "filipino_status", "filipino_proficiency"] as const;
const STUDENT_MATH_COLUMNS = ["math", "math_status", "math_proficiency"] as const;
const STUDENT_GUARDIAN_COLUMNS = ["guardian", "guardian_name", "parent_guardian"] as const;
const STUDENT_GUARDIAN_CONTACT_COLUMNS = [
  "guardian_contact",
  "guardian_contact_number",
  "guardian_number",
  "parent_contact",
] as const;
const STUDENT_ADDRESS_COLUMNS = ["address", "home_address", "street_address"] as const;
const STUDENT_FIRST_NAME_COLUMNS = ["first_name", "firstname", "given_name"] as const;
const STUDENT_MIDDLE_NAME_COLUMNS = ["middle_name", "middlename", "middle"] as const;
const STUDENT_LAST_NAME_COLUMNS = ["last_name", "lastname", "surname"] as const;
const STUDENT_FULL_NAME_COLUMNS = ["full_name", "name", "student_name"] as const;

const STARTING_LEVEL_COLUMNS = ["starting_level", "start_level", "startingLevel"] as const;
const SEPTEMBER_LEVEL_COLUMNS = ["sept_level", "september_level", "septLevel"] as const;
const OCTOBER_LEVEL_COLUMNS = ["oct_level", "october_level", "octLevel"] as const;
const DECEMBER_LEVEL_COLUMNS = ["dec_level", "december_level", "decLevel"] as const;
const FEBRUARY_LEVEL_COLUMNS = ["feb_level", "february_level", "febLevel", "midyear_level", "mid_year_level"] as const;

const ENGLISH_STUDENT_LIST_TABLES = ["english_students_list"] as const;
const FILIPINO_STUDENT_LIST_TABLES = ["filipino_students_list"] as const;
const MATH_STUDENT_LIST_TABLES = ["math_students_list"] as const;

const ENG_SEPT_PROGRESS_TABLES = ["eng_sept_progress"] as const;
const ENG_OCT_PROGRESS_TABLES = ["eng_oct_progress"] as const;
const ENG_DEC_PROGRESS_TABLES = ["eng_dec_progress"] as const;
const ENG_FEB_PROGRESS_TABLES = ["eng_feb_progress"] as const;
const FIL_SEPT_PROGRESS_TABLES = ["fil_sept_progress"] as const;
const FIL_OCT_PROGRESS_TABLES = ["fil_oct_progress"] as const;
const FIL_DEC_PROGRESS_TABLES = ["fil_dec_progress"] as const;
const FIL_FEB_PROGRESS_TABLES = ["fil_feb_progress"] as const;
const MATH_SEPT_PROGRESS_TABLES = ["math_sept_progress"] as const;
const MATH_OCT_PROGRESS_TABLES = ["math_oct_progress", "math_oct_progess"] as const;
const MATH_DEC_PROGRESS_TABLES = ["math_dec_progress"] as const;
const MATH_FEB_PROGRESS_TABLES = ["math_feb_progress"] as const;

async function resolveOptionalTable(candidates: readonly string[]): Promise<string | null> {
  for (const tableName of candidates) {
    if (await tableExists(tableName)) {
      return tableName;
    }
  }
  return null;
}

const sanitize = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

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

const columnExists = (columns: Set<string>, candidate: string | null): candidate is string => {
  if (!candidate) {
    return false;
  }
  if (columns.has(candidate)) {
    return true;
  }
  const lowerCandidate = candidate.toLowerCase();
  for (const column of columns) {
    if (column.toLowerCase() === lowerCandidate) {
      return true;
    }
  }
  return false;
};

const safeGetColumns = async (tableName: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(tableName);
  } catch (error) {
    console.warn(`Unable to read columns for table ${tableName}`, error);
    return new Set<string>();
  }
};

const buildFullName = (
  primaryFirst: string | null,
  primaryMiddle: string | null,
  primaryLast: string | null,
  fallbackFirst: string | null,
  fallbackMiddle: string | null,
  fallbackLast: string | null,
  candidateFull: string | null,
): string | null => {
  const first = primaryFirst ?? fallbackFirst;
  const middle = primaryMiddle ?? fallbackMiddle;
  const last = primaryLast ?? fallbackLast;

  const parts = [first, middle, last]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (candidateFull && candidateFull.trim().length > 0) {
    return candidateFull.trim();
  }

  return null;
};

type RawStudentRow = RowDataPacket & {
  student_id: number | null;
  student_user_id: number | null;
  student_remedial_id: number | null;
  student_identifier?: string | null;
  student_grade?: string | null;
  student_section?: string | null;
  student_english?: string | null;
  student_filipino?: string | null;
  student_math?: string | null;
  student_guardian?: string | null;
  student_guardian_contact?: string | null;
  student_address?: string | null;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  student_first_name?: string | null;
  student_middle_name?: string | null;
  student_last_name?: string | null;
  student_full_name?: string | null;
  english_starting_level?: string | null;
  filipino_starting_level?: string | null;
  math_starting_level?: string | null;
  english_sept_level?: string | null;
  english_oct_level?: string | null;
  english_dec_level?: string | null;
  english_feb_level?: string | null;
  filipino_sept_level?: string | null;
  filipino_oct_level?: string | null;
  filipino_dec_level?: string | null;
  filipino_feb_level?: string | null;
  math_sept_level?: string | null;
  math_oct_level?: string | null;
  math_dec_level?: string | null;
  math_feb_level?: string | null;
};

type RemedialStudentPayload = {
  studentId: number | null;
  userId: number | null;
  remedialId: number | null;
  studentIdentifier: string | null;
  grade: string | null;
  section: string | null;
  english: string | null;
  filipino: string | null;
  math: string | null;
  guardian: string | null;
  guardianContact: string | null;
  address: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string | null;
  englishStartingLevel: string | null;
  filipinoStartingLevel: string | null;
  mathStartingLevel: string | null;
  englishSeptLevel: string | null;
  englishOctLevel: string | null;
  englishDecLevel: string | null;
  englishFebLevel: string | null;
  filipinoSeptLevel: string | null;
  filipinoOctLevel: string | null;
  filipinoDecLevel: string | null;
  filipinoFebLevel: string | null;
  mathSeptLevel: string | null;
  mathOctLevel: string | null;
  mathDecLevel: string | null;
  mathFebLevel: string | null;
  latestEnglishLevel: string | null;
  latestFilipinoLevel: string | null;
  latestMathLevel: string | null;
};

const normalizeStudentRow = (row: RawStudentRow): RemedialStudentPayload => {
  const firstName = sanitize(row.user_first_name) ?? sanitize(row.student_first_name);
  const middleName = sanitize(row.user_middle_name) ?? sanitize(row.student_middle_name);
  const lastName = sanitize(row.user_last_name) ?? sanitize(row.student_last_name);
  const fallbackFullName = [firstName, middleName, lastName]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join(" ");

  const fullName =
    buildFullName(
      firstName,
      middleName,
      lastName,
      sanitize(row.student_first_name),
      sanitize(row.student_middle_name),
      sanitize(row.student_last_name),
      sanitize(row.student_full_name),
    ) ??
    sanitize(row.student_full_name) ??
    (fallbackFullName.length > 0 ? fallbackFullName : null);

  const englishStartingLevel = sanitize(row.english_starting_level);
  const englishSeptLevel = sanitize(row.english_sept_level);
  const englishOctLevel = sanitize(row.english_oct_level);
  const englishDecLevel = sanitize(row.english_dec_level);
  const englishFebLevel = sanitize(row.english_feb_level);
  const filipinoStartingLevel = sanitize(row.filipino_starting_level);
  const filipinoSeptLevel = sanitize(row.filipino_sept_level);
  const filipinoOctLevel = sanitize(row.filipino_oct_level);
  const filipinoDecLevel = sanitize(row.filipino_dec_level);
  const filipinoFebLevel = sanitize(row.filipino_feb_level);
  const mathStartingLevel = sanitize(row.math_starting_level);
  const mathSeptLevel = sanitize(row.math_sept_level);
  const mathOctLevel = sanitize(row.math_oct_level);
  const mathDecLevel = sanitize(row.math_dec_level);
  const mathFebLevel = sanitize(row.math_feb_level);

  const latestEnglishLevel = englishFebLevel ?? englishDecLevel ?? englishOctLevel ?? englishSeptLevel ?? englishStartingLevel;
  const latestFilipinoLevel = filipinoFebLevel ?? filipinoDecLevel ?? filipinoOctLevel ?? filipinoSeptLevel ?? filipinoStartingLevel;
  const latestMathLevel = mathFebLevel ?? mathDecLevel ?? mathOctLevel ?? mathSeptLevel ?? mathStartingLevel;

  const studentId = row.student_id !== null && row.student_id !== undefined ? Number(row.student_id) : null;
  const userId = row.student_user_id !== null && row.student_user_id !== undefined ? Number(row.student_user_id) : null;
  const remedialId =
    row.student_remedial_id !== null && row.student_remedial_id !== undefined ? Number(row.student_remedial_id) : null;

  let identifier = sanitize(row.student_identifier);
  if (!identifier && studentId !== null) {
    identifier = `ST-${String(studentId).padStart(4, "0")}`;
  }

  return {
    studentId,
    userId,
    remedialId,
    studentIdentifier: identifier ?? null,
    grade: sanitize(row.student_grade),
    section: sanitize(row.student_section),
    english: sanitize(row.student_english),
    filipino: sanitize(row.student_filipino),
    math: sanitize(row.student_math),
    guardian: sanitize(row.student_guardian),
    guardianContact: sanitize(row.student_guardian_contact),
    address: sanitize(row.student_address),
    firstName: firstName ?? null,
    middleName: middleName ?? null,
    lastName: lastName ?? null,
    fullName,
    englishStartingLevel,
    filipinoStartingLevel,
    mathStartingLevel,
    englishSeptLevel,
    englishOctLevel,
  englishDecLevel,
  englishFebLevel,
    filipinoSeptLevel,
    filipinoOctLevel,
  filipinoDecLevel,
  filipinoFebLevel,
    mathSeptLevel,
    mathOctLevel,
  mathDecLevel,
  mathFebLevel,
    latestEnglishLevel,
    latestFilipinoLevel,
    latestMathLevel,
  };
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");
  const searchParam = url.searchParams.get("search");

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
    const [usersExists, remedialExists, studentExists] = await Promise.all([
      tableExists(USER_TABLE),
      tableExists(REMEDIAL_TABLE),
      tableExists(STUDENT_TABLE),
    ]);

    if (!usersExists || !remedialExists || !studentExists) {
      return NextResponse.json(
        { success: false, error: "Required tables are unavailable." },
        { status: 500 },
      );
    }

    const [userColumns, remedialColumns, studentColumns] = await Promise.all([
      safeGetColumns(USER_TABLE),
      safeGetColumns(REMEDIAL_TABLE),
      safeGetColumns(STUDENT_TABLE),
    ]);

    if (!userColumns.size || !remedialColumns.size || !studentColumns.size) {
      return NextResponse.json(
        { success: false, error: "Unable to resolve table metadata." },
        { status: 500 },
      );
    }

    const userIdColumn = pickColumn(userColumns, USER_ID_COLUMNS) ?? "user_id";
    const userFirstNameColumn = pickColumn(userColumns, USER_FIRST_NAME_COLUMNS);
    const userMiddleNameColumn = pickColumn(userColumns, USER_MIDDLE_NAME_COLUMNS);
    const userLastNameColumn = pickColumn(userColumns, USER_LAST_NAME_COLUMNS);

    const remedialUserColumn = pickColumn(remedialColumns, REMEDIAL_USER_COLUMNS);
    const remedialIdColumn = pickColumn(remedialColumns, REMEDIAL_ID_COLUMNS);

    const studentUserColumn = pickColumn(studentColumns, STUDENT_USER_COLUMNS);
    const studentIdColumn = pickColumn(studentColumns, STUDENT_ID_COLUMNS);
    const studentRemedialColumn = pickColumn(studentColumns, STUDENT_REMEDIAL_COLUMNS);
    const studentIdentifierColumn = pickColumn(studentColumns, STUDENT_IDENTIFIER_COLUMNS);
    const studentGradeColumn = pickColumn(studentColumns, STUDENT_GRADE_COLUMNS);
    const studentSectionColumn = pickColumn(studentColumns, STUDENT_SECTION_COLUMNS);
    const studentEnglishColumn = pickColumn(studentColumns, STUDENT_ENGLISH_COLUMNS);
    const studentFilipinoColumn = pickColumn(studentColumns, STUDENT_FILIPINO_COLUMNS);
    const studentMathColumn = pickColumn(studentColumns, STUDENT_MATH_COLUMNS);
    const studentGuardianColumn = pickColumn(studentColumns, STUDENT_GUARDIAN_COLUMNS);
    const studentGuardianContactColumn = pickColumn(studentColumns, STUDENT_GUARDIAN_CONTACT_COLUMNS);
    const studentAddressColumn = pickColumn(studentColumns, STUDENT_ADDRESS_COLUMNS);
    const studentFirstNameColumn = pickColumn(studentColumns, STUDENT_FIRST_NAME_COLUMNS);
    const studentMiddleNameColumn = pickColumn(studentColumns, STUDENT_MIDDLE_NAME_COLUMNS);
    const studentLastNameColumn = pickColumn(studentColumns, STUDENT_LAST_NAME_COLUMNS);
    const studentFullNameColumn = pickColumn(studentColumns, STUDENT_FULL_NAME_COLUMNS);

    if (!remedialUserColumn || !remedialIdColumn || !studentUserColumn || !studentRemedialColumn) {
      return NextResponse.json(
        { success: false, error: "Required columns for remedial teacher filtering are missing." },
        { status: 500 },
      );
    }

    const [
      englishStudentsTable,
      filipinoStudentsTable,
      mathStudentsTable,
      engSeptProgressTable,
      engOctProgressTable,
      engDecProgressTable,
      engFebProgressTable,
      filSeptProgressTable,
      filOctProgressTable,
      filDecProgressTable,
      filFebProgressTable,
      mathSeptProgressTable,
      mathOctProgressTable,
      mathDecProgressTable,
      mathFebProgressTable,
    ] = await Promise.all([
      resolveOptionalTable(ENGLISH_STUDENT_LIST_TABLES),
      resolveOptionalTable(FILIPINO_STUDENT_LIST_TABLES),
      resolveOptionalTable(MATH_STUDENT_LIST_TABLES),
      resolveOptionalTable(ENG_SEPT_PROGRESS_TABLES),
      resolveOptionalTable(ENG_OCT_PROGRESS_TABLES),
      resolveOptionalTable(ENG_DEC_PROGRESS_TABLES),
      resolveOptionalTable(ENG_FEB_PROGRESS_TABLES),
      resolveOptionalTable(FIL_SEPT_PROGRESS_TABLES),
      resolveOptionalTable(FIL_OCT_PROGRESS_TABLES),
      resolveOptionalTable(FIL_DEC_PROGRESS_TABLES),
      resolveOptionalTable(FIL_FEB_PROGRESS_TABLES),
      resolveOptionalTable(MATH_SEPT_PROGRESS_TABLES),
      resolveOptionalTable(MATH_OCT_PROGRESS_TABLES),
      resolveOptionalTable(MATH_DEC_PROGRESS_TABLES),
      resolveOptionalTable(MATH_FEB_PROGRESS_TABLES),
    ]);

    const englishStudentsColumns = englishStudentsTable ? await safeGetColumns(englishStudentsTable) : new Set<string>();
    const filipinoStudentsColumns = filipinoStudentsTable ? await safeGetColumns(filipinoStudentsTable) : new Set<string>();
    const mathStudentsColumns = mathStudentsTable ? await safeGetColumns(mathStudentsTable) : new Set<string>();
    const engSeptColumns = engSeptProgressTable ? await safeGetColumns(engSeptProgressTable) : new Set<string>();
    const engOctColumns = engOctProgressTable ? await safeGetColumns(engOctProgressTable) : new Set<string>();
  const engDecColumns = engDecProgressTable ? await safeGetColumns(engDecProgressTable) : new Set<string>();
  const engFebColumns = engFebProgressTable ? await safeGetColumns(engFebProgressTable) : new Set<string>();
    const filSeptColumns = filSeptProgressTable ? await safeGetColumns(filSeptProgressTable) : new Set<string>();
    const filOctColumns = filOctProgressTable ? await safeGetColumns(filOctProgressTable) : new Set<string>();
  const filDecColumns = filDecProgressTable ? await safeGetColumns(filDecProgressTable) : new Set<string>();
  const filFebColumns = filFebProgressTable ? await safeGetColumns(filFebProgressTable) : new Set<string>();
    const mathSeptColumns = mathSeptProgressTable ? await safeGetColumns(mathSeptProgressTable) : new Set<string>();
    const mathOctColumns = mathOctProgressTable ? await safeGetColumns(mathOctProgressTable) : new Set<string>();
  const mathDecColumns = mathDecProgressTable ? await safeGetColumns(mathDecProgressTable) : new Set<string>();
  const mathFebColumns = mathFebProgressTable ? await safeGetColumns(mathFebProgressTable) : new Set<string>();

  const englishStudentIdColumn = englishStudentsTable ? pickColumn(englishStudentsColumns, STUDENT_ID_COLUMNS) : null;
  const englishStartingColumn = englishStudentsTable ? pickColumn(englishStudentsColumns, STARTING_LEVEL_COLUMNS) : null;
  const filipinoStudentIdColumn = filipinoStudentsTable ? pickColumn(filipinoStudentsColumns, STUDENT_ID_COLUMNS) : null;
  const filipinoStartingColumn = filipinoStudentsTable ? pickColumn(filipinoStudentsColumns, STARTING_LEVEL_COLUMNS) : null;
  const mathStudentIdColumn = mathStudentsTable ? pickColumn(mathStudentsColumns, STUDENT_ID_COLUMNS) : null;
  const mathStartingColumn = mathStudentsTable ? pickColumn(mathStudentsColumns, STARTING_LEVEL_COLUMNS) : null;

  const engSeptIdColumn = engSeptProgressTable ? pickColumn(engSeptColumns, STUDENT_ID_COLUMNS) : null;
  const engSeptLevelColumn = engSeptProgressTable ? pickColumn(engSeptColumns, SEPTEMBER_LEVEL_COLUMNS) : null;
  const engOctIdColumn = engOctProgressTable ? pickColumn(engOctColumns, STUDENT_ID_COLUMNS) : null;
  const engOctLevelColumn = engOctProgressTable ? pickColumn(engOctColumns, OCTOBER_LEVEL_COLUMNS) : null;
  const engDecIdColumn = engDecProgressTable ? pickColumn(engDecColumns, STUDENT_ID_COLUMNS) : null;
  const engDecLevelColumn = engDecProgressTable ? pickColumn(engDecColumns, DECEMBER_LEVEL_COLUMNS) : null;
  const engFebIdColumn = engFebProgressTable ? pickColumn(engFebColumns, STUDENT_ID_COLUMNS) : null;
  const engFebLevelColumn = engFebProgressTable ? pickColumn(engFebColumns, FEBRUARY_LEVEL_COLUMNS) : null;
  const filSeptIdColumn = filSeptProgressTable ? pickColumn(filSeptColumns, STUDENT_ID_COLUMNS) : null;
  const filSeptLevelColumn = filSeptProgressTable ? pickColumn(filSeptColumns, SEPTEMBER_LEVEL_COLUMNS) : null;
  const filOctIdColumn = filOctProgressTable ? pickColumn(filOctColumns, STUDENT_ID_COLUMNS) : null;
  const filOctLevelColumn = filOctProgressTable ? pickColumn(filOctColumns, OCTOBER_LEVEL_COLUMNS) : null;
  const filDecIdColumn = filDecProgressTable ? pickColumn(filDecColumns, STUDENT_ID_COLUMNS) : null;
  const filDecLevelColumn = filDecProgressTable ? pickColumn(filDecColumns, DECEMBER_LEVEL_COLUMNS) : null;
  const filFebIdColumn = filFebProgressTable ? pickColumn(filFebColumns, STUDENT_ID_COLUMNS) : null;
  const filFebLevelColumn = filFebProgressTable ? pickColumn(filFebColumns, FEBRUARY_LEVEL_COLUMNS) : null;
  const mathSeptIdColumn = mathSeptProgressTable ? pickColumn(mathSeptColumns, STUDENT_ID_COLUMNS) : null;
  const mathSeptLevelColumn = mathSeptProgressTable ? pickColumn(mathSeptColumns, SEPTEMBER_LEVEL_COLUMNS) : null;
  const mathOctIdColumn = mathOctProgressTable ? pickColumn(mathOctColumns, STUDENT_ID_COLUMNS) : null;
  const mathOctLevelColumn = mathOctProgressTable ? pickColumn(mathOctColumns, OCTOBER_LEVEL_COLUMNS) : null;
  const mathDecIdColumn = mathDecProgressTable ? pickColumn(mathDecColumns, STUDENT_ID_COLUMNS) : null;
  const mathDecLevelColumn = mathDecProgressTable ? pickColumn(mathDecColumns, DECEMBER_LEVEL_COLUMNS) : null;
  const mathFebIdColumn = mathFebProgressTable ? pickColumn(mathFebColumns, STUDENT_ID_COLUMNS) : null;
  const mathFebLevelColumn = mathFebProgressTable ? pickColumn(mathFebColumns, FEBRUARY_LEVEL_COLUMNS) : null;

    const selectParts: string[] = [];
    const joins: string[] = [];
  let englishJoinTarget: { alias: string; column: string } | null = null;
  let filipinoJoinTarget: { alias: string; column: string } | null = null;
  let mathJoinTarget: { alias: string; column: string } | null = null;

    selectParts.push(
      studentIdColumn ? `s.${studentIdColumn} AS student_id` : "NULL AS student_id",
    );
    selectParts.push(`s.${studentUserColumn} AS student_user_id`);
    selectParts.push(`s.${studentRemedialColumn} AS student_remedial_id`);
    selectParts.push(
      studentIdentifierColumn
        ? `s.${studentIdentifierColumn} AS student_identifier`
        : "NULL AS student_identifier",
    );
    selectParts.push(
      studentGradeColumn ? `s.${studentGradeColumn} AS student_grade` : "NULL AS student_grade",
    );
    selectParts.push(
      studentSectionColumn
        ? `s.${studentSectionColumn} AS student_section`
        : "NULL AS student_section",
    );
    selectParts.push(
      studentEnglishColumn
        ? `s.${studentEnglishColumn} AS student_english`
        : "NULL AS student_english",
    );
    selectParts.push(
      studentFilipinoColumn
        ? `s.${studentFilipinoColumn} AS student_filipino`
        : "NULL AS student_filipino",
    );
    selectParts.push(
      studentMathColumn ? `s.${studentMathColumn} AS student_math` : "NULL AS student_math",
    );
    selectParts.push(
      studentGuardianColumn
        ? `s.${studentGuardianColumn} AS student_guardian`
        : "NULL AS student_guardian",
    );
    selectParts.push(
      studentGuardianContactColumn
        ? `s.${studentGuardianContactColumn} AS student_guardian_contact`
        : "NULL AS student_guardian_contact",
    );
    selectParts.push(
      studentAddressColumn
        ? `s.${studentAddressColumn} AS student_address`
        : "NULL AS student_address",
    );
    selectParts.push(
      studentFirstNameColumn
        ? `s.${studentFirstNameColumn} AS student_first_name`
        : "NULL AS student_first_name",
    );
    selectParts.push(
      studentMiddleNameColumn
        ? `s.${studentMiddleNameColumn} AS student_middle_name`
        : "NULL AS student_middle_name",
    );
    selectParts.push(
      studentLastNameColumn
        ? `s.${studentLastNameColumn} AS student_last_name`
        : "NULL AS student_last_name",
    );
    selectParts.push(
      studentFullNameColumn
        ? `s.${studentFullNameColumn} AS student_full_name`
        : "NULL AS student_full_name",
    );

    if (englishStudentsTable && studentIdColumn && englishStudentIdColumn) {
      joins.push(
        `LEFT JOIN \`${englishStudentsTable}\` AS esl ON esl.${englishStudentIdColumn} = s.${studentIdColumn}`,
      );
      englishJoinTarget = { alias: "esl", column: englishStudentIdColumn };
      if (englishStartingColumn) {
        selectParts.push(`esl.${englishStartingColumn} AS english_starting_level`);
      } else {
        selectParts.push("NULL AS english_starting_level");
      }
    } else {
      selectParts.push("NULL AS english_starting_level");
    }

    if (filipinoStudentsTable && studentIdColumn && filipinoStudentIdColumn) {
      joins.push(
        `LEFT JOIN \`${filipinoStudentsTable}\` AS fsl ON fsl.${filipinoStudentIdColumn} = s.${studentIdColumn}`,
      );
      filipinoJoinTarget = { alias: "fsl", column: filipinoStudentIdColumn };
      if (filipinoStartingColumn) {
        selectParts.push(`fsl.${filipinoStartingColumn} AS filipino_starting_level`);
      } else {
        selectParts.push("NULL AS filipino_starting_level");
      }
    } else {
      selectParts.push("NULL AS filipino_starting_level");
    }

    if (mathStudentsTable && studentIdColumn && mathStudentIdColumn) {
      joins.push(
        `LEFT JOIN \`${mathStudentsTable}\` AS msl ON msl.${mathStudentIdColumn} = s.${studentIdColumn}`,
      );
      mathJoinTarget = { alias: "msl", column: mathStudentIdColumn };
      if (mathStartingColumn) {
        selectParts.push(`msl.${mathStartingColumn} AS math_starting_level`);
      } else {
        selectParts.push("NULL AS math_starting_level");
      }
    } else {
      selectParts.push("NULL AS math_starting_level");
    }

    if (engSeptProgressTable && studentIdColumn && engSeptIdColumn && engSeptLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (englishJoinTarget && columnExists(englishStudentsColumns, engSeptIdColumn)) {
        joinAlias = englishJoinTarget.alias;
        joinColumn = engSeptIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${engSeptProgressTable}\` AS esp ON esp.${engSeptIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`esp.${engSeptLevelColumn} AS english_sept_level`);
    } else {
      selectParts.push("NULL AS english_sept_level");
    }

    if (engOctProgressTable && studentIdColumn && engOctIdColumn && engOctLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (englishJoinTarget && columnExists(englishStudentsColumns, engOctIdColumn)) {
        joinAlias = englishJoinTarget.alias;
        joinColumn = engOctIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${engOctProgressTable}\` AS eop ON eop.${engOctIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`eop.${engOctLevelColumn} AS english_oct_level`);
    } else {
      selectParts.push("NULL AS english_oct_level");
    }

    if (engDecProgressTable && studentIdColumn && engDecIdColumn && engDecLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (englishJoinTarget && columnExists(englishStudentsColumns, engDecIdColumn)) {
        joinAlias = englishJoinTarget.alias;
        joinColumn = engDecIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${engDecProgressTable}\` AS edp ON edp.${engDecIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`edp.${engDecLevelColumn} AS english_dec_level`);
    } else {
      selectParts.push("NULL AS english_dec_level");
    }

    if (engFebProgressTable && studentIdColumn && engFebIdColumn && engFebLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (englishJoinTarget && columnExists(englishStudentsColumns, engFebIdColumn)) {
        joinAlias = englishJoinTarget.alias;
        joinColumn = engFebIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${engFebProgressTable}\` AS efp ON efp.${engFebIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`efp.${engFebLevelColumn} AS english_feb_level`);
    } else {
      selectParts.push("NULL AS english_feb_level");
    }

    if (filSeptProgressTable && studentIdColumn && filSeptIdColumn && filSeptLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (filipinoJoinTarget && columnExists(filipinoStudentsColumns, filSeptIdColumn)) {
        joinAlias = filipinoJoinTarget.alias;
        joinColumn = filSeptIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${filSeptProgressTable}\` AS fsp ON fsp.${filSeptIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`fsp.${filSeptLevelColumn} AS filipino_sept_level`);
    } else {
      selectParts.push("NULL AS filipino_sept_level");
    }

    if (filOctProgressTable && studentIdColumn && filOctIdColumn && filOctLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (filipinoJoinTarget && columnExists(filipinoStudentsColumns, filOctIdColumn)) {
        joinAlias = filipinoJoinTarget.alias;
        joinColumn = filOctIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${filOctProgressTable}\` AS fop ON fop.${filOctIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`fop.${filOctLevelColumn} AS filipino_oct_level`);
    } else {
      selectParts.push("NULL AS filipino_oct_level");
    }

    if (filDecProgressTable && studentIdColumn && filDecIdColumn && filDecLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (filipinoJoinTarget && columnExists(filipinoStudentsColumns, filDecIdColumn)) {
        joinAlias = filipinoJoinTarget.alias;
        joinColumn = filDecIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${filDecProgressTable}\` AS fdp ON fdp.${filDecIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`fdp.${filDecLevelColumn} AS filipino_dec_level`);
    } else {
      selectParts.push("NULL AS filipino_dec_level");
    }

    if (filFebProgressTable && studentIdColumn && filFebIdColumn && filFebLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (filipinoJoinTarget && columnExists(filipinoStudentsColumns, filFebIdColumn)) {
        joinAlias = filipinoJoinTarget.alias;
        joinColumn = filFebIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${filFebProgressTable}\` AS ffp ON ffp.${filFebIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`ffp.${filFebLevelColumn} AS filipino_feb_level`);
    } else {
      selectParts.push("NULL AS filipino_feb_level");
    }

    if (mathSeptProgressTable && studentIdColumn && mathSeptIdColumn && mathSeptLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (mathJoinTarget && columnExists(mathStudentsColumns, mathSeptIdColumn)) {
        joinAlias = mathJoinTarget.alias;
        joinColumn = mathSeptIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${mathSeptProgressTable}\` AS msp ON msp.${mathSeptIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`msp.${mathSeptLevelColumn} AS math_sept_level`);
    } else {
      selectParts.push("NULL AS math_sept_level");
    }

    if (mathOctProgressTable && studentIdColumn && mathOctIdColumn && mathOctLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (mathJoinTarget && columnExists(mathStudentsColumns, mathOctIdColumn)) {
        joinAlias = mathJoinTarget.alias;
        joinColumn = mathOctIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${mathOctProgressTable}\` AS mop ON mop.${mathOctIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`mop.${mathOctLevelColumn} AS math_oct_level`);
    } else {
      selectParts.push("NULL AS math_oct_level");
    }

    if (mathDecProgressTable && studentIdColumn && mathDecIdColumn && mathDecLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (mathJoinTarget && columnExists(mathStudentsColumns, mathDecIdColumn)) {
        joinAlias = mathJoinTarget.alias;
        joinColumn = mathDecIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${mathDecProgressTable}\` AS mdp ON mdp.${mathDecIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`mdp.${mathDecLevelColumn} AS math_dec_level`);
    } else {
      selectParts.push("NULL AS math_dec_level");
    }

    if (mathFebProgressTable && studentIdColumn && mathFebIdColumn && mathFebLevelColumn) {
      let joinAlias = "s";
      let joinColumn = studentIdColumn;
      if (mathJoinTarget && columnExists(mathStudentsColumns, mathFebIdColumn)) {
        joinAlias = mathJoinTarget.alias;
        joinColumn = mathFebIdColumn;
      }
      joins.push(
        `LEFT JOIN \`${mathFebProgressTable}\` AS mfp ON mfp.${mathFebIdColumn} = ${joinAlias}.${joinColumn}`,
      );
      selectParts.push(`mfp.${mathFebLevelColumn} AS math_feb_level`);
    } else {
      selectParts.push("NULL AS math_feb_level");
    }

    selectParts.push(
      userFirstNameColumn
        ? `u.${userFirstNameColumn} AS user_first_name`
        : "NULL AS user_first_name",
    );
    selectParts.push(
      userMiddleNameColumn
        ? `u.${userMiddleNameColumn} AS user_middle_name`
        : "NULL AS user_middle_name",
    );
    selectParts.push(
      userLastNameColumn
        ? `u.${userLastNameColumn} AS user_last_name`
        : "NULL AS user_last_name",
    );

    const orderParts: string[] = [];
    if (userLastNameColumn) {
      orderParts.push(`u.${userLastNameColumn}`);
    }
    if (userFirstNameColumn) {
      orderParts.push(`u.${userFirstNameColumn}`);
    }
    if (studentLastNameColumn && !orderParts.length) {
      orderParts.push(`s.${studentLastNameColumn}`);
    }
    if (studentFirstNameColumn && orderParts.length < 2) {
      orderParts.push(`s.${studentFirstNameColumn}`);
    }
    if (studentIdColumn) {
      orderParts.push(`s.${studentIdColumn}`);
    }

    const joinClause = joins.length ? `\n      ${joins.join("\n      ")}` : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM \`${REMEDIAL_TABLE}\` AS rt
      JOIN \`${STUDENT_TABLE}\` AS s ON rt.${remedialIdColumn} = s.${studentRemedialColumn}
      JOIN \`${USER_TABLE}\` AS u ON u.${userIdColumn} = s.${studentUserColumn}${joinClause}
      WHERE rt.${remedialUserColumn} = ?
      ORDER BY ${orderParts.length ? orderParts.join(", ") : "s." + studentRemedialColumn}
    `;

    const [rows] = await query<RawStudentRow[]>(sql, [userId]);
    const students = rows.map(normalizeStudentRow);

    const filteredStudents = (() => {
      const term = sanitize(searchParam);
      if (!term) {
        return students;
      }
      const needle = term.toLowerCase();
      return students.filter((student) => {
        const candidates: Array<string | null> = [
          student.fullName,
          student.studentIdentifier,
          student.grade,
          student.section,
          student.english,
          student.filipino,
          student.math,
        ];
        return candidates.some(
          (candidate) => typeof candidate === "string" && candidate.toLowerCase().includes(needle),
        );
      });
    })();

    return NextResponse.json({ success: true, students: filteredStudents });
  } catch (error) {
    console.error("Failed to load remedial teacher students", error);
    return NextResponse.json(
      { success: false, error: "Failed to load remedial teacher students." },
      { status: 500 },
    );
  }
}
