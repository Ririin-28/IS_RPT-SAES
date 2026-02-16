import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";

type DbConnection = Connection | PoolConnection;

const SUPER_ADMIN_ROLE = "super_admin";
const LEGACY_ADMIN_ROLE_NAMES = [
  "admin",
  "it_admin",
  "itadmin",
  "it-admin",
  "it admin",
  "super_admin",
  "super admin",
] as const;

let migrationDone = false;
let migrationPromise: Promise<void> | null = null;

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
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

  const [existing] = await db.execute<RowDataPacket[]>(
    `SELECT role_id, role_name
     FROM role
     WHERE LOWER(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_')) = ?
     ORDER BY role_id ASC`,
    [SUPER_ADMIN_ROLE],
  );
  if (existing.length > 0) {
    const preferredExact = existing.find((row) => String(row.role_name ?? "").trim().toLowerCase() === "super admin");
    const preferred = preferredExact ?? existing[0];
    if (preferred?.role_id != null) {
      return Number(preferred.role_id);
    }
  }

  await db.execute("INSERT INTO role (role_name) VALUES (?)", ["Super Admin"]);

  const [created] = await db.execute<RowDataPacket[]>(
    "SELECT role_id FROM role WHERE LOWER(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_')) = ? ORDER BY role_id ASC LIMIT 1",
    [SUPER_ADMIN_ROLE],
  );
  if (created.length > 0 && created[0]?.role_id != null) {
    return Number(created[0].role_id);
  }
  return null;
}

async function cleanupDuplicateSuperAdminRoles(db: DbConnection, preferredRoleId: number | null): Promise<void> {
  if (preferredRoleId == null) {
    return;
  }
  const roleColumns = await getColumnsIfExists(db, "role");
  if (!roleColumns.has("role_id") || !roleColumns.has("role_name")) {
    return;
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT role_id
     FROM role
     WHERE LOWER(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_')) = ?
       AND role_id <> ?`,
    [SUPER_ADMIN_ROLE, preferredRoleId],
  );

  for (const row of rows) {
    const duplicateRoleId = Number(row.role_id);
    if (!Number.isInteger(duplicateRoleId)) {
      continue;
    }
    try {
      await db.execute("DELETE FROM role WHERE role_id = ?", [duplicateRoleId]);
    } catch {
      // If FK constraints exist, keep duplicate row to avoid migration failure.
    }
  }
}

async function getLegacyRoleIds(db: DbConnection): Promise<number[]> {
  const roleColumns = await getColumnsIfExists(db, "role");
  if (!roleColumns.has("role_id") || !roleColumns.has("role_name")) {
    return [];
  }

  const placeholders = LEGACY_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT role_id FROM role WHERE LOWER(REPLACE(REPLACE(TRIM(role_name), '-', '_'), ' ', '_')) IN (${placeholders})`,
    [...LEGACY_ADMIN_ROLE_NAMES],
  );

  return rows
    .map((row) => Number(row.role_id))
    .filter((value) => Number.isInteger(value));
}

async function migrateUserRoles(db: DbConnection, superAdminRoleId: number | null): Promise<void> {
  const userColumns = await getColumnsIfExists(db, "users");
  if (userColumns.size === 0) {
    return;
  }

  if (userColumns.has("role")) {
    const placeholders = LEGACY_ADMIN_ROLE_NAMES.map(() => "?").join(", ");
    await db.execute(
      `UPDATE users
       SET role = ?
       WHERE LOWER(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_')) IN (${placeholders})`,
      [SUPER_ADMIN_ROLE, ...LEGACY_ADMIN_ROLE_NAMES],
    );
  }

  if (userColumns.has("role_id") && superAdminRoleId !== null) {
    const legacyRoleIds = await getLegacyRoleIds(db);
    const filteredLegacy = legacyRoleIds.filter((id) => id !== superAdminRoleId);
    if (filteredLegacy.length > 0) {
      const placeholders = filteredLegacy.map(() => "?").join(", ");
      await db.execute(
        `UPDATE users
         SET role_id = ?
         WHERE role_id IN (${placeholders})`,
        [superAdminRoleId, ...filteredLegacy],
      );
    }
  }
}

async function ensureSuperAdminTable(db: DbConnection): Promise<void> {
  const hasSuperAdminTable = await tableExists(db, "super_admin");
  const hasItAdminTable = await tableExists(db, "it_admin");

  if (!hasSuperAdminTable) {
    if (hasItAdminTable) {
      await db.execute("CREATE TABLE super_admin LIKE it_admin");
    } else {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS super_admin (
          it_admin_id VARCHAR(20) NOT NULL,
          user_id INT NOT NULL,
          PRIMARY KEY (it_admin_id),
          UNIQUE KEY uq_super_admin_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
  }

  if (!hasItAdminTable) {
    return;
  }

  const itAdminColumns = await getColumnsIfExists(db, "it_admin");
  const superAdminColumns = await getColumnsIfExists(db, "super_admin");
  if (itAdminColumns.size === 0 || superAdminColumns.size === 0) {
    return;
  }

  const sharedColumns = [...itAdminColumns].filter((column) => superAdminColumns.has(column));
  if (sharedColumns.length === 0) {
    return;
  }

  const quotedColumns = sharedColumns.map((column) => quoteIdentifier(column)).join(", ");

  if (sharedColumns.includes("user_id")) {
    await db.execute(
      `INSERT INTO super_admin (${quotedColumns})
       SELECT ${quotedColumns}
       FROM it_admin ia
       WHERE ia.user_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM super_admin sa WHERE sa.user_id = ia.user_id
         )`,
    );
    return;
  }

  await db.execute(`INSERT IGNORE INTO super_admin (${quotedColumns}) SELECT ${quotedColumns} FROM it_admin`);
}

async function runPhaseOneMigration(db: DbConnection): Promise<void> {
  const superAdminRoleId = await ensureRoleRow(db);
  await migrateUserRoles(db, superAdminRoleId);
  await cleanupDuplicateSuperAdminRoles(db, superAdminRoleId);
  await ensureSuperAdminTable(db);
}

export async function ensureSuperAdminPhaseOneMigration(db: DbConnection): Promise<void> {
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
