import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { HttpError } from "../validation/validation"; // Fixed import

export const dynamic = "force-dynamic";

// Remove the duplicate HttpError class since we're importing it

const PRINCIPAL_TABLE_CANDIDATES = ["principal", "principals", "principal_info"] as const;

interface ArchiveResult {
  userId: number;
  name: string | null;
  email: string | null;
}

async function fetchTableColumns(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

async function tryFetchTableColumns(connection: PoolConnection, tableName: string): Promise<Set<string> | null> {
  try {
    return await fetchTableColumns(connection, tableName);
  } catch {
    return null;
  }
}

async function resolvePrincipalTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of PRINCIPAL_TABLE_CANDIDATES) {
    const columns = await tryFetchTableColumns(connection, candidate);
    if (columns && columns.size > 0) {
      return { table: candidate, columns };
    }
  }

  return { table: null, columns: new Set<string>() };
}

function computeFullName(userRow: RowDataPacket): string | null {
  const nameValue = typeof userRow.name === "string" && userRow.name.trim().length > 0 ? userRow.name.trim() : null;
  if (nameValue) {
    return nameValue;
  }

  const parts: string[] = [];
  const candidateKeys = ["first_name", "middle_name", "last_name"];
  for (const key of candidateKeys) {
    const value = userRow[key];
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(value.trim());
    }
  }

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const username = userRow.username;
  if (typeof username === "string" && username.trim().length > 0) {
    return username.trim();
  }

  const email = userRow.email;
  if (typeof email === "string" && email.trim().length > 0) {
    return email.trim();
  }

  const userId = userRow.user_id;
  return typeof userId === "number" ? `User ${userId}` : null;
}

function normalizeContact(userRow: RowDataPacket): string | null {
  const contactKeys = ["contact_number", "phone_number", "mobile", "contact"];
  for (const key of contactKeys) {
    const value = userRow[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const rawUserIds: unknown = payload?.userIds;
  const reason: string | null = typeof payload?.reason === "string" ? payload.reason.trim() : null;

  const userIds = Array.isArray(rawUserIds)
    ? rawUserIds
        .map((value) => {
          const numeric = Number(value);
          return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
        })
        .filter((value): value is number => value !== null)
    : [];

  if (userIds.length === 0) {
    return NextResponse.json({ error: "At least one valid userId is required." }, { status: 400 });
  }

  try {
    const result = await runWithConnection(async (connection) => {
      const archiveColumns = await tryFetchTableColumns(connection, "archive_users");
      if (!archiveColumns || archiveColumns.size === 0) {
        throw new HttpError(500, "Archive table is not available.");
      }

      const { table: principalTable, columns: principalColumns } = await resolvePrincipalTable(connection);
      const accountLogsColumns = await tryFetchTableColumns(connection, "account_logs");
      const canDeleteAccountLogs = !!accountLogsColumns && accountLogsColumns.has("user_id");

      await connection.beginTransaction();
      try {
        const archived: ArchiveResult[] = [];
        const archiveReason = reason && reason.length > 0 ? reason : "Archived by IT Administrator";

        for (const userId of userIds) {
          const [userRows] = await connection.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE user_id = ? LIMIT 1",
            [userId]
          );

          if (userRows.length === 0) {
            continue;
          }

          const userRow = userRows[0];
          const name = computeFullName(userRow);
          const email = typeof userRow.email === "string" ? userRow.email : null;
          const contactNumber = normalizeContact(userRow);
          const role = typeof userRow.role === "string" && userRow.role.trim().length > 0 ? userRow.role : "principal";

          const [existingArchive] = await connection.query<RowDataPacket[]>(
            "SELECT archive_id FROM archive_users WHERE user_id = ? LIMIT 1",
            [userId]
          );

          if (existingArchive.length === 0) {
            const columns: string[] = [];
            const values: any[] = [];

            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            pushValue("user_id", userId);
            if (archiveColumns.has("role")) {
              pushValue("role", role);
            }
            if (archiveColumns.has("name") && name) {
              pushValue("name", name);
            }
            if (archiveColumns.has("email") && email) {
              pushValue("email", email);
            }
            if (archiveColumns.has("contact_number") && contactNumber) {
              pushValue("contact_number", contactNumber);
            }
            if (archiveColumns.has("reason")) {
              pushValue("reason", archiveReason);
            }
            if (archiveColumns.has("timestamp")) {
              pushValue("timestamp", new Date());
            }

            const placeholders = columns.map(() => "?").join(", ");
            const columnsSql = columns.join(", ");

            await connection.query<ResultSetHeader>(
              `INSERT INTO archive_users (${columnsSql}) VALUES (${placeholders})`,
              values
            );
          }

          if (principalTable) {
            if (principalColumns.has("user_id")) {
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${principalTable}\` WHERE user_id = ?`,
                [userId]
              );
            } else if (principalColumns.has("principal_id")) {
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${principalTable}\` WHERE principal_id = ?`,
                [userId]
              );
            }
          }

          if (canDeleteAccountLogs) {
            await connection.query<ResultSetHeader>(
              "DELETE FROM `account_logs` WHERE user_id = ?",
              [userId]
            );
          }

          await connection.query<ResultSetHeader>("DELETE FROM users WHERE user_id = ?", [userId]);

          archived.push({
            userId,
            name,
            email,
          });
        }

        await connection.commit();
        return { archived };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    return NextResponse.json({ success: true, archived: result.archived });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to archive principals", error);
    return NextResponse.json({ error: "Failed to archive principals." }, { status: 500 });
  }
}