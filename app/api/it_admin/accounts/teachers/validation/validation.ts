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

const TEACHER_TABLE_CANDIDATES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_accounts",
  "faculty",
  "teacher_tbl",
  "remedial_teacher",
  "remedial_teachers",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
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

export async function createTeacher(input: CreateTeacherInput): Promise<CreateTeacherResult> {
  const { firstName, middleName, lastName, suffix, email, phoneNumber, grade, section, subjects, teacherId } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();

  const result = await runWithConnection(async (connection) => {
    const userColumns = await getColumnsForTable(connection, "users");
    const teacherInfo = await resolveTeacherTable(connection);

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
        userInsertValues.push("teacher");
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

      if (teacherInfo.table && teacherInfo.columns.size > 0) {
        const teacherInsertColumns: string[] = [];
        const teacherValues: any[] = [];

        teacherInsertColumns.push("user_id");
        teacherValues.push(userId);

        const teacherIdValue = teacherId ?? String(userId);

        for (const candidate of [
          "teacher_id",
          "teacherid",
          "employee_id",
          "faculty_id",
        ]) {
          if (teacherInfo.columns.has(candidate)) {
            teacherInsertColumns.push(candidate);
            teacherValues.push(teacherIdValue);
          }
        }

        if (teacherInfo.columns.has("first_name")) {
          teacherInsertColumns.push("first_name");
          teacherValues.push(firstName);
        }
        if (teacherInfo.columns.has("middle_name")) {
          teacherInsertColumns.push("middle_name");
          teacherValues.push(middleName);
        }
        if (teacherInfo.columns.has("last_name")) {
          teacherInsertColumns.push("last_name");
          teacherValues.push(lastName);
        }
        if (teacherInfo.columns.has("suffix")) {
          teacherInsertColumns.push("suffix");
          teacherValues.push(suffix);
        }
        if (teacherInfo.columns.has("name")) {
          teacherInsertColumns.push("name");
          teacherValues.push(fullName);
        }
        if (teacherInfo.columns.has("email")) {
          teacherInsertColumns.push("email");
          teacherValues.push(email);
        }
        if (teacherInfo.columns.has("contact_number")) {
          teacherInsertColumns.push("contact_number");
          teacherValues.push(phoneNumber);
        }
        if (teacherInfo.columns.has("phone_number")) {
          teacherInsertColumns.push("phone_number");
          teacherValues.push(phoneNumber);
        }
        for (const column of ["grade", "grade_level", "year_level", "handled_grade"]) {
          if (teacherInfo.columns.has(column)) {
            teacherInsertColumns.push(column);
            teacherValues.push(grade);
          }
        }
        if (section) {
          for (const column of ["section", "section_name", "class_section"]) {
            if (teacherInfo.columns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(section);
            }
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (teacherInfo.columns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(subjects);
            }
          }
        }
        if (teacherInfo.columns.has("status")) {
          teacherInsertColumns.push("status");
          teacherValues.push("Active");
        }
        if (teacherInfo.columns.has("role")) {
          teacherInsertColumns.push("role");
          teacherValues.push("teacher");
        }
        if (teacherInfo.columns.has("created_at")) {
          teacherInsertColumns.push("created_at");
          teacherValues.push(now);
        }
        if (teacherInfo.columns.has("updated_at")) {
          teacherInsertColumns.push("updated_at");
          teacherValues.push(now);
        }

        if (teacherInsertColumns.length > 1) {
          const teacherColumnsSql = teacherInsertColumns.map((column) => `\`${column}\``).join(", ");
          const teacherPlaceholders = teacherInsertColumns.map(() => "?").join(", ");

          await connection.query<ResultSetHeader>(
            `INSERT INTO \`${teacherInfo.table}\` (${teacherColumnsSql}) VALUES (${teacherPlaceholders})`,
            teacherValues,
          );
        }
      }

      await connection.commit();

      const record = {
        userId,
        teacherId: teacherId ?? String(userId),
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