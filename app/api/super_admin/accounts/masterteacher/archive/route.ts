import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { HttpError } from "../validation/validation";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

export const dynamic = "force-dynamic";

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

const ARCHIVE_TABLE = "archived_users";

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

function buildPlaceholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.archive" });
  if (!auth.ok) {
    return auth.response;
  }

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

      // Preload role ids to avoid FK violations on archive insert.
      const roleIds = new Set<number>();
      try {
        const [roleRows] = await connection.query<RowDataPacket[]>("SELECT role_id FROM role");
        for (const row of roleRows) {
          const id = Number(row.role_id);
          if (Number.isInteger(id)) {
            roleIds.add(id);
          }
        }
      } catch {
        // If role table is missing, leave set empty; we will skip role_id insert to avoid FK errors.
      }

      const masterTeacherTables = await resolveMasterTeacherTables(connection);
      const mtCoordinatorHandledColumns = await tryFetchTableColumns(connection, "mt_coordinator_handled");
      const mtRemedialHandledColumns = await tryFetchTableColumns(connection, "mt_remedialteacher_handled");
      const archivedMtCoordinatorColumns = await tryFetchTableColumns(connection, "archived_mt_coordinator_handled");
      const archivedMtRemedialColumns = await tryFetchTableColumns(connection, "archived_mt_remedialteacher_handled");
      const accountLogsColumns = await tryFetchTableColumns(connection, "account_logs");
      const canDeleteAccountLogs = !!accountLogsColumns && accountLogsColumns.has("user_id");
      const userReferencingMap = await fetchReferencingMap(connection, "users");
      const masterTeacherReferencingMaps = new Map<string, Map<string, ReferencingEntry[]>>();
      for (const { table } of masterTeacherTables) {
        masterTeacherReferencingMaps.set(table, await fetchReferencingMap(connection, table));
      }

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

      const masterTeacherRowsByUserId = new Map<number, Map<string, RowDataPacket>>();
      const masterTeacherRowsByTable = new Map<string, RowDataPacket[]>();

      for (const { table, columns } of masterTeacherTables) {
        const lookupColumns = ["user_id", "master_teacher_id", "masterteacher_id", "teacher_id"].filter((column) =>
          columns.has(column),
        );
        for (const column of lookupColumns) {
          for (const chunk of chunkArray(foundUserIds, IN_CHUNK_SIZE)) {
            const placeholders = buildPlaceholders(chunk.length);
            const [rows] = await connection.query<RowDataPacket[]>(
              `SELECT * FROM \`${table}\` WHERE \`${column}\` IN (${placeholders})`,
              chunk,
            );
            for (const row of rows) {
              const keyValue = getColumnValue(row, column);
              const parsedKey = keyValue !== null && keyValue !== undefined ? Number(keyValue) : NaN;
              if (!Number.isInteger(parsedKey) || parsedKey <= 0) {
                continue;
              }

              let tableMap = masterTeacherRowsByUserId.get(parsedKey);
              if (!tableMap) {
                tableMap = new Map<string, RowDataPacket>();
                masterTeacherRowsByUserId.set(parsedKey, tableMap);
              }
              if (!tableMap.has(table)) {
                tableMap.set(table, row);
                const existingRows = masterTeacherRowsByTable.get(table) ?? [];
                existingRows.push(row);
                masterTeacherRowsByTable.set(table, existingRows);
              }
            }
          }
        }
      }

      await connection.beginTransaction();
      try {
        const archived: ArchiveResult[] = [];
        const archiveReason = reason && reason.length > 0 ? reason : "Archived by Super Admin";
        const archivedByValueRaw = payload?.archivedBy;
        const archivedByValue = Number(archivedByValueRaw);
        const archivedBy = Number.isInteger(archivedByValue) && archivedByValue > 0 ? archivedByValue : null;

        const archivedIdByUserId = new Map<number, number>();
        const archivedIdByMasterTeacherId = new Map<string, number>();
        const resolvedMasterTeacherIdByUserId = new Map<number, string | number>();

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
          const username = typeof userRow.username === "string" ? userRow.username : null;
          const firstName = typeof userRow.first_name === "string" ? userRow.first_name : null;
          const middleName = typeof userRow.middle_name === "string" ? userRow.middle_name : null;
          const lastName = typeof userRow.last_name === "string" ? userRow.last_name : null;
          const suffix = typeof userRow.suffix === "string" ? userRow.suffix : null;
          const password = typeof userRow.password === "string" ? userRow.password : null;
          const createdAt = getColumnValue(userRow, "created_at");
          const updatedAt = getColumnValue(userRow, "updated_at");
          const roleId = Number.isInteger(userRow.role_id) ? (userRow.role_id as number) : null;
          const userCode = typeof userRow.user_code === "string" ? userRow.user_code : null;

          const masterTeacherRows = masterTeacherRowsByUserId.get(userId) ?? new Map<string, RowDataPacket>();

          let resolvedMasterTeacherId: string | number | null = null;
          for (const row of masterTeacherRows.values()) {
            const candidate =
              getColumnValue(row, "master_teacher_id") ??
              getColumnValue(row, "masterteacher_id") ??
              getColumnValue(row, "teacher_id");
            if (candidate !== null && candidate !== undefined) {
              resolvedMasterTeacherId = candidate as string | number;
              break;
            }
          }

          if (resolvedMasterTeacherId !== null && resolvedMasterTeacherId !== undefined) {
            resolvedMasterTeacherIdByUserId.set(userId, resolvedMasterTeacherId);
          }

          let archivedIdForRelations: number | null = null;
          const existingArchiveId = existingArchiveByUserId.get(resolvedUserId);
          if (!existingArchiveId) {
            const columns: string[] = [];
            const values: any[] = [];

            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            pushValue("user_id", resolvedUserId);
            if (archiveColumns.has("user_code") && userCode) {
              pushValue("user_code", userCode);
            }
            if (archiveColumns.has("role_id") && roleId !== null && roleIds.has(roleId)) {
              pushValue("role_id", roleId);
            }
            if (archiveColumns.has("name") && name) {
              pushValue("name", name);
            }
            if (archiveColumns.has("email") && email) {
              pushValue("email", email);
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
            if (archiveColumns.has("created_at") && createdAt) {
              pushValue("created_at", createdAt);
            }
            if (archiveColumns.has("updated_at") && updatedAt) {
              pushValue("updated_at", updatedAt);
            }
            if (archiveColumns.has("archived_at")) {
              pushValue("archived_at", new Date());
            }
            if (archiveColumns.has("archived_by") && archivedBy !== null) {
              pushValue("archived_by", archivedBy);
            }

            if (archiveColumns.has("snapshot_json")) {
              const masterTeacherSnapshot = Object.fromEntries(
                Array.from(masterTeacherRows.entries()).map(([tableName, row]) => [tableName, row]),
              );
              const snapshot = {
                user: userRow,
                masterTeacher: masterTeacherSnapshot,
              };
              pushValue("snapshot_json", JSON.stringify(snapshot));
            }

            const placeholders = columns.map(() => "?").join(", ");
            const columnsSql = columns.join(", ");

            const [archiveInsert] = await connection.query<ResultSetHeader>(
              `INSERT INTO ${ARCHIVE_TABLE} (${columnsSql}) VALUES (${placeholders})`,
              values,
            );
            const insertedId = Number(archiveInsert.insertId);
            archivedIdForRelations = Number.isInteger(insertedId) && insertedId > 0 ? insertedId : null;
          } else if (archiveColumns.has("user_id")) {
            await connection.query<ResultSetHeader>(
              `UPDATE ${ARCHIVE_TABLE} SET user_id = ? WHERE archived_id = ? AND (user_id IS NULL OR user_id = 0)` ,
              [resolvedUserId, existingArchiveId],
            );
            archivedIdForRelations = existingArchiveId;
          }

          if (archivedIdForRelations !== null) {
            archivedIdByUserId.set(resolvedUserId, archivedIdForRelations);
            if (resolvedMasterTeacherId !== null && resolvedMasterTeacherId !== undefined) {
              archivedIdByMasterTeacherId.set(String(resolvedMasterTeacherId), archivedIdForRelations);
            }
          }
          archived.push({
            userId,
            name,
            email,
          });
        }

        const resolvedMasterTeacherIds = Array.from(new Set(resolvedMasterTeacherIdByUserId.values().map((value) => String(value))));

        if (
          archivedMtCoordinatorColumns &&
          archivedMtCoordinatorColumns.size > 0 &&
          mtCoordinatorHandledColumns &&
          mtCoordinatorHandledColumns.has("master_teacher_id") &&
          resolvedMasterTeacherIds.length > 0
        ) {
          const coordinatorRows: RowDataPacket[] = [];
          for (const chunk of chunkArray(resolvedMasterTeacherIds, IN_CHUNK_SIZE)) {
            const placeholders = buildPlaceholders(chunk.length);
            const [rows] = await connection.query<RowDataPacket[]>(
              `SELECT master_teacher_id, grade_id, subject_id FROM \`mt_coordinator_handled\` WHERE master_teacher_id IN (${placeholders})`,
              chunk,
            );
            coordinatorRows.push(...rows);
          }

          if (coordinatorRows.length > 0) {
            const insertColumns: string[] = [];
            if (archivedMtCoordinatorColumns.has("archived_id")) insertColumns.push("archived_id");
            if (archivedMtCoordinatorColumns.has("master_teacher_id")) insertColumns.push("master_teacher_id");
            if (archivedMtCoordinatorColumns.has("grade_id")) insertColumns.push("grade_id");
            if (archivedMtCoordinatorColumns.has("subject_id")) insertColumns.push("subject_id");
            if (archivedMtCoordinatorColumns.has("archived_at")) insertColumns.push("archived_at");

            if (insertColumns.length > 0) {
              const rowPlaceholder = `(${buildPlaceholders(insertColumns.length)})`;
              const columnSql = insertColumns.map((column) => `\`${column}\``).join(", ");
              const insertValues: any[][] = [];
              for (const row of coordinatorRows) {
                const masterTeacherKey = row.master_teacher_id !== null && row.master_teacher_id !== undefined
                  ? String(row.master_teacher_id)
                  : null;
                if (!masterTeacherKey) {
                  continue;
                }
                const archivedId = archivedIdByMasterTeacherId.get(masterTeacherKey);
                if (!archivedId) {
                  continue;
                }

                const rowValues: any[] = [];
                for (const column of insertColumns) {
                  if (column === "archived_id") rowValues.push(archivedId);
                  else if (column === "master_teacher_id") rowValues.push(row.master_teacher_id);
                  else if (column === "grade_id") rowValues.push(row.grade_id ?? null);
                  else if (column === "subject_id") rowValues.push(row.subject_id ?? null);
                  else if (column === "archived_at") rowValues.push(new Date());
                }
                insertValues.push(rowValues);
              }

              for (const chunk of chunkArray(insertValues, IN_CHUNK_SIZE)) {
                const placeholders = new Array(chunk.length).fill(rowPlaceholder).join(", ");
                const flatValues = chunk.flat();
                await connection.query<ResultSetHeader>(
                  `INSERT INTO archived_mt_coordinator_handled (${columnSql}) VALUES ${placeholders}`,
                  flatValues,
                );
              }
            }
          }
        }

        if (
          archivedMtRemedialColumns &&
          archivedMtRemedialColumns.size > 0 &&
          mtRemedialHandledColumns &&
          mtRemedialHandledColumns.has("master_teacher_id") &&
          resolvedMasterTeacherIds.length > 0
        ) {
          const remedialRows: RowDataPacket[] = [];
          for (const chunk of chunkArray(resolvedMasterTeacherIds, IN_CHUNK_SIZE)) {
            const placeholders = buildPlaceholders(chunk.length);
            const [rows] = await connection.query<RowDataPacket[]>(
              `SELECT master_teacher_id, grade_id FROM \`mt_remedialteacher_handled\` WHERE master_teacher_id IN (${placeholders})`,
              chunk,
            );
            remedialRows.push(...rows);
          }

          if (remedialRows.length > 0) {
            const insertColumns: string[] = [];
            if (archivedMtRemedialColumns.has("archived_id")) insertColumns.push("archived_id");
            if (archivedMtRemedialColumns.has("master_teacher_id")) insertColumns.push("master_teacher_id");
            if (archivedMtRemedialColumns.has("grade_id")) insertColumns.push("grade_id");
            if (archivedMtRemedialColumns.has("archived_at")) insertColumns.push("archived_at");

            if (insertColumns.length > 0) {
              const rowPlaceholder = `(${buildPlaceholders(insertColumns.length)})`;
              const columnSql = insertColumns.map((column) => `\`${column}\``).join(", ");
              const insertValues: any[][] = [];
              for (const row of remedialRows) {
                const masterTeacherKey = row.master_teacher_id !== null && row.master_teacher_id !== undefined
                  ? String(row.master_teacher_id)
                  : null;
                if (!masterTeacherKey) {
                  continue;
                }
                const archivedId = archivedIdByMasterTeacherId.get(masterTeacherKey);
                if (!archivedId) {
                  continue;
                }

                const rowValues: any[] = [];
                for (const column of insertColumns) {
                  if (column === "archived_id") rowValues.push(archivedId);
                  else if (column === "master_teacher_id") rowValues.push(row.master_teacher_id);
                  else if (column === "grade_id") rowValues.push(row.grade_id ?? null);
                  else if (column === "archived_at") rowValues.push(new Date());
                }
                insertValues.push(rowValues);
              }

              for (const chunk of chunkArray(insertValues, IN_CHUNK_SIZE)) {
                const placeholders = new Array(chunk.length).fill(rowPlaceholder).join(", ");
                const flatValues = chunk.flat();
                await connection.query<ResultSetHeader>(
                  `INSERT INTO archived_mt_remedialteacher_handled (${columnSql}) VALUES ${placeholders}`,
                  flatValues,
                );
              }
            }
          }
        }

        for (const { table, columns } of masterTeacherTables) {
          const tableRows = masterTeacherRowsByTable.get(table) ?? [];
          if (tableRows.length === 0) {
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
              if (normalizedReferencedTable === ARCHIVE_TABLE.toLowerCase() || normalizedReferencedTable === "account_logs") {
                continue;
              }

              for (const { column, referencedColumn } of entries) {
                if (!column || !referencedColumn) {
                  continue;
                }
                const values = new Set<any>();
                for (const row of tableRows) {
                  const value = getColumnValue(row, referencedColumn);
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

          const deletionCandidates: Array<{ column: string; useUserId: boolean }> = [
            { column: "user_id", useUserId: true },
            { column: "master_teacher_id", useUserId: false },
            { column: "masterteacher_id", useUserId: false },
            { column: "teacher_id", useUserId: false },
            { column: "coord_id", useUserId: false },
            { column: "remedial_teacher_id", useUserId: false },
            { column: "remedial_id", useUserId: false },
          ];

          for (const { column, useUserId } of deletionCandidates) {
            if (!columns.has(column)) {
              continue;
            }
            const values = new Set<any>();
            for (const row of tableRows) {
              const value = useUserId ? getColumnValue(row, "user_id") : getColumnValue(row, column);
              if (value !== null && value !== undefined) {
                values.add(value);
              }
            }
            const valueList = Array.from(values);
            for (const chunk of chunkArray(valueList, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${table}\` WHERE \`${column}\` IN (${placeholders})`,
                chunk,
              );
            }
          }

          if (columns.has("id")) {
            const values = new Set<any>();
            for (const row of tableRows) {
              const value = getColumnValue(row, "id");
              if (value !== null && value !== undefined) {
                values.add(value);
              }
            }
            const valueList = Array.from(values);
            for (const chunk of chunkArray(valueList, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`${table}\` WHERE \`id\` IN (${placeholders})`,
                chunk,
              );
            }
          }
        }

        if (resolvedMasterTeacherIds.length > 0) {
          if (mtCoordinatorHandledColumns && mtCoordinatorHandledColumns.has("master_teacher_id")) {
            for (const chunk of chunkArray(resolvedMasterTeacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`mt_coordinator_handled\` WHERE master_teacher_id IN (${placeholders})`,
                chunk,
              );
            }
          }
          if (mtRemedialHandledColumns && mtRemedialHandledColumns.has("master_teacher_id")) {
            for (const chunk of chunkArray(resolvedMasterTeacherIds, IN_CHUNK_SIZE)) {
              const placeholders = buildPlaceholders(chunk.length);
              await connection.query<ResultSetHeader>(
                `DELETE FROM \`mt_remedialteacher_handled\` WHERE master_teacher_id IN (${placeholders})`,
                chunk,
              );
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

    console.error("Failed to archive master teachers", error);
    return NextResponse.json({ error: "Failed to archive master teachers." }, { status: 500 });
  }
}
