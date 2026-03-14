import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";

export type DbConnection = Connection | PoolConnection;

export const CANONICAL_IT_ADMIN_ROLE = "it_admin";
export const IT_ADMIN_ROLE_LABEL = "IT Admin";
export const LEGACY_IT_ADMIN_ROLE_NAMES = [
  "admin",
  "it_admin",
  "itadmin",
  "it-admin",
  "it admin",
  "super_admin",
  "superadmin",
  "super-admin",
  "super admin",
] as const;

let migrationDone = false;
let migrationPromise: Promise<void> | null = null;

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

export function normalizeLegacyItAdminRoleName(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isLegacyItAdminRoleName(value: string | null | undefined): boolean {
  const normalized = normalizeLegacyItAdminRoleName(value);
  return LEGACY_IT_ADMIN_ROLE_NAMES.some((candidate) => normalizeLegacyItAdminRoleName(candidate) === normalized);
}

async function tableExists(db: DbConnection, tableName: string): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
  return rows.length > 0;
}

async function getTableColumns(db: DbConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await db.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${quoteIdentifier(tableName)}`);
  return new Set(rows.map((row) => String(row.Field)));
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR" || code === "42S02";
}

async function getColumnsIfExists(db: DbConnection, tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(db, tableName);
  } catch (error) {
    if (isMissingTableError(error)) {
      return new Set<string>();
    }
    throw error;
  }
}

async function ensureRoleRow(db: DbConnection): Promise<number | null> {
  const roleColumns = await getColumnsIfExists(db, "role");
  if (!roleColumns.has("role_name")) {
    return null;
  }

  const placeholders = LEGACY_IT_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
  const [existing] = await db.execute<RowDataPacket[]>(
    `SELECT role_id, role_name
     FROM role
     WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_'), '/', '_')) IN (${placeholders})
     ORDER BY role_id ASC`,
    [...LEGACY_IT_ADMIN_ROLE_NAMES],
  );

  const preferredExact = existing.find((row) => String(row.role_name ?? "").trim() === IT_ADMIN_ROLE_LABEL);
  const preferred = preferredExact ?? existing[0];
  if (preferred?.role_id != null) {
    if (String(preferred.role_name ?? "").trim() !== IT_ADMIN_ROLE_LABEL) {
      await db.execute("UPDATE role SET role_name = ? WHERE role_id = ?", [IT_ADMIN_ROLE_LABEL, preferred.role_id]);
    }
    return Number(preferred.role_id);
  }

  await db.execute("INSERT INTO role (role_name) VALUES (?)", [IT_ADMIN_ROLE_LABEL]);

  const [created] = await db.execute<RowDataPacket[]>(
    `SELECT role_id
     FROM role
     WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_'), '/', '_')) = ?
     ORDER BY role_id ASC
     LIMIT 1`,
    [CANONICAL_IT_ADMIN_ROLE],
  );
  if (created.length > 0 && created[0]?.role_id != null) {
    return Number(created[0].role_id);
  }
  return null;
}

async function cleanupDuplicateItAdminRoles(db: DbConnection, preferredRoleId: number | null): Promise<void> {
  if (preferredRoleId == null) {
    return;
  }
  const roleColumns = await getColumnsIfExists(db, "role");
  if (!roleColumns.has("role_id") || !roleColumns.has("role_name")) {
    return;
  }

  const placeholders = LEGACY_IT_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT role_id
     FROM role
     WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_'), '/', '_')) IN (${placeholders})
       AND role_id <> ?`,
    [...LEGACY_IT_ADMIN_ROLE_NAMES, preferredRoleId],
  );

  for (const row of rows) {
    const duplicateRoleId = Number(row.role_id);
    if (!Number.isInteger(duplicateRoleId)) {
      continue;
    }
    try {
      await db.execute("DELETE FROM role WHERE role_id = ?", [duplicateRoleId]);
    } catch {
      // Keep duplicates when foreign keys would make deletion unsafe.
    }
  }
}

async function getLegacyRoleIds(db: DbConnection): Promise<number[]> {
  const roleColumns = await getColumnsIfExists(db, "role");
  if (!roleColumns.has("role_id") || !roleColumns.has("role_name")) {
    return [];
  }

  const placeholders = LEGACY_IT_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT role_id
     FROM role
     WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_'), '/', '_')) IN (${placeholders})`,
    [...LEGACY_IT_ADMIN_ROLE_NAMES],
  );

  return rows
    .map((row) => Number(row.role_id))
    .filter((value) => Number.isInteger(value));
}

async function migrateUserRoles(db: DbConnection, itAdminRoleId: number | null): Promise<void> {
  const userColumns = await getColumnsIfExists(db, "users");
  if (userColumns.size === 0) {
    return;
  }

  if (userColumns.has("role")) {
    const placeholders = LEGACY_IT_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
    await db.execute(
      `UPDATE users
       SET role = ?
       WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_'), '/', '_')) IN (${placeholders})`,
      [CANONICAL_IT_ADMIN_ROLE, ...LEGACY_IT_ADMIN_ROLE_NAMES],
    );
  }

  if (userColumns.has("role_id") && itAdminRoleId !== null) {
    const legacyRoleIds = await getLegacyRoleIds(db);
    const filteredLegacy = legacyRoleIds.filter((id) => id !== itAdminRoleId);
    if (filteredLegacy.length > 0) {
      const placeholders = filteredLegacy.map(() => "?").join(", ");
      await db.execute(
        `UPDATE users
         SET role_id = ?
         WHERE role_id IN (${placeholders})`,
        [itAdminRoleId, ...filteredLegacy],
      );
    }
  }
}

async function ensureCanonicalItAdminTable(db: DbConnection): Promise<void> {
  const hasItAdminTable = await tableExists(db, "it_admin");
  const hasSuperAdminTable = await tableExists(db, "super_admin");

  if (!hasItAdminTable) {
    if (hasSuperAdminTable) {
      await db.execute("CREATE TABLE it_admin LIKE super_admin");
    } else {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS it_admin (
          it_admin_id VARCHAR(20) NOT NULL,
          admin_id VARCHAR(20) DEFAULT NULL,
          user_id INT NOT NULL,
          PRIMARY KEY (it_admin_id),
          UNIQUE KEY uq_it_admin_user_id (user_id),
          UNIQUE KEY uq_it_admin_admin_id (admin_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
  }

  if (!hasSuperAdminTable) {
    await db.execute("CREATE TABLE IF NOT EXISTS super_admin LIKE it_admin");
  }
}

export function buildUserLinkedAdminSyncSql(
  sourceTable: string,
  targetTable: string,
  sharedColumns: string[],
): string {
  const quotedColumns = sharedColumns.map((column) => quoteIdentifier(column)).join(", ");
  const quotedSourceColumns = sharedColumns
    .map((column) => `source.${quoteIdentifier(column)}`)
    .join(", ");

  return `
    INSERT IGNORE INTO ${quoteIdentifier(targetTable)} (${quotedColumns})
    SELECT ${quotedSourceColumns}
    FROM ${quoteIdentifier(sourceTable)} AS source
    INNER JOIN \`users\` AS users_ref ON users_ref.user_id = source.user_id
    WHERE source.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ${quoteIdentifier(targetTable)} AS target WHERE target.user_id = source.user_id
      )
  `;
}

async function syncAdminTable(sourceTable: string, targetTable: string, db: DbConnection): Promise<void> {
  const sourceColumns = await getColumnsIfExists(db, sourceTable);
  const targetColumns = await getColumnsIfExists(db, targetTable);
  if (sourceColumns.size === 0 || targetColumns.size === 0) {
    return;
  }

  const sharedColumns = [...sourceColumns].filter((column) => targetColumns.has(column));
  if (sharedColumns.length === 0) {
    return;
  }

  const quotedColumns = sharedColumns.map((column) => quoteIdentifier(column)).join(", ");
  if (sharedColumns.includes("user_id")) {
    await db.execute(buildUserLinkedAdminSyncSql(sourceTable, targetTable, sharedColumns));
    return;
  }

  await db.execute(
    `INSERT IGNORE INTO ${quoteIdentifier(targetTable)} (${quotedColumns})
     SELECT ${quotedColumns} FROM ${quoteIdentifier(sourceTable)}`,
  );
}

async function runPhaseOneMigration(db: DbConnection): Promise<void> {
  const itAdminRoleId = await ensureRoleRow(db);
  await migrateUserRoles(db, itAdminRoleId);
  await cleanupDuplicateItAdminRoles(db, itAdminRoleId);
  await ensureCanonicalItAdminTable(db);
  await syncAdminTable("super_admin", "it_admin", db);
  await syncAdminTable("it_admin", "super_admin", db);
}

export async function ensureItAdminPhaseOneMigration(db: DbConnection): Promise<void> {
  if (migrationDone) {
    return;
  }
  if (migrationPromise) {
    await migrationPromise;
    return;
  }

  migrationPromise = runPhaseOneMigration(db)
    .then(() => {
      migrationDone = true;
    })
    .finally(() => {
      migrationPromise = null;
    });

  await migrationPromise;
}
