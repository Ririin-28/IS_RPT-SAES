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

      if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
        const masterTeacherInsertColumns: string[] = [];
        const masterTeacherValues: any[] = [];

        masterTeacherInsertColumns.push("user_id");
        masterTeacherValues.push(userId);

        if (masterTeacherInfo.columns.has("master_teacher_id")) {
          masterTeacherInsertColumns.push("master_teacher_id");
          masterTeacherValues.push(String(userId));
        }
        if (masterTeacherInfo.columns.has("masterteacher_id")) {
          masterTeacherInsertColumns.push("masterteacher_id");
          masterTeacherValues.push(String(userId));
        }
        if (teacherId) {
          for (const column of ["teacher_id", "employee_id"]) {
            if (masterTeacherInfo.columns.has(column)) {
              masterTeacherInsertColumns.push(column);
              masterTeacherValues.push(teacherId);
            }
          }
        }
        if (masterTeacherInfo.columns.has("first_name")) {
          masterTeacherInsertColumns.push("first_name");
          masterTeacherValues.push(firstName);
        }
        if (masterTeacherInfo.columns.has("middle_name")) {
          masterTeacherInsertColumns.push("middle_name");
          masterTeacherValues.push(middleName);
        }
        if (masterTeacherInfo.columns.has("last_name")) {
          masterTeacherInsertColumns.push("last_name");
          masterTeacherValues.push(lastName);
        }
        if (masterTeacherInfo.columns.has("suffix")) {
          masterTeacherInsertColumns.push("suffix");
          masterTeacherValues.push(suffix);
        }
        if (masterTeacherInfo.columns.has("name")) {
          masterTeacherInsertColumns.push("name");
          masterTeacherValues.push(fullName);
        }
        if (masterTeacherInfo.columns.has("email")) {
          masterTeacherInsertColumns.push("email");
          masterTeacherValues.push(email);
        }
        if (masterTeacherInfo.columns.has("contact_number")) {
          masterTeacherInsertColumns.push("contact_number");
          masterTeacherValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("phone_number")) {
          masterTeacherInsertColumns.push("phone_number");
          masterTeacherValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("grade")) {
          masterTeacherInsertColumns.push("grade");
          masterTeacherValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("handled_grade")) {
          masterTeacherInsertColumns.push("handled_grade");
          masterTeacherValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("grade_level")) {
          masterTeacherInsertColumns.push("grade_level");
          masterTeacherValues.push(grade);
        }
        if (section) {
          for (const column of ["section", "section_name", "class_section"]) {
            if (masterTeacherInfo.columns.has(column)) {
              masterTeacherInsertColumns.push(column);
              masterTeacherValues.push(section);
            }
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (masterTeacherInfo.columns.has(column)) {
              masterTeacherInsertColumns.push(column);
              masterTeacherValues.push(subjects);
            }
          }
        }
        for (const column of ["mt_coordinator", "coordinator_subject", "coordinator", "coordinatorSubject"]) {
          if (masterTeacherInfo.columns.has(column)) {
            masterTeacherInsertColumns.push(column);
            masterTeacherValues.push(coordinatorSubject);
          }
        }
        if (masterTeacherInfo.columns.has("status")) {
          masterTeacherInsertColumns.push("status");
          masterTeacherValues.push("Active");
        }
        if (masterTeacherInfo.columns.has("role")) {
          masterTeacherInsertColumns.push("role");
          masterTeacherValues.push("master_teacher");
        }
        if (masterTeacherInfo.columns.has("created_at")) {
          masterTeacherInsertColumns.push("created_at");
          masterTeacherValues.push(now);
        }
        if (masterTeacherInfo.columns.has("updated_at")) {
          masterTeacherInsertColumns.push("updated_at");
          masterTeacherValues.push(now);
        }

        if (masterTeacherInsertColumns.length > 1) {
          const masterTeacherColumnsSql = masterTeacherInsertColumns.map((column) => `\`${column}\``).join(", ");
          const masterTeacherPlaceholders = masterTeacherInsertColumns.map(() => "?").join(", ");

          await connection.query<ResultSetHeader>(
            `INSERT INTO \`${masterTeacherInfo.table}\` (${masterTeacherColumnsSql}) VALUES (${masterTeacherPlaceholders})`,
            masterTeacherValues,
          );
        }
      }

      await connection.commit();

      const record = {
        userId,
        masterTeacherId: teacherId ?? String(userId),
        teacherId: teacherId ?? null,
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