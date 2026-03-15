import crypto from "crypto";
import { cookies } from "next/headers";
import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";

/* ======================
   Config
====================== */

const COOKIE_NAME = "principal_session";
const SESSION_DURATION_HOURS = 24;

/* ======================
   Types
====================== */

export type PrincipalSession = {
  sessionId: number;
  principalId: string;
  userId: number;
};

/* ======================
   Helpers
====================== */

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/* ======================
   Create Session
====================== */

export async function createPrincipalSession(
  db: PoolConnection | Connection,
  principalId: string,
  userId: number,
  deviceName?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = sha256(token);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  await db.execute(
    `
    INSERT INTO principal_sessions
      (principal_id, user_id, token_hash, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    [principalId, userId, tokenHash, deviceName ?? null, expiresAt],
  );

  return { token, expiresAt };
}

/* ======================
   Cookie Builder
====================== */

export function buildPrincipalSessionCookie(token: string, expiresAt: Date): string {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/* ======================
   Read Session (Auth)
====================== */

export async function getPrincipalSessionFromCookies(): Promise<PrincipalSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!rawToken) return null;

  const tokenHash = sha256(rawToken);

  const { query } = await import("@/lib/db");

  const [rows] = await query<RowDataPacket[]>(
    `
    SELECT
      session_id,
      principal_id,
      user_id,
      expires_at,
      revoked_at
    FROM principal_sessions
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash],
  );

  if (!rows.length) return null;

  const session = rows[0];

  // update activity
  await query(
    `UPDATE principal_sessions SET last_active_at = NOW() WHERE session_id = ?`,
    [session.session_id],
  );

  return {
    sessionId: session.session_id,
    principalId: session.principal_id,
    userId: session.user_id,
  };
}

/* ======================
   Logout / Revoke
====================== */

export async function revokePrincipalSession(sessionId: number): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(
    `UPDATE principal_sessions SET revoked_at = NOW() WHERE session_id = ?`,
    [sessionId],
  );
}
