import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeNamePart(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    throw new HttpError(400, `${field} must be at least 2 characters.`);
  }
  return trimmed;
}

export function sanitizeOptionalNamePart(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Email is required.");
  }
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new HttpError(400, "Invalid email format.");
  }
  return normalized;
}

export function sanitizePhoneNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Phone number is required.");
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new HttpError(400, "Phone number must contain 10 to 11 digits.");
  }
  return digits;
}

export function sanitizeGrade(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const numeric = Math.trunc(value);
    if (numeric <= 0) {
      throw new HttpError(400, "Grade must be a positive number.");
    }
    return String(numeric);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new HttpError(400, "Grade is required.");
    }
    const match = trimmed.match(/\d+/);
    if (match) {
      return match[0];
    }
    return trimmed;
  }

  throw new HttpError(400, "Grade is required.");
}

export function sanitizeSubjects(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((subject) => String(subject).trim())
      .filter((subject) => subject.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[,/]/)
      .map((subject) => subject.trim())
      .filter((subject) => subject.length > 0);
  }

  return [];
}

export function sanitizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildFullName(
  firstName: string,
  middleName: string | null,
  lastName: string,
  suffix: string | null,
): string {
  const parts = [firstName, middleName, lastName]
    .filter((part) => part && part.trim().length > 0)
    .map((part) => (part ? part.trim() : part));
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

async function getColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
}

// Teacher IDs follow TE-YYXXXX (year + zero-padded sequence)
const TEACHER_ID_PATTERN = /^TE-(\d{2})(\d{4,})$/;

export function formatTeacherIdentifier(
  raw: string | null | undefined,
  fallbackSequence?: number | null,
  yearOverride?: number | null,
): string {
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (normalized && TEACHER_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  const sequenceValue = typeof fallbackSequence === "number" && Number.isFinite(fallbackSequence)
    ? Math.max(1, Math.trunc(fallbackSequence))
    : 1;

  return `TE-${year}${String(sequenceValue).padStart(4, "0")}`;
}

async function generateTeacherId(
  connection: PoolConnection,
  sources: Array<{ table: string; column: string }>,
  yearOverride?: number | null,
): Promise<string> {
  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  let maxSequence = 0;

  for (const source of sources) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${source.column}\` AS teacher_id FROM \`${source.table}\` WHERE \`${source.column}\` LIKE ? ORDER BY \`${source.column}\` DESC LIMIT 1`,
      [`TE-${year}%`],
    );

    if (rows.length === 0) {
      continue;
    }

    const lastId = rows[0]?.teacher_id;
    const match = typeof lastId === "string" ? lastId.match(/TE-\d{2}(\d{4,})$/) : null;
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxSequence = Math.max(maxSequence, parsed);
      }
    }
  }

  const nextNum = maxSequence + 1;
  return `TE-${year}${String(nextNum).padStart(4, "0")}`;
}

export interface CreateTeacherInput {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  suffix: string | null;
  grade: string;
  section?: string | null;
  subjects?: string | null;
  teacherId?: string | null;
}

export interface CreateTeacherResult {
  userId: number;
  record: {
    userId: number;
    teacherId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    name: string;
    email: string;
    contactNumber: string;
    grade: string;
    section: string | null;
    subjects: string | null;
    status: string;
    lastLogin: null;
    suffix: string | null;
  };
  temporaryPassword: string;
}

export interface BulkCreateTeacherItem extends CreateTeacherInput {
  index: number;
}

export interface BulkCreateTeacherResult {
  inserted: Array<{
    index: number;
    userId: number;
    record: CreateTeacherResult["record"];
    temporaryPassword: string;
  }>;
  failures: Array<{
    index: number;
    email: string | null;
    error: string;
  }>;
}

const TEACHER_TABLE_CANDIDATES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_accounts",
  "faculty",
  "teacher_tbl",
] as const;

async function resolveTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await getColumnsForTable(connection, candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

const REMEDIAL_TEACHER_TABLE_CANDIDATES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedialteacher",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
] as const;

const BULK_INSERT_CHUNK_SIZE = 100;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildPlaceholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

function parseTeacherIdSequence(teacherId: string): number | null {
  const match = teacherId.match(TEACHER_ID_PATTERN);
  if (!match) {
    return null;
  }
  const seq = Number.parseInt(match[2], 10);
  return Number.isFinite(seq) ? seq : null;
}

async function resolveRemedialTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of REMEDIAL_TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await getColumnsForTable(connection, candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

export async function createTeacher(input: CreateTeacherInput): Promise<CreateTeacherResult> {
  const { firstName, middleName, lastName, suffix, email, phoneNumber, grade, section, subjects, teacherId } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();
  const requestTime = new Date();
  const currentYear = requestTime.getFullYear();

  const result = await runWithConnection(async (connection) => {
    const userColumns = await getColumnsForTable(connection, "users");
    const teacherInfo = await resolveTeacherTable(connection);
    const remedialTeacherInfo = await resolveRemedialTeacherTable(connection);
    const teacherHandledColumns = await getColumnsForTable(connection, "teacher_handled").catch(() => new Set<string>());


    const teacherIdSources: Array<{ table: string; column: string }> = [];
    if (userColumns.has("teacher_id")) {
      teacherIdSources.push({ table: "users", column: "teacher_id" });
    }
    if (teacherInfo.table) {
      for (const column of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
        if (teacherInfo.columns.has(column)) {
          teacherIdSources.push({ table: teacherInfo.table, column });
        }
      }
    }
    if (remedialTeacherInfo.table) {
      for (const column of ["teacher_id", "teacherid", "faculty_id", "master_teacher_id"]) {
        if (remedialTeacherInfo.columns.has(column)) {
          teacherIdSources.push({ table: remedialTeacherInfo.table, column });
        }
      }
    }
    try {
      const archivedColumns = await getColumnsForTable(connection, "archived_users");
      if (archivedColumns.has("teacher_id")) {
        teacherIdSources.push({ table: "archived_users", column: "teacher_id" });
      } else if (archivedColumns.has("user_code")) {
        teacherIdSources.push({ table: "archived_users", column: "user_code" });
      }
    } catch {
      // ignore archived_users absence
    }

    await connection.beginTransaction();
    try {
      const [duplicateEmail] = await connection.query<RowDataPacket[]>(
        "SELECT user_id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (duplicateEmail.length > 0) {
        throw new HttpError(409, "Email already exists.");
      }

      // Resolve role_id for teacher if available
      let teacherRoleId: number | null = null;
      try {
        const roleColumns = await getColumnsForTable(connection, "role");
        if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
          const [roleRows] = await connection.query<RowDataPacket[]>(
            "SELECT role_id FROM role WHERE LOWER(role_name) IN ('teacher','faculty','instructor') LIMIT 1",
          );
          if (Array.isArray(roleRows) && roleRows.length > 0) {
            const parsed = Number(roleRows[0].role_id);
            teacherRoleId = Number.isFinite(parsed) ? parsed : null;
          }
        }
      } catch {
        teacherRoleId = null;
      }

      const teacherIdValue = teacherId
        ? formatTeacherIdentifier(teacherId, undefined, currentYear)
        : await generateTeacherId(connection, teacherIdSources, currentYear);

      const userInsertColumns: string[] = [];
      const userInsertValues: any[] = [];

      if (userColumns.has("first_name")) {
        userInsertColumns.push("first_name");
        userInsertValues.push(firstName);
      }
      if (userColumns.has("middle_name")) {
        userInsertColumns.push("middle_name");
        userInsertValues.push(middleName);
      }
      if (userColumns.has("last_name")) {
        userInsertColumns.push("last_name");
        userInsertValues.push(lastName);
      }
      if (userColumns.has("suffix")) {
        userInsertColumns.push("suffix");
        userInsertValues.push(suffix);
      }
      if (userColumns.has("name")) {
        userInsertColumns.push("name");
        userInsertValues.push(fullName);
      }
      if (userColumns.has("email")) {
        userInsertColumns.push("email");
        userInsertValues.push(email);
      }
      if (userColumns.has("username")) {
        userInsertColumns.push("username");
        userInsertValues.push(email);
      }
      if (userColumns.has("contact_number")) {
        userInsertColumns.push("contact_number");
        userInsertValues.push(phoneNumber);
      }
      if (userColumns.has("phone_number")) {
        userInsertColumns.push("phone_number");
        userInsertValues.push(phoneNumber);
      }
      if (userColumns.has("role")) {
        userInsertColumns.push("role");
        userInsertValues.push("teacher");
      }
      if (userColumns.has("role_id") && teacherRoleId !== null) {
        userInsertColumns.push("role_id");
        userInsertValues.push(teacherRoleId);
      }
      for (const column of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
        if (userColumns.has(column)) {
          userInsertColumns.push(column);
          userInsertValues.push(teacherIdValue);
        }
      }
      if (userColumns.has("user_code")) {
        userInsertColumns.push("user_code");
        userInsertValues.push(teacherIdValue);
      }

      if (userColumns.has("status")) {
        userInsertColumns.push("status");
        userInsertValues.push("Active");
      }
      if (userColumns.has("password")) {
        userInsertColumns.push("password");
        userInsertValues.push(temporaryPassword);
      }
      const now = requestTime;
      if (userColumns.has("created_at")) {
        userInsertColumns.push("created_at");
        userInsertValues.push(now);
      }
      if (userColumns.has("updated_at")) {
        userInsertColumns.push("updated_at");
        userInsertValues.push(now);
      }

      if (userInsertColumns.length === 0) {
        throw new HttpError(500, "Unable to determine columns for users table.");
      }

      const userColumnsSql = userInsertColumns.map((column) => `\`${column}\``).join(", ");
      const placeholders = userInsertColumns.map(() => "?").join(", ");

      const [userResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (${userColumnsSql}) VALUES (${placeholders})`,
        userInsertValues,
      );

      const userId = userResult.insertId;
      if (!userId) {
        throw new HttpError(500, "Failed to create user record.");
      }

      const insertIntoFlexibleTable = async (
        tableInfo: { table: string | null; columns: Set<string> },
        configure: (columns: string[], values: any[]) => void,
      ) => {
        if (!tableInfo.table || tableInfo.columns.size === 0) {
          return;
        }
        const insertColumns: string[] = [];
        const insertValues: any[] = [];
        configure(insertColumns, insertValues);
        if (insertColumns.length === 0) {
          return;
        }
        const columnsSql = insertColumns.map((column) => `\`${column}\``).join(", ");
        const placeholdersSql = insertColumns.map(() => "?").join(", ");
        await connection.query<ResultSetHeader>(
          `INSERT INTO \`${tableInfo.table}\` (${columnsSql}) VALUES (${placeholdersSql})`,
          insertValues,
        );
      };

      await insertIntoFlexibleTable(teacherInfo, (insertColumns, insertValues) => {
        const identifiers: Array<[string, any]> = [];

        if (teacherInfo.columns.has("user_id")) {
          identifiers.push(["user_id", userId]);
        }

        for (const candidate of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
          if (teacherInfo.columns.has(candidate)) {
            identifiers.push([candidate, teacherIdValue]);
          }
        }

        if (identifiers.length === 0) {
          return;
        }

        for (const [column, value] of identifiers) {
          insertColumns.push(column);
          insertValues.push(value);
        }

        if (teacherInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (teacherInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (teacherInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (teacherInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (teacherInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (teacherInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (teacherInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (teacherInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }
        for (const column of ["grade", "grade_level", "year_level", "handled_grade"]) {
          if (teacherInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(grade);
          }
        }
        if (section) {
          for (const column of ["section", "section_name", "class_section"]) {
            if (teacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(section);
            }
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (teacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(subjects);
            }
          }
        }
        if (teacherInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (teacherInfo.columns.has("role")) {
          insertColumns.push("role");
          insertValues.push("teacher");
        }
        if (teacherInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (teacherInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      if (teacherHandledColumns.has("teacher_id") && teacherHandledColumns.has("grade_id")) {
        const gradeIdNumeric = Number.parseInt(grade, 10);
        if (Number.isFinite(gradeIdNumeric) && gradeIdNumeric > 0) {
          await connection.query<ResultSetHeader>(
            "INSERT INTO `teacher_handled` (teacher_id, grade_id) VALUES (?, ?)",
            [teacherIdValue, gradeIdNumeric],
          );
        }
      }

      if (remedialTeacherInfo.table && remedialTeacherInfo.table !== teacherInfo.table) {
        await insertIntoFlexibleTable(remedialTeacherInfo, (insertColumns, insertValues) => {
          const identifiers: Array<[string, any]> = [];

          if (remedialTeacherInfo.columns.has("user_id")) {
            identifiers.push(["user_id", userId]);
          }
          if (remedialTeacherInfo.columns.has("teacher_id")) {
            identifiers.push(["teacher_id", teacherIdValue]);
          }
          if (remedialTeacherInfo.columns.has("teacherid")) {
            identifiers.push(["teacherid", teacherIdValue]);
          }
          if (remedialTeacherInfo.columns.has("faculty_id")) {
            identifiers.push(["faculty_id", teacherIdValue]);
          }
          if (remedialTeacherInfo.columns.has("master_teacher_id")) {
            identifiers.push(["master_teacher_id", teacherIdValue]);
          }

          if (identifiers.length === 0) {
            return;
          }

          for (const [column, value] of identifiers) {
            insertColumns.push(column);
            insertValues.push(value);
          }

          if (remedialTeacherInfo.columns.has("first_name")) {
            insertColumns.push("first_name");
            insertValues.push(firstName);
          }
          if (remedialTeacherInfo.columns.has("middle_name")) {
            insertColumns.push("middle_name");
            insertValues.push(middleName);
          }
          if (remedialTeacherInfo.columns.has("last_name")) {
            insertColumns.push("last_name");
            insertValues.push(lastName);
          }
          if (remedialTeacherInfo.columns.has("suffix")) {
            insertColumns.push("suffix");
            insertValues.push(suffix);
          }
          if (remedialTeacherInfo.columns.has("name")) {
            insertColumns.push("name");
            insertValues.push(fullName);
          }
          if (remedialTeacherInfo.columns.has("email")) {
            insertColumns.push("email");
            insertValues.push(email);
          }
          if (remedialTeacherInfo.columns.has("contact_number")) {
            insertColumns.push("contact_number");
            insertValues.push(phoneNumber);
          }
          if (remedialTeacherInfo.columns.has("phone_number")) {
            insertColumns.push("phone_number");
            insertValues.push(phoneNumber);
          }
          for (const column of [
            "grade",
            "grade_level",
            "gradeLevel",
            "year_level",
            "handled_grade",
            "remedial_grade",
            "remedial_teacher_grade",
          ]) {
            if (remedialTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(grade);
            }
          }
          if (subjects) {
            for (const column of ["subjects", "handled_subjects", "subject"]) {
              if (remedialTeacherInfo.columns.has(column)) {
                insertColumns.push(column);
                insertValues.push(subjects);
              }
            }
          }
          if (remedialTeacherInfo.columns.has("status")) {
            insertColumns.push("status");
            insertValues.push("Active");
          }
          if (remedialTeacherInfo.columns.has("created_at")) {
            insertColumns.push("created_at");
            insertValues.push(now);
          }
          if (remedialTeacherInfo.columns.has("updated_at")) {
            insertColumns.push("updated_at");
            insertValues.push(now);
          }
        });
      }

      await connection.commit();

      const record = {
        userId,
        teacherId: teacherIdValue,
        firstName,
        middleName,
        lastName,
        name: fullName,
        email,
        contactNumber: phoneNumber,
        grade,
        section: section ?? null,
        subjects: subjects ?? null,
        status: "Active",
        lastLogin: null,
        suffix,
      };

      return { userId, record };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });

  return {
    userId: result.userId,
    record: result.record,
    temporaryPassword,
  };
}

export async function createTeachersBulk(items: BulkCreateTeacherItem[]): Promise<BulkCreateTeacherResult> {
  if (items.length === 0) {
    return { inserted: [], failures: [] };
  }

  return runWithConnection(async (connection) => {
    const failures: BulkCreateTeacherResult["failures"] = [];
    const inserted: BulkCreateTeacherResult["inserted"] = [];

    const userColumns = await getColumnsForTable(connection, "users");
    const teacherInfo = await resolveTeacherTable(connection);
    const remedialTeacherInfo = await resolveRemedialTeacherTable(connection);
    const teacherHandledColumns = await getColumnsForTable(connection, "teacher_handled").catch(() => new Set<string>());

    const teacherIdSources: Array<{ table: string; column: string }> = [];
    if (userColumns.has("teacher_id")) {
      teacherIdSources.push({ table: "users", column: "teacher_id" });
    }
    if (teacherInfo.table) {
      for (const column of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
        if (teacherInfo.columns.has(column)) {
          teacherIdSources.push({ table: teacherInfo.table, column });
        }
      }
    }
    if (remedialTeacherInfo.table) {
      for (const column of ["teacher_id", "teacherid", "faculty_id", "master_teacher_id"]) {
        if (remedialTeacherInfo.columns.has(column)) {
          teacherIdSources.push({ table: remedialTeacherInfo.table, column });
        }
      }
    }
    try {
      const archivedColumns = await getColumnsForTable(connection, "archived_users");
      if (archivedColumns.has("teacher_id")) {
        teacherIdSources.push({ table: "archived_users", column: "teacher_id" });
      } else if (archivedColumns.has("user_code")) {
        teacherIdSources.push({ table: "archived_users", column: "user_code" });
      }
    } catch {
      // ignore archived_users absence
    }

    let teacherRoleId: number | null = null;
    try {
      const roleColumns = await getColumnsForTable(connection, "role");
      if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
        const [roleRows] = await connection.query<RowDataPacket[]>(
          "SELECT role_id FROM role WHERE LOWER(role_name) IN ('teacher','faculty','instructor') LIMIT 1",
        );
        if (Array.isArray(roleRows) && roleRows.length > 0) {
          const parsed = Number(roleRows[0].role_id);
          teacherRoleId = Number.isFinite(parsed) ? parsed : null;
        }
      }
    } catch {
      teacherRoleId = null;
    }

    const requestTime = new Date();
    const currentYear = requestTime.getFullYear();
    const generatedTeacherId = await generateTeacherId(connection, teacherIdSources, currentYear);
    let nextTeacherSequence = parseTeacherIdSequence(generatedTeacherId) ?? 1;
    const yearSuffix = String(currentYear).slice(-2);

    const prepared = items.map((item) => {
      const fullName = buildFullName(item.firstName, item.middleName, item.lastName, item.suffix ?? null);
      const temporaryPassword = generateTemporaryPassword();
      const teacherIdValue = item.teacherId
        ? formatTeacherIdentifier(item.teacherId, undefined, currentYear)
        : `TE-${yearSuffix}${String(nextTeacherSequence++).padStart(4, "0")}`;
      return {
        ...item,
        fullName,
        temporaryPassword,
        teacherIdValue,
      };
    });

    const emailList = prepared.map((entry) => entry.email);
    const existingEmails = new Set<string>();
    for (const chunk of chunkArray(emailList, BULK_INSERT_CHUNK_SIZE)) {
      const placeholders = buildPlaceholders(chunk.length);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT email FROM users WHERE email IN (${placeholders})`,
        chunk,
      );
      for (const row of rows) {
        if (typeof row.email === "string") {
          existingEmails.add(row.email.toLowerCase());
        }
      }
    }

    const pending = prepared.filter((entry) => {
      if (existingEmails.has(entry.email.toLowerCase())) {
        failures.push({ index: entry.index, email: entry.email, error: "Email already exists." });
        return false;
      }
      return true;
    });

    const userInsertColumns: string[] = [];
    if (userColumns.has("first_name")) userInsertColumns.push("first_name");
    if (userColumns.has("middle_name")) userInsertColumns.push("middle_name");
    if (userColumns.has("last_name")) userInsertColumns.push("last_name");
    if (userColumns.has("suffix")) userInsertColumns.push("suffix");
    if (userColumns.has("name")) userInsertColumns.push("name");
    if (userColumns.has("email")) userInsertColumns.push("email");
    if (userColumns.has("username")) userInsertColumns.push("username");
    if (userColumns.has("contact_number")) userInsertColumns.push("contact_number");
    if (userColumns.has("phone_number")) userInsertColumns.push("phone_number");
    if (userColumns.has("role")) userInsertColumns.push("role");
    if (userColumns.has("role_id") && teacherRoleId !== null) userInsertColumns.push("role_id");
    for (const column of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
      if (userColumns.has(column)) userInsertColumns.push(column);
    }
    if (userColumns.has("user_code")) userInsertColumns.push("user_code");
    if (userColumns.has("status")) userInsertColumns.push("status");
    if (userColumns.has("password")) userInsertColumns.push("password");
    if (userColumns.has("created_at")) userInsertColumns.push("created_at");
    if (userColumns.has("updated_at")) userInsertColumns.push("updated_at");

    if (userInsertColumns.length === 0) {
      throw new HttpError(500, "Unable to determine columns for users table.");
    }

    const userColumnsSql = userInsertColumns.map((column) => `\`${column}\``).join(", ");
    const userRowPlaceholder = `(${buildPlaceholders(userInsertColumns.length)})`;

    const buildUserRowValues = (entry: typeof pending[number]): any[] => {
      const values: any[] = [];
      for (const column of userInsertColumns) {
        if (column === "first_name") values.push(entry.firstName);
        else if (column === "middle_name") values.push(entry.middleName);
        else if (column === "last_name") values.push(entry.lastName);
        else if (column === "suffix") values.push(entry.suffix ?? null);
        else if (column === "name") values.push(entry.fullName);
        else if (column === "email") values.push(entry.email);
        else if (column === "username") values.push(entry.email);
        else if (column === "contact_number") values.push(entry.phoneNumber);
        else if (column === "phone_number") values.push(entry.phoneNumber);
        else if (column === "role") values.push("teacher");
        else if (column === "role_id") values.push(teacherRoleId);
        else if (["teacher_id", "teacherid", "employee_id", "faculty_id"].includes(column)) values.push(entry.teacherIdValue);
        else if (column === "user_code") values.push(entry.teacherIdValue);
        else if (column === "status") values.push("Active");
        else if (column === "password") values.push(entry.temporaryPassword);
        else if (column === "created_at") values.push(requestTime);
        else if (column === "updated_at") values.push(requestTime);
        else values.push(null);
      }
      return values;
    };

    const teacherInsertColumns: string[] = [];
    if (teacherInfo.table) {
      if (teacherInfo.columns.has("user_id")) teacherInsertColumns.push("user_id");
      for (const candidate of ["teacher_id", "teacherid", "employee_id", "faculty_id"]) {
        if (teacherInfo.columns.has(candidate)) teacherInsertColumns.push(candidate);
      }
      if (teacherInfo.columns.has("first_name")) teacherInsertColumns.push("first_name");
      if (teacherInfo.columns.has("middle_name")) teacherInsertColumns.push("middle_name");
      if (teacherInfo.columns.has("last_name")) teacherInsertColumns.push("last_name");
      if (teacherInfo.columns.has("suffix")) teacherInsertColumns.push("suffix");
      if (teacherInfo.columns.has("name")) teacherInsertColumns.push("name");
      if (teacherInfo.columns.has("email")) teacherInsertColumns.push("email");
      if (teacherInfo.columns.has("contact_number")) teacherInsertColumns.push("contact_number");
      if (teacherInfo.columns.has("phone_number")) teacherInsertColumns.push("phone_number");
      for (const column of ["grade", "grade_level", "year_level", "handled_grade"]) {
        if (teacherInfo.columns.has(column)) teacherInsertColumns.push(column);
      }
      for (const column of ["section", "section_name", "class_section"]) {
        if (teacherInfo.columns.has(column)) teacherInsertColumns.push(column);
      }
      for (const column of ["subjects", "handled_subjects", "subject"]) {
        if (teacherInfo.columns.has(column)) teacherInsertColumns.push(column);
      }
      if (teacherInfo.columns.has("status")) teacherInsertColumns.push("status");
      if (teacherInfo.columns.has("role")) teacherInsertColumns.push("role");
      if (teacherInfo.columns.has("created_at")) teacherInsertColumns.push("created_at");
      if (teacherInfo.columns.has("updated_at")) teacherInsertColumns.push("updated_at");
    }

    const remedialInsertColumns: string[] = [];
    if (remedialTeacherInfo.table && remedialTeacherInfo.table !== teacherInfo.table) {
      if (remedialTeacherInfo.columns.has("user_id")) remedialInsertColumns.push("user_id");
      for (const candidate of ["teacher_id", "teacherid", "faculty_id", "master_teacher_id"]) {
        if (remedialTeacherInfo.columns.has(candidate)) remedialInsertColumns.push(candidate);
      }
      if (remedialTeacherInfo.columns.has("first_name")) remedialInsertColumns.push("first_name");
      if (remedialTeacherInfo.columns.has("middle_name")) remedialInsertColumns.push("middle_name");
      if (remedialTeacherInfo.columns.has("last_name")) remedialInsertColumns.push("last_name");
      if (remedialTeacherInfo.columns.has("suffix")) remedialInsertColumns.push("suffix");
      if (remedialTeacherInfo.columns.has("name")) remedialInsertColumns.push("name");
      if (remedialTeacherInfo.columns.has("email")) remedialInsertColumns.push("email");
      if (remedialTeacherInfo.columns.has("contact_number")) remedialInsertColumns.push("contact_number");
      if (remedialTeacherInfo.columns.has("phone_number")) remedialInsertColumns.push("phone_number");
      for (const column of [
        "grade",
        "grade_level",
        "gradeLevel",
        "year_level",
        "handled_grade",
        "remedial_grade",
        "remedial_teacher_grade",
      ]) {
        if (remedialTeacherInfo.columns.has(column)) remedialInsertColumns.push(column);
      }
      for (const column of ["subjects", "handled_subjects", "subject"]) {
        if (remedialTeacherInfo.columns.has(column)) remedialInsertColumns.push(column);
      }
      if (remedialTeacherInfo.columns.has("status")) remedialInsertColumns.push("status");
      if (remedialTeacherInfo.columns.has("created_at")) remedialInsertColumns.push("created_at");
      if (remedialTeacherInfo.columns.has("updated_at")) remedialInsertColumns.push("updated_at");
    }

    for (const chunk of chunkArray(pending, BULK_INSERT_CHUNK_SIZE)) {
      await connection.beginTransaction();
      try {
        const userValues: any[] = [];
        const userPlaceholders: string[] = [];
        for (const entry of chunk) {
          userValues.push(...buildUserRowValues(entry));
          userPlaceholders.push(userRowPlaceholder);
        }

        await connection.query<ResultSetHeader>(
          `INSERT INTO users (${userColumnsSql}) VALUES ${userPlaceholders.join(", ")}`,
          userValues,
        );

        const userIdByEmail = new Map<string, number>();
        const chunkEmails = chunk.map((entry) => entry.email);
        for (const emailChunk of chunkArray(chunkEmails, BULK_INSERT_CHUNK_SIZE)) {
          const placeholders = buildPlaceholders(emailChunk.length);
          const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT user_id, email FROM users WHERE email IN (${placeholders})`,
            emailChunk,
          );
          for (const row of rows) {
            if (typeof row.email === "string") {
              const id = Number(row.user_id);
              if (Number.isInteger(id)) {
                userIdByEmail.set(row.email.toLowerCase(), id);
              }
            }
          }
        }

        if (teacherInfo.table && teacherInsertColumns.length > 0) {
          const teacherColumnSql = teacherInsertColumns.map((column) => `\`${column}\``).join(", ");
          const teacherRowPlaceholder = `(${buildPlaceholders(teacherInsertColumns.length)})`;
          const teacherValues: any[] = [];
          const teacherPlaceholders: string[] = [];
          for (const entry of chunk) {
            const userId = userIdByEmail.get(entry.email.toLowerCase());
            if (!userId) {
              continue;
            }
            for (const column of teacherInsertColumns) {
              if (column === "user_id") teacherValues.push(userId);
              else if (["teacher_id", "teacherid", "employee_id", "faculty_id"].includes(column)) teacherValues.push(entry.teacherIdValue);
              else if (column === "first_name") teacherValues.push(entry.firstName);
              else if (column === "middle_name") teacherValues.push(entry.middleName);
              else if (column === "last_name") teacherValues.push(entry.lastName);
              else if (column === "suffix") teacherValues.push(entry.suffix ?? null);
              else if (column === "name") teacherValues.push(entry.fullName);
              else if (column === "email") teacherValues.push(entry.email);
              else if (column === "contact_number") teacherValues.push(entry.phoneNumber);
              else if (column === "phone_number") teacherValues.push(entry.phoneNumber);
              else if (["grade", "grade_level", "year_level", "handled_grade"].includes(column)) teacherValues.push(entry.grade);
              else if (["section", "section_name", "class_section"].includes(column)) teacherValues.push(entry.section ?? null);
              else if (["subjects", "handled_subjects", "subject"].includes(column)) teacherValues.push(entry.subjects ?? null);
              else if (column === "status") teacherValues.push("Active");
              else if (column === "role") teacherValues.push("teacher");
              else if (column === "created_at") teacherValues.push(requestTime);
              else if (column === "updated_at") teacherValues.push(requestTime);
              else teacherValues.push(null);
            }
            teacherPlaceholders.push(teacherRowPlaceholder);
          }
          if (teacherPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${teacherInfo.table}\` (${teacherColumnSql}) VALUES ${teacherPlaceholders.join(", ")}`,
              teacherValues,
            );
          }
        }

        if (teacherHandledColumns.has("teacher_id") && teacherHandledColumns.has("grade_id")) {
          const handledValues: any[] = [];
          const handledPlaceholders: string[] = [];
          for (const entry of chunk) {
            const gradeIdNumeric = Number.parseInt(entry.grade, 10);
            if (Number.isFinite(gradeIdNumeric) && gradeIdNumeric > 0) {
              handledValues.push(entry.teacherIdValue, gradeIdNumeric);
              handledPlaceholders.push("(?, ?)");
            }
          }
          if (handledPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`teacher_handled\` (teacher_id, grade_id) VALUES ${handledPlaceholders.join(", ")}`,
              handledValues,
            );
          }
        }

        if (remedialTeacherInfo.table && remedialInsertColumns.length > 0) {
          const remedialColumnSql = remedialInsertColumns.map((column) => `\`${column}\``).join(", ");
          const remedialRowPlaceholder = `(${buildPlaceholders(remedialInsertColumns.length)})`;
          const remedialValues: any[] = [];
          const remedialPlaceholders: string[] = [];
          for (const entry of chunk) {
            const userId = userIdByEmail.get(entry.email.toLowerCase());
            if (!userId) {
              continue;
            }
            for (const column of remedialInsertColumns) {
              if (column === "user_id") remedialValues.push(userId);
              else if (["teacher_id", "teacherid", "faculty_id", "master_teacher_id"].includes(column)) remedialValues.push(entry.teacherIdValue);
              else if (column === "first_name") remedialValues.push(entry.firstName);
              else if (column === "middle_name") remedialValues.push(entry.middleName);
              else if (column === "last_name") remedialValues.push(entry.lastName);
              else if (column === "suffix") remedialValues.push(entry.suffix ?? null);
              else if (column === "name") remedialValues.push(entry.fullName);
              else if (column === "email") remedialValues.push(entry.email);
              else if (column === "contact_number") remedialValues.push(entry.phoneNumber);
              else if (column === "phone_number") remedialValues.push(entry.phoneNumber);
              else if ([
                "grade",
                "grade_level",
                "gradeLevel",
                "year_level",
                "handled_grade",
                "remedial_grade",
                "remedial_teacher_grade",
              ].includes(column)) remedialValues.push(entry.grade);
              else if (["subjects", "handled_subjects", "subject"].includes(column)) remedialValues.push(entry.subjects ?? null);
              else if (column === "status") remedialValues.push("Active");
              else if (column === "created_at") remedialValues.push(requestTime);
              else if (column === "updated_at") remedialValues.push(requestTime);
              else remedialValues.push(null);
            }
            remedialPlaceholders.push(remedialRowPlaceholder);
          }
          if (remedialPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${remedialTeacherInfo.table}\` (${remedialColumnSql}) VALUES ${remedialPlaceholders.join(", ")}`,
              remedialValues,
            );
          }
        }

        await connection.commit();

        for (const entry of chunk) {
          const userId = userIdByEmail.get(entry.email.toLowerCase());
          if (!userId) {
            failures.push({ index: entry.index, email: entry.email, error: "Failed to resolve user ID." });
            continue;
          }
          inserted.push({
            index: entry.index,
            userId,
            temporaryPassword: entry.temporaryPassword,
            record: {
              userId,
              teacherId: entry.teacherIdValue,
              firstName: entry.firstName,
              middleName: entry.middleName,
              lastName: entry.lastName,
              name: entry.fullName,
              email: entry.email,
              contactNumber: entry.phoneNumber,
              grade: entry.grade,
              section: entry.section ?? null,
              subjects: entry.subjects ?? null,
              status: "Active",
              lastLogin: null,
              suffix: entry.suffix ?? null,
            },
          });
        }
      } catch (error) {
        await connection.rollback();
        for (const entry of chunk) {
          try {
            const singleResult = await createTeacher(entry);
            inserted.push({
              index: entry.index,
              userId: singleResult.userId,
              record: singleResult.record,
              temporaryPassword: singleResult.temporaryPassword,
            });
          } catch (singleError) {
            const errorMessage = singleError instanceof HttpError
              ? singleError.message
              : "Unexpected error while importing.";
            failures.push({ index: entry.index, email: entry.email, error: errorMessage });
          }
        }
      }
    }

    return { inserted, failures };
  });
}