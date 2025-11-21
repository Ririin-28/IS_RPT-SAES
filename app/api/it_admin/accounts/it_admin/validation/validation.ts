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

const ADMIN_ID_PATTERN = /^IA-\d{2}\d{4,}$/;

export function formatAdminIdentifier(
  raw: string | null | undefined,
  fallbackSequence?: number | null,
  yearOverride?: number | null,
): string {
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (normalized && ADMIN_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  const sequenceValue = typeof fallbackSequence === "number" && Number.isFinite(fallbackSequence)
    ? Math.max(1, Math.trunc(fallbackSequence))
    : 1;

  return `IA-${year}${String(sequenceValue).padStart(4, "0")}`;
}

export interface CreateItAdminInput {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  suffix: string | null;
}

export interface CreateItAdminResult {
  userId: number;
  record: {
    userId: number;
    adminId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    name: string;
    email: string;
    contactNumber: string;
    status: string;
    lastLogin: null;
    suffix: string | null;
  };
  temporaryPassword: string;
}

async function generateAdminId(
  connection: PoolConnection,
  sources: Array<{ table: string; column: string }>,
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);

  let maxSequence = 0;

  for (const source of sources) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${source.column}\` AS admin_id FROM \`${source.table}\` WHERE \`${source.column}\` LIKE ? ORDER BY \`${source.column}\` DESC LIMIT 1`,
      [`IA-${year}%`],
    );

    if (rows.length === 0) {
      continue;
    }

    const lastId = rows[0]?.admin_id;
    const match = typeof lastId === "string" ? lastId.match(/IA-\d{2}(\d{4,})$/) : null;
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxSequence = Math.max(maxSequence, parsed);
      }
    }
  }

  const nextNum = maxSequence + 1;
  return `IA-${year}${String(nextNum).padStart(4, "0")}`;
}

export async function createItAdmin(input: CreateItAdminInput): Promise<CreateItAdminResult> {
  const { firstName, middleName, lastName, suffix, email, phoneNumber } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();

  const result = await runWithConnection(async (connection) => {
    const userColumns = await getColumnsForTable(connection, "users");
    let itAdminColumns: Set<string> | null = null;
    try {
      itAdminColumns = await getColumnsForTable(connection, "it_admin");
    } catch {
      itAdminColumns = null;
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

      let adminId: string | null = null;
      const adminIdSources: Array<{ table: string; column: string }> = [];

      if (userColumns.has("admin_id")) {
        adminIdSources.push({ table: "users", column: "admin_id" });
      }
      if (itAdminColumns?.has("admin_id")) {
        adminIdSources.push({ table: "it_admin", column: "admin_id" });
      }

      if (adminIdSources.length > 0) {
        adminId = await generateAdminId(connection, adminIdSources);
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
        userInsertValues.push("admin");
      }
      if (userColumns.has("status")) {
        userInsertColumns.push("status");
        userInsertValues.push("Active");
      }
      if (userColumns.has("password")) {
        userInsertColumns.push("password");
        userInsertValues.push(temporaryPassword);
      }
      if (adminId && userColumns.has("admin_id")) {
        userInsertColumns.push("admin_id");
        userInsertValues.push(adminId);
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

      if (itAdminColumns && itAdminColumns.size > 0) {
        const itAdminInsertColumns: string[] = [];
        const itAdminValues: any[] = [];

        itAdminInsertColumns.push("user_id");
        itAdminValues.push(userId);

        if (adminId && itAdminColumns.has("admin_id")) {
          itAdminInsertColumns.push("admin_id");
          itAdminValues.push(adminId);
        }
        if (itAdminColumns.has("first_name")) {
          itAdminInsertColumns.push("first_name");
          itAdminValues.push(firstName);
        }
        if (itAdminColumns.has("middle_name")) {
          itAdminInsertColumns.push("middle_name");
          itAdminValues.push(middleName);
        }
        if (itAdminColumns.has("last_name")) {
          itAdminInsertColumns.push("last_name");
          itAdminValues.push(lastName);
        }
        if (itAdminColumns.has("suffix")) {
          itAdminInsertColumns.push("suffix");
          itAdminValues.push(suffix);
        }
        if (itAdminColumns.has("name")) {
          itAdminInsertColumns.push("name");
          itAdminValues.push(fullName);
        }
        if (itAdminColumns.has("email")) {
          itAdminInsertColumns.push("email");
          itAdminValues.push(email);
        }
        if (itAdminColumns.has("contact_number")) {
          itAdminInsertColumns.push("contact_number");
          itAdminValues.push(phoneNumber);
        }
        if (itAdminColumns.has("phone_number")) {
          itAdminInsertColumns.push("phone_number");
          itAdminValues.push(phoneNumber);
        }
        if (itAdminColumns.has("status")) {
          itAdminInsertColumns.push("status");
          itAdminValues.push("Active");
        }
        if (itAdminColumns.has("role")) {
          itAdminInsertColumns.push("role");
          itAdminValues.push("admin");
        }
        if (itAdminColumns.has("created_at")) {
          itAdminInsertColumns.push("created_at");
          itAdminValues.push(now);
        }
        if (itAdminColumns.has("updated_at")) {
          itAdminInsertColumns.push("updated_at");
          itAdminValues.push(now);
        }

        if (itAdminInsertColumns.length > 1) {
          const itAdminColumnsSql = itAdminInsertColumns.map((column) => `\`${column}\``).join(", ");
          const itAdminPlaceholders = itAdminInsertColumns.map(() => "?").join(", ");

          await connection.query<ResultSetHeader>(
            `INSERT INTO it_admin (${itAdminColumnsSql}) VALUES (${itAdminPlaceholders})`,
            itAdminValues,
          );
        }
      }

      await connection.commit();

      const record = {
        userId,
        adminId: formatAdminIdentifier(adminId, userId),
        firstName,
        middleName,
        lastName,
        name: fullName,
        email,
        contactNumber: phoneNumber,
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
