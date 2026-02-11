import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { HttpError } from "../validation/validation";

export const dynamic = "force-dynamic";

const ARCHIVE_TABLE = "archived_users";

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

interface ArchiveResult {
  userId: number;
  name: string | null;
  email: string | null;
}

interface ReferencingEntry {
  column: string;
  referencedColumn: string;
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

async function resolveTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
    const columns = await tryFetchTableColumns(connection, candidate);
    if (columns && columns.size > 0) {
      return { table: candidate, columns };
    }
  }
  return { table: null, columns: new Set<string>() };
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

const IN_CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      result.add(value.trim());
    }
  }
  return Array.from(result);
}

function buildPlaceholders(count: number): string {
  return new Array(count).fill("?").join(", ");
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
      const archiveColumns = await tryFetchTableColumns(connection, ARCHIVE_TABLE);
      if (!archiveColumns || archiveColumns.size === 0) {
        throw new HttpError(500, "Archive table is not available.");
      }

      const { table: teacherTable, columns: teacherColumns } = await resolveTeacherTable(connection);
      const teacherHandledColumns = await tryFetchTableColumns(connection, "teacher_handled");
      const archivedTeacherHandledColumns = await tryFetchTableColumns(connection, "archived_teacher_handled");
      const mtCoordinatorHandledColumns = await tryFetchTableColumns(connection, "mt_coordinator_handled");
      const accountLogsColumns = await tryFetchTableColumns(connection, "account_logs");
      const canDeleteAccountLogs = !!accountLogsColumns && accountLogsColumns.has("user_id");
      const userReferencingMap = await fetchReferencingMap(connection, "users");
      const teacherReferencingMap = teacherTable ? await fetchReferencingMap(connection, teacherTable) : new Map<string, ReferencingEntry[]>();

      const uniqueUserIds = uniqueNumbers(userIds);
      const userRows: RowDataPacket[] = [];
      for (const chunk of chunkArray(uniqueUserIds, IN_CHUNK_SIZE)) {
        const placeholders = buildPlaceholders(chunk.length);
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM users WHERE user_id IN (${placeholders})`,
          chunk,
        );
        userRows.push(...rows);
      }

      const userRowById = new Map<number, RowDataPacket>();
      for (const row of userRows) {
        const rawUserId = getColumnValue(row, "user_id");
        const parsedUserId = rawUserId !== null && rawUserId !== undefined ? Number(rawUserId) : NaN;
        if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
          userRowById.set(parsedUserId, row);
        }
      }

      const foundUserIds = Array.from(userRowById.keys());
      if (foundUserIds.length === 0) {
        return { archived: [] as ArchiveResult[] };
      }

      let teacherLookupColumn: string | null = null;
      if (teacherTable) {
        if (teacherColumns.has("user_id")) {
          teacherLookupColumn = "user_id";
        } else if (teacherColumns.has("teacher_id")) {
          teacherLookupColumn = "teacher_id";
        } else if (teacherColumns.has("employee_id")) {
          teacherLookupColumn = "employee_id";
        }
      }

      const teacherRowByLookup = new Map<number, RowDataPacket>();
      if (teacherTable && teacherLookupColumn) {
        for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
          const placeholders = buildPlaceholders(chunk.length);
          const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT * FROM \`${teacherTable}\` WHERE \`${teacherLookupColumn}\` IN (${placeholders})`,
            chunk,
          );
          for (const row of rows) {
            const keyValue = getColumnValue(row, teacherLookupColumn);
            const parsedKey = keyValue !== null && keyValue !== undefined ? Number(keyValue) : NaN;
            if (Number.isInteger(parsedKey) && parsedKey > 0) {
              teacherRowByLookup.set(parsedKey, row);
            }
          }
        }
      }

      const existingArchiveByUserId = new Map<number, number>();
      for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
        const placeholders = buildPlaceholders(chunk.length);
        const [archiveRows] = await connection.query<RowDataPacket[]>(
          `SELECT archived_id, user_id FROM ${ARCHIVE_TABLE} WHERE user_id IN (${placeholders})`,
          chunk,
        );
        for (const row of archiveRows) {
          const userId = Number(row.user_id);
          const archivedId = Number(row.archived_id);
          if (Number.isInteger(userId) && Number.isInteger(archivedId)) {
            existingArchiveByUserId.set(userId, archivedId);
          }
        }
      }

      await connection.beginTransaction();
      try {
        const archived: ArchiveResult[] = [];
        const archiveReason = reason && reason.length > 0 ? reason : "Archived by IT Administrator";

        const archivedIdByUserId = new Map<number, number>();
        const archivedIdByTeacherId = new Map<string, number>();
        const resolvedTeacherIdByUserId = new Map<number, string>();

        for (const userId of foundUserIds) {
          const userRow = userRowById.get(userId);
          if (!userRow) {
            continue;
          }

          const rawUserId = getColumnValue(userRow, "user_id");
          const parsedUserId = rawUserId !== null && rawUserId !== undefined ? Number(rawUserId) : NaN;
          const resolvedUserId = Number.isInteger(parsedUserId) && parsedUserId > 0
            ? parsedUserId
            : userId;
          const name = computeFullName(userRow);
          const email = typeof userRow.email === "string" ? userRow.email : null;
          const contactNumber = normalizeContact(userRow);
          const role = typeof userRow.role === "string" && userRow.role.trim().length > 0 ? userRow.role : "teacher";
          const userCode = typeof userRow.user_code === "string" ? userRow.user_code : null;
          const username = typeof userRow.username === "string" ? userRow.username : null;
          const firstName = typeof userRow.first_name === "string" ? userRow.first_name : null;
          const middleName = typeof userRow.middle_name === "string" ? userRow.middle_name : null;
          const lastName = typeof userRow.last_name === "string" ? userRow.last_name : null;
          const suffix = typeof userRow.suffix === "string" ? userRow.suffix : null;
          const password = typeof userRow.password === "string" ? userRow.password : null;
          const roleId = Number.isInteger(userRow.role_id) ? (userRow.role_id as number) : null;
          const createdAt = getColumnValue(userRow, "created_at");
          const updatedAt = getColumnValue(userRow, "updated_at");

          const teacherRow = teacherLookupColumn ? teacherRowByLookup.get(userId) ?? null : null;

          const resolvedTeacherId =
            getColumnValue(teacherRow, "teacher_id") ??
            getColumnValue(teacherRow, "employee_id") ??
            getColumnValue(teacherRow, "faculty_id") ??
            getColumnValue(teacherRow, "teacher_code") ??
            getColumnValue(teacherRow, "user_id") ??
            userId;
          if (resolvedTeacherId !== null && resolvedTeacherId !== undefined) {
            const resolvedTeacherText = String(resolvedTeacherId).trim();
            if (resolvedTeacherText.length > 0) {
              resolvedTeacherIdByUserId.set(userId, resolvedTeacherText);
            }
          }

          const existingArchiveId = existingArchiveByUserId.get(resolvedUserId);
          let archivedIdForRelations: number | null = null;

          if (!existingArchiveId) {
            const columns: string[] = [];
            const values: any[] = [];

            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            pushValue("user_id", resolvedUserId);
            if (archiveColumns.has("role")) {
              pushValue("role", role);
            }
            if (archiveColumns.has("role_id") && roleId !== null) {
              pushValue("role_id", roleId);
            }
            if (archiveColumns.has("user_code") && userCode) {
              pushValue("user_code", userCode);
            }
            if (archiveColumns.has("username") && username) {
              pushValue("username", username);
            }
            if (archiveColumns.has("first_name") && firstName) {
              pushValue("first_name", firstName);
            }
            if (archiveColumns.has("middle_name") && middleName) {
              pushValue("middle_name", middleName);
            }
            if (archiveColumns.has("last_name") && lastName) {
              pushValue("last_name", lastName);
            }
            if (archiveColumns.has("suffix") && suffix) {
              pushValue("suffix", suffix);
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
            if (archiveColumns.has("phone_number") && contactNumber) {
              pushValue("phone_number", contactNumber);
            }
            if (archiveColumns.has("password") && password) {
              pushValue("password", password);
            }
            if (archiveColumns.has("reason")) {
              pushValue("reason", archiveReason);
            }
            if (archiveColumns.has("archived_at")) {
              pushValue("archived_at", new Date());
            }
            if (archiveColumns.has("timestamp")) {
              pushValue("timestamp", new Date());
            }
            if (archiveColumns.has("created_at") && createdAt) {
              pushValue("created_at", createdAt);
            }
            if (archiveColumns.has("updated_at") && updatedAt) {
              pushValue("updated_at", updatedAt);
            }
            if (archiveColumns.has("snapshot_json")) {
              const snapshot = {
                user: userRow,
                teacher: teacherRow,
              };
              pushValue("snapshot_json", JSON.stringify(snapshot));
            }

            const placeholders = buildPlaceholders(columns.length);
            const columnsSql = columns.join(", ");

            const [insertResult] = await connection.query<ResultSetHeader>(
              `INSERT INTO ${ARCHIVE_TABLE} (${columnsSql}) VALUES (${placeholders})`,
              values,
            );
            const insertedId = Number(insertResult.insertId);
            archivedIdForRelations = Number.isInteger(insertedId) && insertedId > 0 ? insertedId : null;
          } else if (archiveColumns.has("user_id")) {
            await connection.query<ResultSetHeader>(
              `UPDATE \`${ARCHIVE_TABLE}\` SET user_id = ? WHERE archived_id = ? AND (user_id IS NULL OR user_id = 0)`,
              [resolvedUserId, existingArchiveId],
            );
            archivedIdForRelations = existingArchiveId;
          }

          if (archivedIdForRelations !== null) {
            archivedIdByUserId.set(resolvedUserId, archivedIdForRelations);
            const resolvedTeacherValue = resolvedTeacherIdByUserId.get(userId);
            if (resolvedTeacherValue) {
              archivedIdByTeacherId.set(resolvedTeacherValue, archivedIdForRelations);
            }
          }

          archived.push({
            userId,
            name,
            email,
          });
        }

        if (
          archivedTeacherHandledColumns &&
          archivedTeacherHandledColumns.size > 0 &&
          teacherHandledColumns &&
          teacherHandledColumns.size > 0
        ) {
          const handledRows: RowDataPacket[] = [];
          const handledUsesUserId = teacherHandledColumns.has("user_id") && !teacherHandledColumns.has("teacher_id");
          if (teacherHandledColumns.has("teacher_id")) {
            const teacherIds = uniqueStrings(Array.from(resolvedTeacherIdByUserId.values()));
            for (const chunk of chunkArray(teacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT teacher_id, grade_id FROM teacher_handled WHERE teacher_id IN (${placeholders})`,
                chunk,
              );
              handledRows.push(...rows);
            }
          } else if (teacherHandledColumns.has("user_id")) {
            for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT user_id, grade_id FROM teacher_handled WHERE user_id IN (${placeholders})`,
                chunk,
              );
              handledRows.push(...rows);
            }
          }

          if (handledRows.length > 0) {
            const insertColumns: string[] = [];
            if (archivedTeacherHandledColumns.has("archived_id")) {
              insertColumns.push("archived_id");
            }
            if (archivedTeacherHandledColumns.has("teacher_id")) {
              insertColumns.push("teacher_id");
            }
            if (archivedTeacherHandledColumns.has("grade_id")) {
              insertColumns.push("grade_id");
            }
            if (archivedTeacherHandledColumns.has("archived_at")) {
              insertColumns.push("archived_at");
            }

            if (insertColumns.length === 0) {
              handledRows.length = 0;
            }

            const insertValues: any[][] = [];
            for (const row of handledRows) {
              let archivedId: number | undefined;
              let teacherIdValue: string | null = null;

              if (handledUsesUserId) {
                const userIdValue = Number(row.user_id ?? 0);
                if (!Number.isInteger(userIdValue) || userIdValue <= 0) {
                  continue;
                }
                archivedId = archivedIdByUserId.get(userIdValue);
                teacherIdValue = resolvedTeacherIdByUserId.get(userIdValue) ?? String(userIdValue);
              } else {
                const rawTeacherId = row.teacher_id;
                const teacherIdText = rawTeacherId !== null && rawTeacherId !== undefined
                  ? String(rawTeacherId).trim()
                  : "";
                if (!teacherIdText) {
                  continue;
                }
                archivedId = archivedIdByTeacherId.get(teacherIdText);
                teacherIdValue = teacherIdText;
              }

              if (!archivedId) {
                continue;
              }
              const rowValues: any[] = [];
              for (const column of insertColumns) {
                if (column === "archived_id") {
                  rowValues.push(archivedId);
                } else if (column === "teacher_id") {
                  rowValues.push(teacherIdValue);
                } else if (column === "grade_id") {
                  rowValues.push(row.grade_id ?? null);
                } else if (column === "archived_at") {
                  rowValues.push(new Date());
                }
              }
              if (rowValues.length > 0) {
                insertValues.push(rowValues);
              }
            }

            const columnSql = insertColumns.map((column) => `\`${column}\``).join(", ");
            const rowPlaceholder = `(${buildPlaceholders(insertColumns.length)})`;
            for (const chunk of chunkArray(insertValues, IN_CHUNK_SIZE)) {
              const placeholders = new Array(chunk.length).fill(rowPlaceholder).join(", ");
              const flatValues = chunk.flat();
              await connection.query<ResultSetHeader>(
                `INSERT INTO archived_teacher_handled (${columnSql}) VALUES ${placeholders}`,
                flatValues,
              );
            }
          }
        }

        if (teacherTable) {
          let deleteColumn: string | null = null;
          if (teacherColumns.has("user_id")) {
            deleteColumn = "user_id";
          } else if (teacherColumns.has("teacher_id")) {
            deleteColumn = "teacher_id";
          } else if (teacherColumns.has("employee_id")) {
            deleteColumn = "employee_id";
          }

          if (deleteColumn) {
            for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${teacherTable}\` WHERE \`${deleteColumn}\` IN (${placeholders})`,
                chunk,
              );
            }
          }
        }

        if (teacherHandledColumns && teacherHandledColumns.size > 0) {
          if (teacherHandledColumns.has("teacher_id")) {
            const teacherIds = uniqueStrings(Array.from(resolvedTeacherIdByUserId.values()));
            for (const chunk of chunkArray(teacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`teacher_handled\` WHERE teacher_id IN (${placeholders})`,
                chunk,
              );
            }
          } else if (teacherHandledColumns.has("user_id")) {
            for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`teacher_handled\` WHERE user_id IN (${placeholders})`,
                chunk,
              );
            }
          }
        }

        if (mtCoordinatorHandledColumns && mtCoordinatorHandledColumns.size > 0) {
          const teacherIds = uniqueStrings(Array.from(resolvedTeacherIdByUserId.values()));
          if (mtCoordinatorHandledColumns.has("master_teacher_id")) {
            for (const chunk of chunkArray(teacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`mt_coordinator_handled\` WHERE master_teacher_id IN (${placeholders})`,
                chunk,
              );
            }
          } else if (mtCoordinatorHandledColumns.has("teacher_id")) {
            for (const chunk of chunkArray(teacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`mt_coordinator_handled\` WHERE teacher_id IN (${placeholders})`,
                chunk,
              );
            }
          }
        }

        if (teacherReferencingMap.size > 0 && teacherRowByLookup.size > 0) {
          const teacherRows = Array.from(teacherRowByLookup.values());
          for (const [tableName, entries] of teacherReferencingMap) {
            if (!entries.length) {
              continue;
            }
            if (teacherTable && tableName.toLowerCase() === teacherTable.toLowerCase()) {
              continue;
            }

            for (const { column, referencedColumn } of entries) {
              if (!column || !referencedColumn) {
                continue;
              }
              const values = new Set<any>();
              for (const teacherRow of teacherRows) {
                const value = getColumnValue(teacherRow, referencedColumn);
                if (value !== null && value !== undefined) {
                  values.add(value);
                }
              }

              const valueList = Array.from(values);
              for (const chunk of chunkArray(valueList, IN_CHUNK_SIZE)) {
                const placeholders = buildPlaceholders(chunk.length);
                await connection.query<ResultSetHeader>(
                  `DELETE FROM \`${tableName}\` WHERE \`${column}\` IN (${placeholders})`,
                  chunk,
                );
              }
            }
          }
        }

        for (const [tableName, entries] of userReferencingMap) {
          const normalizedTableName = tableName.toLowerCase();
          if (normalizedTableName === "users") {
            continue;
          }
          if (normalizedTableName === ARCHIVE_TABLE.toLowerCase()) {
            continue;
          }
          if (normalizedTableName === "account_logs") {
            continue;
          }
          if (teacherTable && normalizedTableName === teacherTable.toLowerCase()) {
            continue;
          }

          for (const { column } of entries) {
            if (!column) {
              continue;
            }
            for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${tableName}\` WHERE \`${column}\` IN (${placeholders})`,
                chunk,
              );
            }
          }
        }

        if (canDeleteAccountLogs) {
          for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
            const placeholders = buildPlaceholders(chunk.length);
            await connection.query<ResultSetHeader>(
              `DELETE FROM \`account_logs\` WHERE user_id IN (${placeholders})`,
              chunk,
            );
          }
        }

        for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
          const placeholders = buildPlaceholders(chunk.length);
          await connection.query<ResultSetHeader>(
            `DELETE FROM users WHERE user_id IN (${placeholders})`,
            chunk,
          );
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

    console.error("Failed to archive teachers", error);
    return NextResponse.json({ error: "Failed to archive teachers." }, { status: 500 });
  }
}
