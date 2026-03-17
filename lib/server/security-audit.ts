import type { Connection, PoolConnection } from "mysql2/promise";

type DbConnection = Connection | PoolConnection;

type AuditInput = {
  action: string;
  userId: string | number | null;
  emergencyAccessId?: number | null;
  accessMode?: string | null;
  targetModule?: string | null;
  targetRecordId?: string | number | null;
  ipAddress?: string | null;
  details?: unknown;
};

let schemaReady = false;
let emergencyFkReady = false;

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
      emergency_access_id BIGINT UNSIGNED NULL,
      access_mode VARCHAR(20) NULL,
      target_module VARCHAR(50) NULL,
      target_record_id VARCHAR(100) NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_security_audit_created_at (created_at),
      INDEX idx_security_audit_action (action),
      INDEX idx_security_audit_user_id (user_id),
      INDEX idx_security_audit_emergency_access_id (emergency_access_id),
      INDEX idx_security_audit_access_mode (access_mode),
      INDEX idx_security_audit_target_module (target_module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [columnRows] = await db.query<Array<{ Field: string }>>("SHOW COLUMNS FROM security_audit_logs");
  const existing = new Set(columnRows.map((row) => String(row.Field)));

  if (!existing.has("emergency_access_id")) {
    await db.execute(
      "ALTER TABLE security_audit_logs ADD COLUMN emergency_access_id BIGINT UNSIGNED NULL AFTER user_id",
    );
  }
  if (!existing.has("access_mode")) {
    await db.execute(
      "ALTER TABLE security_audit_logs ADD COLUMN access_mode VARCHAR(20) NULL AFTER emergency_access_id",
    );
  }
  if (!existing.has("target_module")) {
    await db.execute(
      "ALTER TABLE security_audit_logs ADD COLUMN target_module VARCHAR(50) NULL AFTER access_mode",
    );
  }
  if (!existing.has("target_record_id")) {
    await db.execute(
      "ALTER TABLE security_audit_logs ADD COLUMN target_record_id VARCHAR(100) NULL AFTER target_module",
    );
  }

  if (!emergencyFkReady) {
    try {
      await db.execute(
        `ALTER TABLE security_audit_logs
         ADD CONSTRAINT fk_security_audit_emergency_access
         FOREIGN KEY (emergency_access_id) REFERENCES emergency_access(emergency_access_id)`,
      );
    } catch {
      // Keep columns even when legacy constraints prevent FK creation.
    }
    emergencyFkReady = true;
  }

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
  const emergencyAccessId =
    input.emergencyAccessId === null || input.emergencyAccessId === undefined
      ? null
      : Number.isFinite(Number(input.emergencyAccessId))
      ? Number(input.emergencyAccessId)
      : null;
  const accessMode = toAuditString(input.accessMode).slice(0, 20) || null;
  const targetModule = toAuditString(input.targetModule).slice(0, 50) || null;
  const targetRecordId = toAuditString(input.targetRecordId).slice(0, 100) || null;
  const ipAddress = toAuditString(input.ipAddress).slice(0, 45) || null;
  const details = stringifyDetails(input.details);

  await db.execute(
    `INSERT INTO security_audit_logs (
       action,
       user_id,
       emergency_access_id,
       access_mode,
       target_module,
       target_record_id,
       ip_address,
       details,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [action, userId, emergencyAccessId, accessMode, targetModule, targetRecordId, ipAddress, details],
  );
}
