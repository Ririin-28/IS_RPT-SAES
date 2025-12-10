import { createHash, randomBytes } from "crypto";
import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";

const SESSION_COOKIE_NAME = "rpt_admin_session";
const DEFAULT_TTL_SECONDS = 4 * 60 * 60;

let schemaPrepared = false;

function resolveTtlSeconds(): number {
  const raw = process.env.ADMIN_SESSION_TTL;
  if (!raw) {
    return DEFAULT_TTL_SECONDS;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 600 && parsed <= 60 * 60 * 24 * 7) {
    return Math.floor(parsed);
  }
  return DEFAULT_TTL_SECONDS;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeUserAgent(agent?: string | null): string | null {
  if (!agent) {
    return null;
  }
  const trimmed = agent.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 255);
}

async function ensureAdminSessionSchema(db: Connection | PoolConnection): Promise<void> {
  if (schemaPrepared) {
    return;
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      user_agent VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME DEFAULT NULL,
      INDEX idx_admin_sessions_user_id (user_id),
      INDEX idx_admin_sessions_token_hash (token_hash),
      INDEX idx_admin_sessions_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  schemaPrepared = true;
}

export type AdminSessionRecord = {
  sessionId: number;
  userId: number;
  expiresAt: Date;
};

export function buildAdminSessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const directives = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("Secure");
  }
  return directives.join("; ");
}

export function buildClearedAdminSessionCookie(): string {
  const directives = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    `Expires=${new Date(0).toUTCString()}`,
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("Secure");
  }
  return directives.join("; ");
}

export function extractAdminSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader || cookieHeader.trim().length === 0) {
    return null;
  }
  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    if (!trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      continue;
    }
    return trimmed.slice(SESSION_COOKIE_NAME.length + 1);
  }
  return null;
}

export async function createAdminSession(
  db: Connection | PoolConnection,
  userId: number,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  await ensureAdminSessionSchema(db);
  const token = randomBytes(48).toString("hex");
  const tokenHash = sha256(token);
  const ttlSeconds = resolveTtlSeconds();

  await db.execute(
    "UPDATE admin_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
    [userId],
  );

  await db.execute(
    `INSERT INTO admin_sessions (user_id, token_hash, user_agent, created_at, last_active_at, expires_at)
     VALUES (?, ?, ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [userId, tokenHash, sanitizeUserAgent(userAgent), ttlSeconds],
  );

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  return { token, expiresAt };
}

interface AdminSessionRow extends RowDataPacket {
  session_id: number;
  user_id: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export async function validateAdminSession(
  db: Connection | PoolConnection,
  token: string,
): Promise<AdminSessionRecord | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }
  await ensureAdminSessionSchema(db);
  const tokenHash = sha256(token);

  const [rows] = await db.execute<AdminSessionRow[]>(
    `SELECT session_id, user_id, expires_at, revoked_at FROM admin_sessions WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );

  const record = rows[0];
  if (!record || record.revoked_at) {
    return null;
  }

  const expiresAt = new Date(record.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await db.execute(
      "UPDATE admin_sessions SET revoked_at = NOW() WHERE session_id = ?",
      [record.session_id],
    );
    return null;
  }

  await db.execute(
    "UPDATE admin_sessions SET last_active_at = NOW() WHERE session_id = ?",
    [record.session_id],
  );

  return {
    sessionId: Number(record.session_id),
    userId: Number(record.user_id),
    expiresAt,
  };
}

export async function revokeAdminSession(
  db: Connection | PoolConnection,
  token: string,
): Promise<number | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }
  await ensureAdminSessionSchema(db);
  const tokenHash = sha256(token);

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT session_id, user_id FROM admin_sessions WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  const record = rows[0];
  if (!record) {
    return null;
  }

  await db.execute(
    "UPDATE admin_sessions SET revoked_at = NOW() WHERE session_id = ?",
    [record.session_id],
  );

  return Number(record.user_id);
}

export async function getAdminSessionFromCookies(): Promise<AdminSessionRecord | null> {
  const cookieStore = cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return null;
  }

  return runWithConnection((connection) => validateAdminSession(connection, cookie.value));
}
