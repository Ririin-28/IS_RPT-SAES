import { createHash, randomBytes } from "crypto";
import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

const SESSION_COOKIE_NAME = "rpt_parent_session";
const SESSION_DURATION_HOURS = 24;

let schemaPrepared = false;

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

async function ensureParentSessionSchema(db: Connection | PoolConnection): Promise<void> {
  if (schemaPrepared) {
    return;
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS parent_sessions (
      session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      user_agent VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME DEFAULT NULL,
      INDEX idx_parent_sessions_user_id (user_id),
      INDEX idx_parent_sessions_token_hash (token_hash),
      INDEX idx_parent_sessions_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  schemaPrepared = true;
}

export type ParentSessionRecord = {
  sessionId: number;
  userId: number;
  expiresAt: Date;
};

export function buildParentSessionCookie(token: string, expiresAt: Date): string {
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

export function buildClearedParentSessionCookie(): string {
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

export function extractParentSessionToken(cookieHeader: string | null | undefined): string | null {
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

export async function createParentSession(
  db: Connection | PoolConnection,
  userId: number,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  await ensureParentSessionSchema(db);
  const token = randomBytes(48).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  await db.execute(
    `INSERT INTO parent_sessions (user_id, token_hash, user_agent, created_at, last_active_at, expires_at)
     VALUES (?, ?, ?, NOW(), NOW(), ?)`,
    [userId, tokenHash, sanitizeUserAgent(userAgent), expiresAt],
  );

  return { token, expiresAt };
}

interface ParentSessionRow extends RowDataPacket {
  session_id: number;
  user_id: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export async function validateParentSession(
  db: Connection | PoolConnection,
  token: string,
): Promise<ParentSessionRecord | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }
  await ensureParentSessionSchema(db);
  const tokenHash = sha256(token);

  const [rows] = await db.execute<ParentSessionRow[]>(
    `SELECT session_id, user_id, expires_at, revoked_at FROM parent_sessions WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );

  const record = rows[0];
  if (!record || record.revoked_at) {
    return null;
  }

  const expiresAt = new Date(record.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await db.execute(
    "UPDATE parent_sessions SET last_active_at = NOW() WHERE session_id = ?",
    [record.session_id],
  );

  return {
    sessionId: Number(record.session_id),
    userId: Number(record.user_id),
    expiresAt,
  };
}

export async function revokeParentSession(
  db: Connection | PoolConnection,
  token: string,
): Promise<number | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }
  await ensureParentSessionSchema(db);
  const tokenHash = sha256(token);

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT session_id, user_id FROM parent_sessions WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  const record = rows[0];
  if (!record) {
    return null;
  }

  await db.execute(
    "UPDATE parent_sessions SET revoked_at = NOW() WHERE session_id = ?",
    [record.session_id],
  );

  return Number(record.user_id);
}

export async function getParentSessionFromCookies(): Promise<ParentSessionRecord | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return null;
  }

  const tokenHash = sha256(cookie.value);
  const [rows] = await query<ParentSessionRow[]>(
    `
    SELECT session_id, user_id, expires_at, revoked_at
    FROM parent_sessions
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash],
  );

  if (!rows.length) {
    return null;
  }

  const record = rows[0];
  await query(
    "UPDATE parent_sessions SET last_active_at = NOW() WHERE session_id = ?",
    [record.session_id],
  );

  return {
    sessionId: Number(record.session_id),
    userId: Number(record.user_id),
    expiresAt: new Date(record.expires_at),
  };
}
