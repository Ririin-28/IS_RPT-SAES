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
const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

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

function sanitizeOptionalString(value: unknown): string | null {
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

function sanitizePhoneNumber(value: unknown): { digits: string; formatted: string; localDigits: string; localDisplay: string } {
  if (typeof value !== "string") {
    throw new HttpError(400, "Contact number is required.");
  }
  const trimmed = value.trim();
  if (!PHONE_FORMAT_REGEX.test(trimmed)) {
    throw new HttpError(400, "Contact number must follow the format +63-9XX-XXX-XXXX.");
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 12 || !digits.startsWith("63")) {
    throw new HttpError(400, "Contact number must include the +63 country code and contain 12 digits in total.");
  }

  const localDigits = digits.slice(-10);
  const localDisplay = `0${localDigits}`;

  return { digits, formatted: trimmed, localDigits, localDisplay };
}

function sanitizeGrade(value: unknown): string {
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

async function resolveMasterTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
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
    const { digits: phoneDigits, formatted: phoneFormatted, localDigits, localDisplay } = sanitizePhoneNumber(
      payload?.phoneNumber ?? "",
    );
    const grade = sanitizeGrade(payload?.grade);
    const section = sanitizeOptionalString(payload?.section);
    const subjects = Array.isArray(payload?.subjects) ? payload.subjects.join(", ") : null;
    const teacherIdentifier = sanitizeOptionalString(payload?.teacherId);
    const fullName = buildFullName(firstName, middleName, lastName);
    const temporaryPassword = generateTemporaryPassword();

    const result = await runWithConnection(async (connection) => {
      const userColumns = await getColumnsForTable(connection, "users");
      const { table: masterTeacherTable, columns: masterTeacherColumns } = await resolveMasterTeacherTable(connection);

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
          contactParams.push(phoneDigits);
        }
        if (userColumns.has("phone_number")) {
          contactConditions.push("phone_number = ?");
          contactParams.push(phoneDigits);
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

        if (masterTeacherTable) {
          if (masterTeacherColumns.has("email")) {
            const [duplicateMasterEmail] = await connection.query<RowDataPacket[]>(
              `SELECT user_id FROM \`${masterTeacherTable}\` WHERE email = ? LIMIT 1`,
              [email],
            );
            if (duplicateMasterEmail.length > 0) {
              throw new HttpError(409, "Email already exists in master teacher records.");
            }
          }

          const masterContactConditions: string[] = [];
          const masterContactParams: any[] = [];
          for (const column of ["contact_number", "phone_number", "mobile", "contact"]) {
            if (masterTeacherColumns.has(column)) {
              masterContactConditions.push(`${column} = ?`);
              masterContactParams.push(phoneDigits);
            }
          }
          if (masterContactConditions.length > 0) {
            const [duplicateMasterContact] = await connection.query<RowDataPacket[]>(
              `SELECT user_id FROM \`${masterTeacherTable}\` WHERE ${masterContactConditions.join(" OR ")} LIMIT 1`,
              masterContactParams,
            );
            if (duplicateMasterContact.length > 0) {
              throw new HttpError(409, "Contact number already exists in master teacher records.");
            }
          }

          if (teacherIdentifier) {
            const identifierColumns = ["master_teacher_id", "masterteacher_id", "teacher_id", "employee_id", "user_id"];
            const identifierConditions: string[] = [];
            const identifierParams: any[] = [];
            for (const column of identifierColumns) {
              if (masterTeacherColumns.has(column)) {
                identifierConditions.push(`${column} = ?`);
                identifierParams.push(teacherIdentifier);
              }
            }
            if (identifierConditions.length > 0) {
              const [duplicateIdentifier] = await connection.query<RowDataPacket[]>(
                `SELECT user_id FROM \`${masterTeacherTable}\` WHERE ${identifierConditions.join(" OR ")} LIMIT 1`,
                identifierParams,
              );
              if (duplicateIdentifier.length > 0) {
                throw new HttpError(409, "Teacher ID already exists in master teacher records.");
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
          userInsertValues.push(phoneDigits);
        }
        if (userColumns.has("phone_number")) {
          userInsertColumns.push("phone_number");
          userInsertValues.push(phoneDigits);
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
        const userPlaceholders = userInsertColumns.map(() => "?").join(", ");

        const [userResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO users (${userColumnsSql}) VALUES (${userPlaceholders})`,
          userInsertValues,
        );

        const userId = userResult.insertId;
        if (!userId) {
          throw new HttpError(500, "Failed to create user record.");
        }

        if (masterTeacherTable) {
          const masterInsertColumns: string[] = [];
          const masterInsertValues: any[] = [];

          masterInsertColumns.push("user_id");
          masterInsertValues.push(userId);

          if (masterTeacherColumns.has("master_teacher_id")) {
            masterInsertColumns.push("master_teacher_id");
            masterInsertValues.push(String(userId));
          }
          if (masterTeacherColumns.has("masterteacher_id")) {
            masterInsertColumns.push("masterteacher_id");
            masterInsertValues.push(String(userId));
          }
          if (teacherIdentifier) {
            for (const column of ["teacher_id", "employee_id"]) {
              if (masterTeacherColumns.has(column)) {
                masterInsertColumns.push(column);
                masterInsertValues.push(teacherIdentifier);
              }
            }
          }
          if (masterTeacherColumns.has("first_name")) {
            masterInsertColumns.push("first_name");
            masterInsertValues.push(firstName);
          }
          if (masterTeacherColumns.has("middle_name")) {
            masterInsertColumns.push("middle_name");
            masterInsertValues.push(middleName);
          }
          if (masterTeacherColumns.has("last_name")) {
            masterInsertColumns.push("last_name");
            masterInsertValues.push(lastName);
          }
          if (masterTeacherColumns.has("name")) {
            masterInsertColumns.push("name");
            masterInsertValues.push(fullName);
          }
          if (masterTeacherColumns.has("email")) {
            masterInsertColumns.push("email");
            masterInsertValues.push(email);
          }
          for (const column of ["contact_number", "phone_number", "mobile", "contact"]) {
            if (masterTeacherColumns.has(column)) {
              masterInsertColumns.push(column);
              masterInsertValues.push(phoneDigits);
            }
          }
          if (masterTeacherColumns.has("grade")) {
            masterInsertColumns.push("grade");
            masterInsertValues.push(grade);
          }
          if (masterTeacherColumns.has("handled_grade")) {
            masterInsertColumns.push("handled_grade");
            masterInsertValues.push(grade);
          }
          if (masterTeacherColumns.has("grade_level")) {
            masterInsertColumns.push("grade_level");
            masterInsertValues.push(grade);
          }
          if (masterTeacherColumns.has("year_level")) {
            masterInsertColumns.push("year_level");
            masterInsertValues.push(grade);
          }
          if (section) {
            for (const column of ["section", "section_name", "class_section"]) {
              if (masterTeacherColumns.has(column)) {
                masterInsertColumns.push(column);
                masterInsertValues.push(section);
              }
            }
          }
          if (subjects) {
            for (const column of ["subjects", "handled_subjects", "subject"]) {
              if (masterTeacherColumns.has(column)) {
                masterInsertColumns.push(column);
                masterInsertValues.push(subjects);
              }
            }
          }
          if (masterTeacherColumns.has("status")) {
            masterInsertColumns.push("status");
            masterInsertValues.push("Active");
          }
          if (masterTeacherColumns.has("user_status")) {
            masterInsertColumns.push("user_status");
            masterInsertValues.push("Active");
          }
          if (masterTeacherColumns.has("account_status")) {
            masterInsertColumns.push("account_status");
            masterInsertValues.push("Active");
          }
          if (masterTeacherColumns.has("role")) {
            masterInsertColumns.push("role");
            masterInsertValues.push("master_teacher");
          }
          if (masterTeacherColumns.has("created_at")) {
            masterInsertColumns.push("created_at");
            masterInsertValues.push(now);
          }
          if (masterTeacherColumns.has("updated_at")) {
            masterInsertColumns.push("updated_at");
            masterInsertValues.push(now);
          }

          if (masterInsertColumns.length > 1) {
            const masterColumnsSql = masterInsertColumns.map((column) => `\`${column}\``).join(", ");
            const masterPlaceholders = masterInsertColumns.map(() => "?").join(", ");

            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${masterTeacherTable}\` (${masterColumnsSql}) VALUES (${masterPlaceholders})`,
              masterInsertValues,
            );
          }
        }

        await connection.commit();

        const record = {
          userId,
          masterTeacherId: teacherIdentifier ?? String(userId),
          teacherId: teacherIdentifier ?? String(userId),
          firstName,
          middleName,
          lastName,
          name: fullName,
          email,
          contactNumber: phoneFormatted,
          contactNumberRaw: localDigits,
          contactNumberLocal: localDisplay,
          contactNumberInternational: phoneDigits,
          grade,
          section,
          subjects,
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
    console.error("Failed to add Master Teacher", error);
    return NextResponse.json({ error: "Failed to add Master Teacher." }, { status: 500 });
  }
}
