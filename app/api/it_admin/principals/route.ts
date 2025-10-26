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

function sanitizePhoneNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Phone number is required.");
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new HttpError(400, "Phone number must contain 10 to 11 digits.");
  }
  return digits;
}

function buildFullName(firstName: string, middleName: string | null, lastName: string): string {
  const parts = [firstName, middleName, lastName].filter((part) => part && part.trim().length > 0);
  return parts.join(" ");
}

async function getColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

async function resolvePrincipalTable(connection: PoolConnection) {
  const candidates = ["principal", "principals", "principal_info"];
  for (const table of candidates) {
    try {
      const columns = await getColumnsForTable(connection, table);
      return { table, columns } as const;
    } catch {
      // ignore and try next candidate
    }
  }
  return { table: null as string | null, columns: new Set<string>() } as const;
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
    const phoneNumber = sanitizePhoneNumber(payload?.phoneNumber ?? "");
    const fullName = buildFullName(firstName, middleName, lastName);
    const temporaryPassword = generateTemporaryPassword();

    const result = await runWithConnection(async (connection) => {
      const userColumns = await getColumnsForTable(connection, "users");
      let principalInfo: { table: string | null; columns: Set<string> } = { table: null, columns: new Set() };
      try {
        principalInfo = await resolvePrincipalTable(connection);
      } catch {
        principalInfo = { table: null, columns: new Set() };
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

        if (principalInfo.table && principalInfo.columns.size > 0) {
          const principalInsertColumns: string[] = [];
          const principalValues: any[] = [];

          principalInsertColumns.push("user_id");
          principalValues.push(userId);

          if (principalInfo.columns.has("principal_id")) {
            principalInsertColumns.push("principal_id");
            principalValues.push(String(userId));
          }
          if (principalInfo.columns.has("first_name")) {
            principalInsertColumns.push("first_name");
            principalValues.push(firstName);
          }
          if (principalInfo.columns.has("middle_name")) {
            principalInsertColumns.push("middle_name");
            principalValues.push(middleName);
          }
          if (principalInfo.columns.has("last_name")) {
            principalInsertColumns.push("last_name");
            principalValues.push(lastName);
          }
          if (principalInfo.columns.has("name")) {
            principalInsertColumns.push("name");
            principalValues.push(fullName);
          }
          if (principalInfo.columns.has("email")) {
            principalInsertColumns.push("email");
            principalValues.push(email);
          }
          if (principalInfo.columns.has("contact_number")) {
            principalInsertColumns.push("contact_number");
            principalValues.push(phoneNumber);
          }
          if (principalInfo.columns.has("phone_number")) {
            principalInsertColumns.push("phone_number");
            principalValues.push(phoneNumber);
          }
          if (principalInfo.columns.has("status")) {
            principalInsertColumns.push("status");
            principalValues.push("Active");
          }
          if (principalInfo.columns.has("role")) {
            principalInsertColumns.push("role");
            principalValues.push("principal");
          }
          if (principalInfo.columns.has("created_at")) {
            principalInsertColumns.push("created_at");
            principalValues.push(now);
          }
          if (principalInfo.columns.has("updated_at")) {
            principalInsertColumns.push("updated_at");
            principalValues.push(now);
          }

          if (principalInsertColumns.length > 1) {
            const principalColumnsSql = principalInsertColumns.map((column) => `\`${column}\``).join(", ");
            const principalPlaceholders = principalInsertColumns.map(() => "?").join(", ");

            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${principalInfo.table}\` (${principalColumnsSql}) VALUES (${principalPlaceholders})`,
              principalValues,
            );
          }
        }

        await connection.commit();

        const record = {
          userId,
          principalId: String(userId),
          firstName,
          middleName,
          lastName,
          name: fullName,
          email,
          contactNumber: phoneNumber,
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
    console.error("Failed to add Principal", error);
    return NextResponse.json({ error: "Failed to add Principal." }, { status: 500 });
  }
}
