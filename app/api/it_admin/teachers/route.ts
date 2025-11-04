import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_FORMAT_REGEX = /^\+63-9\d{2}-\d{3}-\d{4}$/;
const TEACHER_TABLE_CANDIDATES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_accounts",
  "faculty",
  "teacher_tbl",
] as const;

interface SanitizedPhone {
  digitsInternational: string;
  digitsLocal: string;
  formatted: string;
  localDisplay: string;
}

function sanitizeNamePart(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    throw new HttpError(400, `${field} must be at least 2 characters.`);
  }
  return trimmed;
}

function sanitizeOptionalNamePart(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Email is required.");
  }
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new HttpError(400, "Invalid email format.");
  }
  return normalized;
}

function sanitizePhoneNumber(value: unknown): SanitizedPhone {
  if (typeof value !== "string") {
    throw new HttpError(400, "Contact number is required.");
  }
  const trimmed = value.trim();
  if (!PHONE_FORMAT_REGEX.test(trimmed)) {
    throw new HttpError(400, "Contact number must follow the format +63-9XX-XXX-XXXX.");
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits.startsWith("63") || digits.length !== 12) {
    throw new HttpError(400, "Contact number must include the +63 country code and contain 12 digits.");
  }

  const localDigits = digits.slice(-10);
  const localDisplay = `0${localDigits}`;

  return {
    digitsInternational: digits,
    digitsLocal: localDigits,
    formatted: trimmed,
    localDisplay,
  };
}

function sanitizeGrade(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized <= 0) {
      throw new HttpError(400, "Grade must be a positive number.");
    }
    return String(normalized);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new HttpError(400, "Grade is required.");
    }
    const match = trimmed.match(/\d+/);
    return match ? match[0] : trimmed;
  }

  throw new HttpError(400, "Grade is required.");
}

function sanitizeSubjects(value: unknown): string[] {
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

function sanitizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildFullName(firstName: string, middleName: string | null, lastName: string): string {
  const parts = [firstName, middleName, lastName].filter((part) => part && part.trim().length > 0);
  return parts.join(" ");
}

async function getColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

async function tryGetColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string> | null> {
  try {
    return await getColumnsForTable(connection, tableName);
  } catch {
    return null;
  }
}

async function resolveTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
    const columns = await tryGetColumnsForTable(connection, candidate);
    if (columns && columns.size > 0) {
      return { table: candidate, columns };
    }
  }
  return { table: null, columns: new Set<string>() };
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const firstName = sanitizeNamePart(payload?.firstName, "First name");
    const middleName = sanitizeOptionalNamePart(payload?.middleName);
    const lastName = sanitizeNamePart(payload?.lastName, "Last name");
    const email = sanitizeEmail(payload?.email);
    const { digitsInternational, digitsLocal, formatted, localDisplay } = sanitizePhoneNumber(payload?.phoneNumber ?? "");
  const grade = sanitizeGrade(payload?.grade);
  const subjects = sanitizeSubjects(payload?.subjects);
  const section = sanitizeOptionalString(payload?.section);
    const teacherIdentifier = sanitizeOptionalString(payload?.teacherId);
    const fullName = buildFullName(firstName, middleName, lastName);
    const temporaryPassword = generateTemporaryPassword();

    const result = await runWithConnection(async (connection) => {
      const userColumns = await getColumnsForTable(connection, "users");
      const { table: teacherTable, columns: teacherColumns } = await resolveTeacherTable(connection);

      await connection.beginTransaction();
      try {
        const [duplicateEmail] = await connection.query<RowDataPacket[]>(
          "SELECT user_id FROM users WHERE email = ? LIMIT 1",
          [email],
        );
        if (duplicateEmail.length > 0) {
          throw new HttpError(409, "Email already exists.");
        }

        const contactConditions: string[] = [];
        const contactParams: any[] = [];
        if (userColumns.has("contact_number")) {
          contactConditions.push("contact_number = ?");
          contactParams.push(digitsInternational);
        }
        if (userColumns.has("phone_number")) {
          contactConditions.push("phone_number = ?");
          contactParams.push(digitsInternational);
        }
        if (contactConditions.length > 0) {
          const [duplicateContact] = await connection.query<RowDataPacket[]>(
            `SELECT user_id FROM users WHERE ${contactConditions.join(" OR ")} LIMIT 1`,
            contactParams,
          );
          if (duplicateContact.length > 0) {
            throw new HttpError(409, "Contact number already exists.");
          }
        }

        if (teacherTable) {
          if (teacherColumns.has("email")) {
            const [duplicateTeacherEmail] = await connection.query<RowDataPacket[]>(
              `SELECT user_id FROM \`${teacherTable}\` WHERE email = ? LIMIT 1`,
              [email],
            );
            if (duplicateTeacherEmail.length > 0) {
              throw new HttpError(409, "Email already exists in teacher records.");
            }
          }

          const teacherContactConditions: string[] = [];
          const teacherContactParams: any[] = [];
          for (const column of ["contact_number", "phone_number", "mobile", "contact"]) {
            if (teacherColumns.has(column)) {
              teacherContactConditions.push(`${column} = ?`);
              teacherContactParams.push(digitsInternational);
            }
          }
          if (teacherContactConditions.length > 0) {
            const [duplicateTeacherContact] = await connection.query<RowDataPacket[]>(
              `SELECT user_id FROM \`${teacherTable}\` WHERE ${teacherContactConditions.join(" OR ")} LIMIT 1`,
              teacherContactParams,
            );
            if (duplicateTeacherContact.length > 0) {
              throw new HttpError(409, "Contact number already exists in teacher records.");
            }
          }

          if (teacherIdentifier) {
            const identifierColumns = [
              "teacher_id",
              "employee_id",
              "faculty_id",
              "teacherid",
              "user_id",
            ];
            const identifierConditions: string[] = [];
            const identifierParams: any[] = [];
            for (const column of identifierColumns) {
              if (teacherColumns.has(column)) {
                identifierConditions.push(`${column} = ?`);
                identifierParams.push(teacherIdentifier);
              }
            }
            if (identifierConditions.length > 0) {
              const [duplicateIdentifier] = await connection.query<RowDataPacket[]>(
                `SELECT user_id FROM \`${teacherTable}\` WHERE ${identifierConditions.join(" OR ")} LIMIT 1`,
                identifierParams,
              );
              if (duplicateIdentifier.length > 0) {
                throw new HttpError(409, "Teacher ID already exists in teacher records.");
              }
            }
          }
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
          userInsertValues.push(digitsInternational);
        }
        if (userColumns.has("phone_number")) {
          userInsertColumns.push("phone_number");
          userInsertValues.push(digitsInternational);
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
        const userPlaceholders = userInsertColumns.map(() => "?").join(", ");

        const [userResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO users (${userColumnsSql}) VALUES (${userPlaceholders})`,
          userInsertValues,
        );

        const userId = userResult.insertId;
        if (!userId) {
          throw new HttpError(500, "Failed to create user record.");
        }

        if (teacherTable) {
          const teacherInsertColumns: string[] = [];
          const teacherValues: any[] = [];

          teacherInsertColumns.push("user_id");
          teacherValues.push(userId);

          const teacherIdValue = teacherIdentifier ?? String(userId);

          for (const candidate of [
            "teacher_id",
            "teacherid",
            "employee_id",
            "faculty_id",
          ]) {
            if (teacherColumns.has(candidate)) {
              teacherInsertColumns.push(candidate);
              teacherValues.push(teacherIdValue);
            }
          }

          if (teacherColumns.has("first_name")) {
            teacherInsertColumns.push("first_name");
            teacherValues.push(firstName);
          }
          if (teacherColumns.has("middle_name")) {
            teacherInsertColumns.push("middle_name");
            teacherValues.push(middleName);
          }
          if (teacherColumns.has("last_name")) {
            teacherInsertColumns.push("last_name");
            teacherValues.push(lastName);
          }
          if (teacherColumns.has("name")) {
            teacherInsertColumns.push("name");
            teacherValues.push(fullName);
          }
          if (teacherColumns.has("email")) {
            teacherInsertColumns.push("email");
            teacherValues.push(email);
          }
          for (const column of ["contact_number", "phone_number", "mobile", "contact"]) {
            if (teacherColumns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(digitsInternational);
            }
          }
          if (teacherColumns.has("contact_number_display")) {
            teacherInsertColumns.push("contact_number_display");
            teacherValues.push(localDisplay);
          }
          for (const column of ["grade", "grade_level", "year_level", "handled_grade"]) {
            if (teacherColumns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(grade);
            }
          }
          if (teacherColumns.has("section") && section) {
            teacherInsertColumns.push("section");
            teacherValues.push(section);
          }
          const subjectsJoined = subjects.join(", ");
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (teacherColumns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(subjectsJoined);
            }
          }
          if (teacherColumns.has("status")) {
            teacherInsertColumns.push("status");
            teacherValues.push("Active");
          }
          if (teacherColumns.has("user_status")) {
            teacherInsertColumns.push("user_status");
            teacherValues.push("Active");
          }
          if (teacherColumns.has("account_status")) {
            teacherInsertColumns.push("account_status");
            teacherValues.push("Active");
          }
          if (teacherColumns.has("role")) {
            teacherInsertColumns.push("role");
            teacherValues.push("teacher");
          }
          if (teacherColumns.has("created_at")) {
            teacherInsertColumns.push("created_at");
            teacherValues.push(now);
          }
          if (teacherColumns.has("updated_at")) {
            teacherInsertColumns.push("updated_at");
            teacherValues.push(now);
          }

          if (teacherInsertColumns.length > 1) {
            const teacherColumnsSql = teacherInsertColumns.map((column) => `\`${column}\``).join(", ");
            const teacherPlaceholders = teacherInsertColumns.map(() => "?").join(", ");

            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${teacherTable}\` (${teacherColumnsSql}) VALUES (${teacherPlaceholders})`,
              teacherValues,
            );
          }
        }

        await connection.commit();

        const record = {
          userId,
          teacherId: teacherIdentifier ?? String(userId),
          firstName,
          middleName,
          lastName,
          name: fullName,
          email,
          contactNumber: formatted,
          contactNumberRaw: digitsLocal,
          contactNumberLocal: localDisplay,
          contactNumberInternational: digitsInternational,
          grade,
          handledGrade: grade,
          section,
          subjects,
          handledSubjects: subjects,
          status: "Active",
          lastLogin: null,
        };

        return { userId, record, temporaryPassword };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        temporaryPassword: result.temporaryPassword,
        record: result.record,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to add Teacher", error);
    return NextResponse.json({ error: "Failed to add Teacher." }, { status: 500 });
  }
}
