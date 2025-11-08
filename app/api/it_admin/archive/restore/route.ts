import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ArchiveRow extends RowDataPacket {
  archive_id: number;
  user_id: number | null;
  role: string | null;
  name: string | null;
  email?: string | null;
  user_email?: string | null;
  username?: string | null;
  contact_number?: string | null;
  phone_number?: string | null;
  timestamp?: Date | null;
}

interface RestoredEntry {
  archiveId: number;
  userId: number;
  role: string;
  name: string;
  email: string;
  temporaryPassword?: string;
}

interface OperationError {
  archiveId: number;
  message: string;
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const numeric = Number(item);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    })
    .filter((item): item is number => item !== null);
}

async function fetchTableColumns(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRole(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "user";
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "it_admin" || lowered === "it-admin" || lowered === "it admin") {
    return "admin";
  }
  return lowered.replace(/[\s/-]+/g, "_");
}

function splitNameParts(name: string | null): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
} {
  if (!name) {
    return { firstName: null, middleName: null, lastName: null };
  }
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null, lastName: null };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: null, lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

async function restoreArchiveEntry(
  connection: PoolConnection,
  archiveId: number,
  userColumns: Set<string>,
): Promise<{ restored?: RestoredEntry; error?: OperationError }> {
  await connection.beginTransaction();
  try {
    const [rows] = await connection.query<ArchiveRow[]>(
      "SELECT * FROM archive_users WHERE archive_id = ? FOR UPDATE",
      [archiveId],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return {
        error: {
          archiveId,
          message: "Archive entry not found.",
        },
      };
    }

    const archiveRow = rows[0];
    const resolvedArchiveId = Number(archiveRow.archive_id ?? archiveId);
    const rawUserId = typeof archiveRow.user_id === "number" ? archiveRow.user_id : null;
    const role = normalizeRole(archiveRow.role);
    const baseName = normalizeWhitespace(archiveRow.name) ?? normalizeWhitespace(archiveRow.username);
    const name = baseName ?? `Restored User ${rawUserId ?? resolvedArchiveId}`;
    const nameParts = splitNameParts(name);
    const contact = normalizeWhitespace(archiveRow.contact_number) ?? normalizeWhitespace(archiveRow.phone_number);

    const email =
      normalizeWhitespace(archiveRow.email) ??
      normalizeWhitespace(archiveRow.user_email) ??
      (rawUserId ? `restored_user_${rawUserId}@restored.local` : `restored_${resolvedArchiveId}@restored.local`);

    const username = normalizeWhitespace(archiveRow.username) ?? email;

    const [duplicate] = await connection.query<RowDataPacket[]>(
      "SELECT user_id FROM users WHERE user_id = ? OR email = ? LIMIT 1",
      [rawUserId ?? 0, email],
    );

    if (duplicate.length > 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "A user with the same identifier or email already exists.",
        },
      };
    }

    const temporaryPassword = generateTemporaryPassword();
    const insertColumns: string[] = [];
    const insertValues: any[] = [];
    const now = new Date();

    if (userColumns.has("user_id") && rawUserId) {
      insertColumns.push("user_id");
      insertValues.push(rawUserId);
    }

    if (userColumns.has("first_name") && nameParts.firstName) {
      insertColumns.push("first_name");
      insertValues.push(nameParts.firstName);
    }
    if (userColumns.has("middle_name") && nameParts.middleName) {
      insertColumns.push("middle_name");
      insertValues.push(nameParts.middleName);
    }
    if (userColumns.has("last_name") && nameParts.lastName) {
      insertColumns.push("last_name");
      insertValues.push(nameParts.lastName);
    }

    if (userColumns.has("name")) {
      insertColumns.push("name");
      insertValues.push(name);
    }
    if (userColumns.has("email")) {
      insertColumns.push("email");
      insertValues.push(email);
    }
    if (userColumns.has("username") && username) {
      insertColumns.push("username");
      insertValues.push(username);
    }
    if (userColumns.has("role")) {
      insertColumns.push("role");
      insertValues.push(role);
    }
    if (userColumns.has("contact_number") && contact) {
      insertColumns.push("contact_number");
      insertValues.push(contact);
    }
    if (userColumns.has("phone_number") && contact) {
      insertColumns.push("phone_number");
      insertValues.push(contact);
    }
    if (userColumns.has("status")) {
      insertColumns.push("status");
      insertValues.push("Active");
    }
    if (userColumns.has("password")) {
      insertColumns.push("password");
      insertValues.push(temporaryPassword);
    }
    if (userColumns.has("created_at")) {
      insertColumns.push("created_at");
      insertValues.push(now);
    }
    if (userColumns.has("updated_at")) {
      insertColumns.push("updated_at");
      insertValues.push(now);
    }

    if (insertColumns.length === 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "Unable to determine insert columns for users table.",
        },
      };
    }

    const columnSql = insertColumns.map((column) => `\`${column}\``).join(", ");
    const placeholders = insertColumns.map(() => "?").join(", ");

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO users (${columnSql}) VALUES (${placeholders})`,
      insertValues,
    );

    const restoredUserId = rawUserId && userColumns.has("user_id")
      ? rawUserId
      : Number(result.insertId);

    if (!Number.isInteger(restoredUserId) || restoredUserId <= 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "Failed to determine restored user identifier.",
        },
      };
    }

    await connection.query<ResultSetHeader>(
      "DELETE FROM archive_users WHERE archive_id = ?",
      [resolvedArchiveId],
    );

    await connection.commit();

    return {
      restored: {
        archiveId: resolvedArchiveId,
        userId: restoredUserId,
        role,
        name,
        email,
        temporaryPassword,
      },
    };
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Failed to restore archived user.";
    return {
      error: {
        archiveId,
        message,
      },
    };
  }
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const archiveIds = parseIdArray(payload?.archiveIds);

  if (archiveIds.length === 0) {
    return NextResponse.json({ error: "At least one archiveId is required." }, { status: 400 });
  }

  try {
    const result = await runWithConnection(async (connection) => {
      let userColumns: Set<string>;
      try {
        userColumns = await fetchTableColumns(connection, "users");
      } catch {
        throw new Error("Users table is not accessible.");
      }

      if (userColumns.size === 0) {
        throw new Error("Users table is not accessible.");
      }

      const restored: RestoredEntry[] = [];
      const errors: OperationError[] = [];

      for (const archiveId of archiveIds) {
        const outcome = await restoreArchiveEntry(connection, archiveId, userColumns);
        if (outcome.restored) {
          restored.push(outcome.restored);
        } else if (outcome.error) {
          errors.push(outcome.error);
        }
      }

      return { restored, errors };
    });

    return NextResponse.json({
      success: result.restored.length > 0,
      restored: result.restored,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Failed to restore archived users", error);
    const message = error instanceof Error ? error.message : "Failed to restore archived users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
