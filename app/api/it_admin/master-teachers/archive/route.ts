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

const MASTER_TEACHER_PRIMARY_TABLES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
  "mt_coordinator",
];

const MASTER_TEACHER_RELATED_TABLES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
  "master_teacher_assignment",
];

const MASTER_TEACHER_TABLE_CANDIDATES = Array.from(
  new Set<string>([...MASTER_TEACHER_PRIMARY_TABLES, ...MASTER_TEACHER_RELATED_TABLES]),
);

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

interface TableInfo {
  table: string;
  columns: Set<string>;
}

async function resolveMasterTeacherTables(connection: PoolConnection): Promise<TableInfo[]> {
  const resolved: TableInfo[] = [];

  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
    const columns = await tryFetchTableColumns(connection, candidate);
    if (columns && columns.size > 0) {
      resolved.push({ table: candidate, columns });
    }
  }

  return resolved;
}

interface ReferencingEntry {
  column: string;
  referencedColumn: string;
}

async function fetchReferencingMap(connection: PoolConnection, targetTable: string): Promise<Map<string, ReferencingEntry[]>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?",
    [targetTable],
  );

  const tableMap = new Map<string, ReferencingEntry[]>();
  for (const row of rows) {
    const tableNameRaw = (row.TABLE_NAME ?? row.table_name) as string | null | undefined;
    const columnNameRaw = (row.COLUMN_NAME ?? row.column_name) as string | null | undefined;
    const referencedColumnRaw = (row.REFERENCED_COLUMN_NAME ?? row.referenced_column_name) as string | null | undefined;

    const tableName = tableNameRaw ? String(tableNameRaw).trim() : "";
    const columnName = columnNameRaw ? String(columnNameRaw).trim() : "";
    const referencedColumn = referencedColumnRaw ? String(referencedColumnRaw).trim() : "";

    if (!tableName || !columnName || !referencedColumn) {
      continue;
    }

    const entries = tableMap.get(tableName) ?? [];
    entries.push({ column: columnName, referencedColumn });
    tableMap.set(tableName, entries);
  }

  return tableMap;
}

function computeFullName(userRow: RowDataPacket): string | null {
  const nameValue = typeof userRow.name === "string" && userRow.name.trim().length > 0 ? userRow.name.trim() : null;
  if (nameValue) {
    return nameValue;
  }

  const parts: string[] = [];
  for (const key of ["first_name", "middle_name", "last_name"]) {
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
  for (const key of ["contact_number", "phone_number", "mobile", "contact"]) {
    const value = userRow[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function getColumnValue(row: RowDataPacket | null, column: string): any {
  if (!row) {
    return undefined;
  }

  if (column in row) {
    return row[column as keyof typeof row];
  }

  const normalized = column.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === normalized) {
      return row[key as keyof typeof row];
    }
  }

  return undefined;
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

      const masterTeacherTables = await resolveMasterTeacherTables(connection);
      const accountLogsColumns = await tryFetchTableColumns(connection, "account_logs");
      const canDeleteAccountLogs = !!accountLogsColumns && accountLogsColumns.has("user_id");
      const userReferencingMap = await fetchReferencingMap(connection, "users");
      const masterTeacherReferencingMaps = new Map<string, Map<string, ReferencingEntry[]>>();
      for (const { table } of masterTeacherTables) {
        masterTeacherReferencingMaps.set(table, await fetchReferencingMap(connection, table));
      }

      await connection.beginTransaction();
      try {
        const archived: ArchiveResult[] = [];
        const archiveReason = reason && reason.length > 0 ? reason : "Archived by IT Administrator";

        for (const userId of userIds) {
          const [userRows] = await connection.query<RowDataPacket[]>(
            "SELECT * FROM users WHERE user_id = ? LIMIT 1",
            [userId],
          );

          if (userRows.length === 0) {
            continue;
          }

          const userRow = userRows[0];
          const name = computeFullName(userRow);
          const email = typeof userRow.email === "string" ? userRow.email : null;
          const contactNumber = normalizeContact(userRow);
          const role = typeof userRow.role === "string" && userRow.role.trim().length > 0 ? userRow.role : "master_teacher";

          const masterTeacherRows = new Map<string, RowDataPacket>();
          for (const { table, columns } of masterTeacherTables) {
            const lookupColumns = ["user_id", "master_teacher_id", "masterteacher_id", "teacher_id"].filter((column) =>
              columns.has(column),
            );

            let fetchedRow: RowDataPacket | null = null;
            for (const column of lookupColumns) {
              const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT * FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`,
                [userId],
              );
              if (rows.length > 0) {
                fetchedRow = rows[0];
                break;
              }
            }

            if (fetchedRow) {
              masterTeacherRows.set(table, fetchedRow);
            }
          }

          const [existingArchive] = await connection.query<RowDataPacket[]>(
            "SELECT archive_id FROM archive_users WHERE user_id = ? LIMIT 1",
            [userId],
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
              values,
            );
          }

          for (const { table, columns } of masterTeacherTables) {
            const masterTeacherRow = masterTeacherRows.get(table);
            if (!masterTeacherRow) {
              continue;
            }

            const referencingMap = masterTeacherReferencingMaps.get(table);
            if (referencingMap) {
              for (const [tableName, entries] of referencingMap) {
                if (!entries.length) {
                  continue;
                }

                const normalizedReferencedTable = tableName.toLowerCase();
                if (normalizedReferencedTable === table.toLowerCase()) {
                  continue;
                }
                if (normalizedReferencedTable === "archive_users" || normalizedReferencedTable === "account_logs") {
                  continue;
                }

                for (const { column, referencedColumn } of entries) {
                  if (!column || !referencedColumn) {
                    continue;
                  }
                  const value = getColumnValue(masterTeacherRow, referencedColumn);
                  if (value === null || value === undefined) {
                    continue;
                  }
                  await connection.query<ResultSetHeader>(
                    `DELETE FROM \`${tableName}\` WHERE \`${column}\` = ?`,
                    [value],
                  );
                }
              }
            }

            const deletionCandidates: Array<{ column: string; useUserId: boolean }> = [
              { column: "user_id", useUserId: true },
              { column: "master_teacher_id", useUserId: false },
              { column: "masterteacher_id", useUserId: false },
              { column: "teacher_id", useUserId: false },
              { column: "coord_id", useUserId: false },
              { column: "remedial_teacher_id", useUserId: false },
              { column: "remedial_id", useUserId: false },
            ];

            let deletedFromTable = false;
            for (const { column, useUserId } of deletionCandidates) {
              if (!columns.has(column)) {
                continue;
              }
              const deleteValue = useUserId ? userId : getColumnValue(masterTeacherRow, column);
              if (deleteValue === null || deleteValue === undefined) {
                continue;
              }
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${table}\` WHERE \`${column}\` = ?`,
                [deleteValue],
              );
              deletedFromTable = true;
              break;
            }

            if (!deletedFromTable && columns.has("id")) {
              const idValue = getColumnValue(masterTeacherRow, "id");
              if (idValue !== null && idValue !== undefined) {
                await connection.query<ResultSetHeader>(
                  `DELETE FROM \`${table}\` WHERE \`id\` = ?`,
                  [idValue],
                );
              }
            }
          }

          for (const [tableName, entries] of userReferencingMap) {
            const normalizedTableName = tableName.toLowerCase();
            if (normalizedTableName === "users") {
              continue;
            }
            if (normalizedTableName === "archive_users") {
              continue;
            }
            if (normalizedTableName === "account_logs") {
              continue;
            }
            const matchesMasterTeacherTables = masterTeacherTables.some(
              ({ table }) => table.toLowerCase() === normalizedTableName,
            );
            if (matchesMasterTeacherTables) {
              continue;
            }

            for (const { column } of entries) {
              if (!column) {
                continue;
              }
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${tableName}\` WHERE \`${column}\` = ?`,
                [userId],
              );
            }
          }

          if (canDeleteAccountLogs) {
            await connection.query<ResultSetHeader>("DELETE FROM `account_logs` WHERE user_id = ?", [userId]);
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

    console.error("Failed to archive master teachers", error);
    return NextResponse.json({ error: "Failed to archive master teachers." }, { status: 500 });
  }
}
