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

const PRINCIPAL_ID_PATTERN = /^PR-\d{2}\d{4,}$/;

export function formatPrincipalIdentifier(
  raw: string | null | undefined,
  fallbackSequence?: number | null,
  yearOverride?: number | null,
): string {
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (normalized && PRINCIPAL_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  const sequenceValue = typeof fallbackSequence === "number" && Number.isFinite(fallbackSequence)
    ? Math.max(1, Math.trunc(fallbackSequence))
    : 1;

  return `PR-${year}${String(sequenceValue).padStart(4, "0")}`;
}

async function generatePrincipalId(
  connection: PoolConnection,
  sources: Array<{ table: string; column: string }>,
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);

  let maxSequence = 0;

  for (const source of sources) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${source.column}\` AS principal_id FROM \`${source.table}\` WHERE \`${source.column}\` LIKE ? ORDER BY \`${source.column}\` DESC LIMIT 1`,
      [`PR-${year}%`],
    );

    if (rows.length === 0) {
      continue;
    }

    const lastId = rows[0]?.principal_id;
    const match = typeof lastId === "string" ? lastId.match(/PR-\d{2}(\d{4,})$/) : null;
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxSequence = Math.max(maxSequence, parsed);
      }
    }
  }

  const nextNum = maxSequence + 1;
  return `PR-${year}${String(nextNum).padStart(4, "0")}`;
}

export interface CreatePrincipalInput {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  suffix: string | null;
}

export interface CreatePrincipalResult {
  userId: number;
  record: {
    userId: number;
    principalId: string;
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

export async function createPrincipal(input: CreatePrincipalInput): Promise<CreatePrincipalResult> {
  const { firstName, middleName, lastName, suffix, email, phoneNumber } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();

  const result = await runWithConnection(async (connection) => {
    const userColumns = await getColumnsForTable(connection, "users");
    let principalColumns: Set<string> | null = null;
    let principalTable: string | null = null;
    const principalCandidates = ["principal", "principals", "principal_info"];
    for (const table of principalCandidates) {
      try {
        const columns = await getColumnsForTable(connection, table);
        if (columns.size > 0) {
          principalColumns = columns;
          principalTable = table;
          break;
        }
      } catch {
        // continue to next candidate
      }
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
      const principalIdSources: Array<{ table: string; column: string }> = [];

      if (userColumns.has("principal_id")) {
        principalIdSources.push({ table: "users", column: "principal_id" });
      }
      if (principalTable && principalColumns?.has("principal_id")) {
        principalIdSources.push({ table: principalTable, column: "principal_id" });
      }

      let generatedPrincipalId: string | null = null;
      if (principalIdSources.length > 0) {
        generatedPrincipalId = await generatePrincipalId(connection, principalIdSources);
      }

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
        userInsertValues.push("principal");
      }
      if (userColumns.has("status")) {
        userInsertColumns.push("status");
        userInsertValues.push("Active");
      }
      if (userColumns.has("password")) {
        userInsertColumns.push("password");
        userInsertValues.push(temporaryPassword);
      }
      if (generatedPrincipalId && userColumns.has("principal_id")) {
        userInsertColumns.push("principal_id");
        userInsertValues.push(generatedPrincipalId);
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

      if (principalTable && principalColumns && principalColumns.size > 0) {
        const principalInsertColumns: string[] = [];
        const principalValues: any[] = [];

        principalInsertColumns.push("user_id");
        principalValues.push(userId);

        if (principalColumns.has("principal_id") && generatedPrincipalId) {
          principalInsertColumns.push("principal_id");
          principalValues.push(generatedPrincipalId);
        }
        if (principalColumns.has("first_name")) {
          principalInsertColumns.push("first_name");
          principalValues.push(firstName);
        }
        if (principalColumns.has("middle_name")) {
          principalInsertColumns.push("middle_name");
          principalValues.push(middleName);
        }
        if (principalColumns.has("last_name")) {
          principalInsertColumns.push("last_name");
          principalValues.push(lastName);
        }
        if (principalColumns.has("suffix")) {
          principalInsertColumns.push("suffix");
          principalValues.push(suffix);
        }
        if (principalColumns.has("name")) {
          principalInsertColumns.push("name");
          principalValues.push(fullName);
        }
        if (principalColumns.has("email")) {
          principalInsertColumns.push("email");
          principalValues.push(email);
        }
        if (principalColumns.has("contact_number")) {
          principalInsertColumns.push("contact_number");
          principalValues.push(phoneNumber);
        }
        if (principalColumns.has("phone_number")) {
          principalInsertColumns.push("phone_number");
          principalValues.push(phoneNumber);
        }
        if (principalColumns.has("status")) {
          principalInsertColumns.push("status");
          principalValues.push("Active");
        }
        if (principalColumns.has("role")) {
          principalInsertColumns.push("role");
          principalValues.push("principal");
        }
        if (principalColumns.has("created_at")) {
          principalInsertColumns.push("created_at");
          principalValues.push(now);
        }
        if (principalColumns.has("updated_at")) {
          principalInsertColumns.push("updated_at");
          principalValues.push(now);
        }

        if (principalInsertColumns.length > 1) {
          const principalColumnsSql = principalInsertColumns.map((column) => `\`${column}\``).join(", ");
          const principalPlaceholders = principalInsertColumns.map(() => "?").join(", ");

          await connection.query<ResultSetHeader>(
            `INSERT INTO \`${principalTable}\` (${principalColumnsSql}) VALUES (${principalPlaceholders})`,
            principalValues,
          );
        }
      }

      await connection.commit();

      const record = {
        userId,
        principalId: formatPrincipalIdentifier(generatedPrincipalId, userId),
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