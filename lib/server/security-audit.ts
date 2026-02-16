import type { Connection, PoolConnection } from "mysql2/promise";

type DbConnection = Connection | PoolConnection;

type AuditInput = {
  action: string;
  userId: string | number | null;
  ipAddress?: string | null;
  details?: unknown;
};

let schemaReady = false;

export function resolveRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return null;
}

async function ensureSecurityAuditSchema(db: DbConnection): Promise<void> {
  if (schemaReady) {
    return;
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      log_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(80) NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_security_audit_created_at (created_at),
      INDEX idx_security_audit_action (action),
      INDEX idx_security_audit_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

function toAuditString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function stringifyDetails(details: unknown): string | null {
  if (details === null || details === undefined) {
    return null;
  }
  if (typeof details === "string") {
    const trimmed = details.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.length > 65000 ? trimmed.slice(0, 65000) : trimmed;
  }
  try {
    const json = JSON.stringify(details);
    if (!json) {
      return null;
    }
    return json.length > 65000 ? json.slice(0, 65000) : json;
  } catch {
    return null;
  }
}

export async function writeSecurityAuditLog(db: DbConnection, input: AuditInput): Promise<void> {
  await ensureSecurityAuditSchema(db);

  const action = toAuditString(input.action).slice(0, 80) || "unknown_action";
  const userId = toAuditString(input.userId) || "unknown";
  const ipAddress = toAuditString(input.ipAddress).slice(0, 45) || null;
  const details = stringifyDetails(input.details);

  await db.execute(
    `INSERT INTO security_audit_logs (action, user_id, ip_address, details, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [action, userId, ipAddress, details],
  );
}
