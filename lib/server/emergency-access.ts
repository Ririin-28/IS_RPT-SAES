import type { Connection, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { writeSecurityAuditLog } from "@/lib/server/security-audit";

export type DbConnection = Connection | PoolConnection;
export type EmergencyModuleName = "Calendars" | "Requests";

export type EmergencyAccessRow = RowDataPacket & {
  emergency_access_id: number;
  activated_by_user_id: number;
  activated_for_role: string;
  reason: string;
  scope_modules: string;
  is_active: number;
  activated_at: Date | string;
  expires_at: Date | string | null;
  deactivated_at: Date | string | null;
  deactivated_by_user_id: number | null;
};

const EMERGENCY_SCOPE = "Calendars,Requests";
const TARGET_ROLE = "Principal";

let schemaReady = false;
let fkReady = false;

function normalizeDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function splitScope(scopeModules: string): Set<string> {
  return new Set(
    scopeModules
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export async function ensureEmergencyAccessSchema(db: DbConnection): Promise<void> {
  if (!schemaReady) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS emergency_access (
        emergency_access_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        activated_by_user_id INT NOT NULL,
        activated_for_role VARCHAR(50) NOT NULL DEFAULT 'Principal',
        reason TEXT NOT NULL,
        scope_modules VARCHAR(255) NOT NULL DEFAULT 'Calendars,Requests',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        deactivated_at DATETIME NULL,
        deactivated_by_user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (emergency_access_id),
        KEY idx_emergency_active (is_active),
        KEY idx_emergency_activated_by (activated_by_user_id),
        KEY idx_emergency_expires_at (expires_at),
        CONSTRAINT fk_emergency_access_activated_by_user
          FOREIGN KEY (activated_by_user_id) REFERENCES users(user_id),
        CONSTRAINT fk_emergency_access_deactivated_by_user
          FOREIGN KEY (deactivated_by_user_id) REFERENCES users(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    schemaReady = true;
  }

  if (!fkReady) {
    try {
      await db.execute(
        `ALTER TABLE security_audit_logs
         ADD CONSTRAINT fk_security_audit_emergency_access
         FOREIGN KEY (emergency_access_id) REFERENCES emergency_access(emergency_access_id)`,
      );
    } catch {
      // Keep emergency columns even if legacy constraints block FK creation.
    }
    fkReady = true;
  }
}

export async function writeEmergencyAuditLog(
  db: DbConnection,
  params: {
    action: string;
    userId: number;
    emergencyAccessId: number | null;
    targetModule: "EmergencyAccess" | "Requests" | "Calendars";
    targetRecordId: string | number | null;
    ipAddress?: string | null;
    details?: unknown;
  },
): Promise<void> {
  await writeSecurityAuditLog(db, {
    action: params.action,
    userId: params.userId,
    emergencyAccessId: params.emergencyAccessId,
    accessMode: "emergency",
    targetModule: params.targetModule,
    targetRecordId: params.targetRecordId,
    ipAddress: params.ipAddress,
    details: params.details,
  });
}

export async function getActiveEmergencyAccessByUserId(
  db: DbConnection,
  userId: number,
): Promise<EmergencyAccessRow | null> {
  await ensureEmergencyAccessSchema(db);
  const [rows] = await db.execute<EmergencyAccessRow[]>(
    `SELECT *
     FROM emergency_access
     WHERE activated_by_user_id = ?
       AND activated_for_role = 'Principal'
       AND is_active = 1
     ORDER BY activated_at DESC, emergency_access_id DESC
     LIMIT 1`,
    [userId],
  );

  const row = rows[0] ?? null;
  if (!row) {
    return null;
  }

  const expired = await expireEmergencyAccessIfNeeded(db, row);
  return expired ? null : row;
}

export async function expireEmergencyAccessIfNeeded(
  db: DbConnection,
  row: EmergencyAccessRow,
  options: { ipAddress?: string | null } = {},
): Promise<boolean> {
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return false;
  }
  if (Date.now() < expiresAt.getTime()) {
    return false;
  }

  await db.execute<ResultSetHeader>(
    `UPDATE emergency_access
     SET is_active = 0,
         deactivated_at = NOW(),
         deactivated_by_user_id = activated_by_user_id
     WHERE emergency_access_id = ?
       AND is_active = 1`,
    [row.emergency_access_id],
  );

  await writeEmergencyAuditLog(db, {
    action: "EMERGENCY_ACCESS_EXPIRED",
    userId: Number(row.activated_by_user_id),
    emergencyAccessId: Number(row.emergency_access_id),
    targetModule: "EmergencyAccess",
    targetRecordId: Number(row.emergency_access_id),
    ipAddress: options.ipAddress ?? null,
    details: {
      performed_by_role: "IT Admin",
      performed_via: "Emergency Access",
      activated_for_role: TARGET_ROLE,
      scope_modules: Array.from(splitScope(String(row.scope_modules))),
      reason: row.reason,
      expires_at: row.expires_at,
    },
  });

  return true;
}

export async function hasActiveEmergencyAccess(
  db: DbConnection,
  userId: number,
  moduleName: EmergencyModuleName,
): Promise<{ active: boolean; session: EmergencyAccessRow | null }> {
  const session = await getActiveEmergencyAccessByUserId(db, userId);
  if (!session) {
    return { active: false, session: null };
  }
  if (String(session.activated_for_role) !== TARGET_ROLE) {
    return { active: false, session: null };
  }
  const scope = splitScope(String(session.scope_modules));
  if (!scope.has(moduleName)) {
    return { active: false, session: null };
  }
  return { active: true, session };
}

export async function activateEmergencyAccess(
  db: DbConnection,
  userId: number,
  reason: string,
  expiresAt?: string | null,
): Promise<{ created: boolean; session: EmergencyAccessRow }> {
  await ensureEmergencyAccessSchema(db);

  const existing = await getActiveEmergencyAccessByUserId(db, userId);
  if (existing) {
    return { created: false, session: existing };
  }

  const normalizedReason = reason.trim();
  const normalizedExpiresAt = normalizeDateTime(expiresAt ?? null);

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO emergency_access (
       activated_by_user_id,
       activated_for_role,
       reason,
       scope_modules,
       is_active,
       activated_at,
       expires_at
     ) VALUES (?, 'Principal', ?, 'Calendars,Requests', 1, NOW(), ?)`,
    [userId, normalizedReason, normalizedExpiresAt],
  );

  const [rows] = await db.execute<EmergencyAccessRow[]>(
    "SELECT * FROM emergency_access WHERE emergency_access_id = ? LIMIT 1",
    [result.insertId],
  );
  if (!rows[0]) {
    throw new Error("Failed to load created emergency access record.");
  }

  return { created: true, session: rows[0] };
}

export async function deactivateEmergencyAccess(
  db: DbConnection,
  userId: number,
  emergencyAccessId: number,
): Promise<boolean> {
  await ensureEmergencyAccessSchema(db);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE emergency_access
     SET
       is_active = 0,
       deactivated_at = NOW(),
       deactivated_by_user_id = ?
     WHERE emergency_access_id = ?
       AND activated_by_user_id = ?
       AND is_active = 1`,
    [userId, emergencyAccessId, userId],
  );

  return result.affectedRows > 0;
}

export async function canManagePrincipalRequests(
  db: DbConnection,
  currentUser: { userId: number; canonicalRole: string },
): Promise<{ allowed: boolean; emergencyAccessId: number | null }> {
  if (currentUser.canonicalRole === "principal") {
    return { allowed: true, emergencyAccessId: null };
  }
  if (currentUser.canonicalRole !== "it_admin") {
    return { allowed: false, emergencyAccessId: null };
  }
  const access = await hasActiveEmergencyAccess(db, currentUser.userId, "Requests");
  return {
    allowed: access.active,
    emergencyAccessId: access.session ? Number(access.session.emergency_access_id) : null,
  };
}

export async function canManagePrincipalCalendars(
  db: DbConnection,
  currentUser: { userId: number; canonicalRole: string },
): Promise<{ allowed: boolean; emergencyAccessId: number | null }> {
  if (currentUser.canonicalRole === "principal") {
    return { allowed: true, emergencyAccessId: null };
  }
  if (currentUser.canonicalRole !== "it_admin") {
    return { allowed: false, emergencyAccessId: null };
  }
  const access = await hasActiveEmergencyAccess(db, currentUser.userId, "Calendars");
  return {
    allowed: access.active,
    emergencyAccessId: access.session ? Number(access.session.emergency_access_id) : null,
  };
}

export function mapEmergencyAccessResponse(session: EmergencyAccessRow | null): {
  active: boolean;
  emergency_access_id: number | null;
  reason: string | null;
  activated_at: string | null;
  expires_at: string | null;
  scope_modules: string[];
} {
  if (!session) {
    return {
      active: false,
      emergency_access_id: null,
      reason: null,
      activated_at: null,
      expires_at: null,
      scope_modules: [],
    };
  }

  return {
    active: true,
    emergency_access_id: Number(session.emergency_access_id),
    reason: String(session.reason),
    activated_at: session.activated_at ? String(session.activated_at) : null,
    expires_at: session.expires_at ? String(session.expires_at) : null,
    scope_modules: Array.from(splitScope(String(session.scope_modules))),
  };
}

export function validateEmergencyReason(reason: unknown): string | null {
  const normalized = typeof reason === "string" ? reason.trim() : "";
  if (normalized.length < 10) {
    return null;
  }
  return normalized;
}
