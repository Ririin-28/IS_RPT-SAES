import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getTableColumns } from "@/lib/db";

type QueryConnection = Pick<Connection, "execute"> | Pick<PoolConnection, "execute">;

const MASTER_TEACHER_TABLES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_tbl",
] as const;

const MASTER_TEACHER_ID_COLUMNS = [
  "master_teacher_id",
  "masterteacher_id",
  "mt_id",
  "teacher_id",
  "coordinator_id",
] as const;

const TEACHER_TABLES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_profile",
  "teacher_profiles",
  "faculty",
  "faculty_info",
  "faculty_profiles",
  "remedial_teachers",
] as const;

const TEACHER_ID_COLUMNS = [
  "teacher_id",
  "employee_id",
  "user_code",
  "id",
  "user_id",
] as const;

const PRINCIPAL_TABLES = [
  "principal",
  "principals",
  "principal_info",
  "principal_profile",
  "principal_profiles",
] as const;

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

export async function resolveMasterTeacherId(
  db: QueryConnection,
  userId: number,
): Promise<string | null> {
  for (const table of MASTER_TEACHER_TABLES) {
    const columns = await safeGetColumns(table);
    if (!columns.size || !columns.has("user_id")) {
      continue;
    }

    const idColumn = MASTER_TEACHER_ID_COLUMNS.find((col) => columns.has(col)) ?? null;
    const selectCol = idColumn ?? "user_id";

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT ${selectCol} AS master_teacher_id FROM ${table} WHERE user_id = ? LIMIT 1`,
        [userId],
      );

      const candidate = rows[0]?.master_teacher_id;
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        return String(candidate).trim();
      }
    } catch {
      continue;
    }
  }

  return String(userId);
}

export async function resolveTeacherId(
  db: QueryConnection,
  userId: number,
): Promise<string | null> {
  for (const table of TEACHER_TABLES) {
    const columns = await safeGetColumns(table);
    if (!columns.size || !columns.has("user_id")) {
      continue;
    }

    const idColumn = TEACHER_ID_COLUMNS.find((col) => columns.has(col)) ?? null;
    const selectCol = idColumn ?? "user_id";

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT ${selectCol} AS teacher_id FROM ${table} WHERE user_id = ? LIMIT 1`,
        [userId],
      );

      const candidate = rows[0]?.teacher_id;
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        return String(candidate).trim();
      }
    } catch {
      continue;
    }
  }

  return String(userId);
}

export async function resolvePrincipalId(
  db: QueryConnection,
  userId: number,
): Promise<string | null> {
  for (const table of PRINCIPAL_TABLES) {
    const columns = await safeGetColumns(table);
    if (!columns.size || !columns.has("user_id")) {
      continue;
    }

    const selectCol = columns.has("principal_id") ? "principal_id" : "user_id";

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT ${selectCol} AS principal_id FROM ${table} WHERE user_id = ? LIMIT 1`,
        [userId],
      );

      const candidate = rows[0]?.principal_id;
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        return String(candidate).trim();
      }
    } catch {
      continue;
    }
  }

  return null;
}
