import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";

const ROLE_NORMALIZE_REGEX = /[\s/\-]+/g;
let schemaEnsured = false;

function normalizeRole(role: unknown): string | null {
  if (typeof role !== "string" || role.trim().length === 0) {
    return null;
  }
  return role.trim().toLowerCase().replace(ROLE_NORMALIZE_REGEX, "_");
}

async function ensureRequiredColumns(db: Connection | PoolConnection) {
  const [columns] = await db.execute<RowDataPacket[]>("SHOW COLUMNS FROM account_logs");
  const existing = new Set(columns.map((column) => String(column.Field)));
  const alterStatements: string[] = [];

  if (!existing.has("role")) {
    alterStatements.push("ADD COLUMN role VARCHAR(100) DEFAULT NULL AFTER user_id");
  }
  if (!existing.has("last_login")) {
    alterStatements.push(
      "ADD COLUMN last_login DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER role"
    );
  }
  if (!existing.has("created_at")) {
    alterStatements.push(
      "ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER last_login"
    );
  }
  if (!existing.has("logged_out_at")) {
    alterStatements.push(
      "ADD COLUMN logged_out_at DATETIME DEFAULT NULL AFTER last_login"
    );
  }
  const hasLogIdentifier = existing.has("log_id") || existing.has("id");
  if (!hasLogIdentifier) {
    alterStatements.push(
      "ADD COLUMN log_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST"
    );
  }

  if (alterStatements.length > 0) {
    await db.execute(`ALTER TABLE account_logs ${alterStatements.join(", ")}`);
  }

}

async function ensureAccountLogsTable(db: Connection | PoolConnection) {
  if (!schemaEnsured) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS account_logs (
        log_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role VARCHAR(100) DEFAULT NULL,
        last_login DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_account_logs_user_id (user_id),
        INDEX idx_account_logs_last_login (last_login)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    schemaEnsured = true;
  }

  await ensureRequiredColumns(db);
}

export async function recordAccountLogin(
  db: Connection | PoolConnection,
  userId: unknown,
  role: unknown
): Promise<void> {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    return;
  }

  try {
    await ensureAccountLogsTable(db);
    const normalizedRole = normalizeRole(role);

    await db.execute(
      `UPDATE account_logs
       SET logged_out_at = NOW()
       WHERE user_id = ? AND logged_out_at IS NULL`,
      [numericUserId]
    );

    await db.execute(
      `INSERT INTO account_logs (user_id, role, last_login, logged_out_at)
       VALUES (?, ?, NOW(), NULL)`,
      [numericUserId, normalizedRole]
    );
  } catch (error) {
    console.error("Failed to record account login", error);
  }
}

export async function recordAccountLogout(
  db: Connection | PoolConnection,
  userId: unknown
): Promise<void> {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    return;
  }

  try {
    await ensureAccountLogsTable(db);

    await db.execute(
      `UPDATE account_logs
       SET logged_out_at = NOW()
       WHERE user_id = ? AND logged_out_at IS NULL
       ORDER BY last_login DESC
       LIMIT 1`,
      [numericUserId]
    );
  } catch (error) {
    console.error("Failed to record account logout", error);
  }
}
