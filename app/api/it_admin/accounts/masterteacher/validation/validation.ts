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
const COORDINATOR_SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;

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

export function sanitizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeCoordinatorSubject(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Coordinator subject is required.");
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new HttpError(400, "Coordinator subject is required.");
  }
  const match = COORDINATOR_SUBJECT_OPTIONS.find(
    (option) => option.toLowerCase() === normalized.toLowerCase(),
  );
  if (!match) {
    throw new HttpError(400, `Coordinator subject must be one of: ${COORDINATOR_SUBJECT_OPTIONS.join(", ")}.`);
  }
  return match;
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

const MASTER_TEACHER_ID_PATTERN = /^MT-\d{2}\d{4,}$/;

export function formatMasterTeacherIdentifier(
  raw: string | null | undefined,
  fallbackSequence?: number | null,
  yearOverride?: number | null,
): string {
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (normalized && MASTER_TEACHER_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  const sequenceValue = typeof fallbackSequence === "number" && Number.isFinite(fallbackSequence)
    ? Math.max(1, Math.trunc(fallbackSequence))
    : 1;

  return `MT-${year}${String(sequenceValue).padStart(4, "0")}`;
}

async function generateMasterTeacherId(
  connection: PoolConnection,
  sources: Array<{ table: string; column: string }>,
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);

  let maxSequence = 0;

  for (const source of sources) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${source.column}\` AS master_teacher_id FROM \`${source.table}\` WHERE \`${source.column}\` LIKE ? ORDER BY \`${source.column}\` DESC LIMIT 1`,
      [`MT-${year}%`],
    );

    if (rows.length === 0) {
      continue;
    }

    const lastId = rows[0]?.master_teacher_id;
    const match = typeof lastId === "string" ? lastId.match(/MT-\d{2}(\d{4,})$/) : null;
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxSequence = Math.max(maxSequence, parsed);
      }
    }
  }

  const nextNum = maxSequence + 1;
  return `MT-${year}${String(nextNum).padStart(4, "0")}`;
}

export interface CreateMasterTeacherInput {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  suffix: string | null;
  grade: string;
  section?: string | null;
  subjects?: string | null;
  coordinatorSubject: string;
  teacherId?: string | null;
}

export interface CreateMasterTeacherResult {
  userId: number;
  record: {
    userId: number;
    masterTeacherId: string;
    teacherId: string | null;
    firstName: string;
    middleName: string | null;
    lastName: string;
    name: string;
    email: string;
    contactNumber: string;
    grade: string;
    section: string | null;
    subjects: string | null;
    coordinatorSubject: string;
    status: string;
    lastLogin: null;
    suffix: string | null;
  };
  temporaryPassword: string;
}

const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

const REMEDIAL_TEACHER_TABLE_CANDIDATES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedialteacher",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
] as const;

const MT_COORDINATOR_TABLE_CANDIDATES = [
  "mt_coordinator",
  "mt_coordinators",
  "mtcoordinator",
  "mt_coordinator_info",
  "mt_coordinator_tbl",
] as const;

async function resolveMasterTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
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

async function resolveMtCoordinatorTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MT_COORDINATOR_TABLE_CANDIDATES) {
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

export async function createMasterTeacher(input: CreateMasterTeacherInput): Promise<CreateMasterTeacherResult> {
  const {
    firstName,
    middleName,
    lastName,
    suffix,
    email,
    phoneNumber,
    grade,
    section,
    subjects,
    coordinatorSubject,
    teacherId,
  } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();

  const result = await runWithConnection(async (connection) => {
  const userColumns = await getColumnsForTable(connection, "users");
  const masterTeacherInfo = await resolveMasterTeacherTable(connection);
  const remedialTeacherInfo = await resolveRemedialTeacherTable(connection);
  const mtCoordinatorInfo = await resolveMtCoordinatorTable(connection);

  const masterTeacherIdSources: Array<{ table: string; column: string }> = [];
  if (userColumns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: "users", column: "master_teacher_id" });
  }
  if (masterTeacherInfo.table) {
    if (masterTeacherInfo.columns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "master_teacher_id" });
    }
    if (masterTeacherInfo.columns.has("masterteacher_id")) {
      masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "masterteacher_id" });
    }
  }
  if (remedialTeacherInfo.table && remedialTeacherInfo.columns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: remedialTeacherInfo.table, column: "master_teacher_id" });
  }
  if (mtCoordinatorInfo.table && mtCoordinatorInfo.columns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: mtCoordinatorInfo.table, column: "master_teacher_id" });
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
        userInsertValues.push("master_teacher");
      }
      if (userColumns.has("status")) {
        userInsertColumns.push("status");
        userInsertValues.push("Active");
      }
      if (userColumns.has("password")) {
        userInsertColumns.push("password");
        userInsertValues.push(temporaryPassword);
      }
      const now = new Date();
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

      let generatedMasterTeacherId: string | null = null;
      if (masterTeacherIdSources.length > 0) {
        generatedMasterTeacherId = await generateMasterTeacherId(connection, masterTeacherIdSources);
      }

      const masterTeacherId = formatMasterTeacherIdentifier(generatedMasterTeacherId, userId);
      const teacherIdentifier = teacherId ?? masterTeacherId;

      if (userColumns.has("master_teacher_id")) {
        await connection.query<ResultSetHeader>(
          "UPDATE `users` SET `master_teacher_id` = ? WHERE `user_id` = ? LIMIT 1",
          [masterTeacherId, userId],
        );
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

      await insertIntoFlexibleTable(masterTeacherInfo, (insertColumns, insertValues) => {
        const identifierPairs: Array<[string, any]> = [];
        if (masterTeacherInfo.columns.has("user_id")) {
          identifierPairs.push(["user_id", userId]);
        }
        if (masterTeacherInfo.columns.has("master_teacher_id")) {
          identifierPairs.push(["master_teacher_id", masterTeacherId]);
        }
        if (masterTeacherInfo.columns.has("masterteacher_id")) {
          identifierPairs.push(["masterteacher_id", masterTeacherId]);
        }
        for (const column of ["teacher_id", "employee_id"]) {
          if (masterTeacherInfo.columns.has(column)) {
            identifierPairs.push([column, teacherIdentifier]);
          }
        }

        if (identifierPairs.length === 0) {
          return;
        }

        for (const [column, value] of identifierPairs) {
          insertColumns.push(column);
          insertValues.push(value);
        }

        if (masterTeacherInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (masterTeacherInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (masterTeacherInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (masterTeacherInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (masterTeacherInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (masterTeacherInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (masterTeacherInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("remedial_teacher_grade")) {
          insertColumns.push("remedial_teacher_grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("grade")) {
          insertColumns.push("grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("handled_grade")) {
          insertColumns.push("handled_grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("grade_level")) {
          insertColumns.push("grade_level");
          insertValues.push(grade);
        }
        if (section) {
          for (const column of ["section", "section_name", "class_section"]) {
            if (masterTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(section);
            }
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (masterTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(subjects);
            }
          }
        }
        if (masterTeacherInfo.columns.has("subject_handled")) {
          insertColumns.push("subject_handled");
          insertValues.push(coordinatorSubject);
        }
        for (const column of ["mt_coordinator", "coordinator_subject", "coordinator", "coordinatorSubject"]) {
          if (masterTeacherInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(coordinatorSubject);
          }
        }
        if (masterTeacherInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (masterTeacherInfo.columns.has("role")) {
          insertColumns.push("role");
          insertValues.push("master_teacher");
        }
        if (masterTeacherInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (masterTeacherInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      await insertIntoFlexibleTable(remedialTeacherInfo, (insertColumns, insertValues) => {
        if (remedialTeacherInfo.columns.has("user_id")) {
          insertColumns.push("user_id");
          insertValues.push(userId);
        } else if (remedialTeacherInfo.columns.has("master_teacher_id")) {
          insertColumns.push("master_teacher_id");
          insertValues.push(masterTeacherId);
        } else if (remedialTeacherInfo.columns.has("teacher_id")) {
          insertColumns.push("teacher_id");
          insertValues.push(teacherIdentifier);
        }

        if (!insertColumns.length) {
          return;
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
          "handled_grade",
          "grade_level",
          "gradeLevel",
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

      await insertIntoFlexibleTable(mtCoordinatorInfo, (insertColumns, insertValues) => {
        if (!mtCoordinatorInfo.columns.has("subject_handled") &&
          !mtCoordinatorInfo.columns.has("subjects_handled") &&
          !mtCoordinatorInfo.columns.has("handled_subject") &&
          !mtCoordinatorInfo.columns.has("coordinator_subject")) {
          return;
        }

        if (mtCoordinatorInfo.columns.has("user_id")) {
          insertColumns.push("user_id");
          insertValues.push(userId);
        } else if (mtCoordinatorInfo.columns.has("master_teacher_id")) {
          insertColumns.push("master_teacher_id");
          insertValues.push(masterTeacherId);
        } else if (mtCoordinatorInfo.columns.has("teacher_id")) {
          insertColumns.push("teacher_id");
          insertValues.push(teacherIdentifier);
        }

        if (!insertColumns.length) {
          return;
        }

        if (mtCoordinatorInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (mtCoordinatorInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (mtCoordinatorInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (mtCoordinatorInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (mtCoordinatorInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (mtCoordinatorInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (mtCoordinatorInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (mtCoordinatorInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }

        for (const column of ["subject_handled", "subjects_handled", "handled_subject", "coordinator_subject"]) {
          if (mtCoordinatorInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(coordinatorSubject);
          }
        }

        if (mtCoordinatorInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (mtCoordinatorInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (mtCoordinatorInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      await connection.commit();

      const record = {
        userId,
        masterTeacherId,
        teacherId: teacherIdentifier,
        firstName,
        middleName,
        lastName,
        name: fullName,
        email,
        contactNumber: phoneNumber,
        grade,
        section: section ?? null,
        subjects: subjects ?? null,
        coordinatorSubject,
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