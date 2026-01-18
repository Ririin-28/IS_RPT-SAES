import crypto from "crypto";
import { cookies } from "next/headers";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

const COOKIE_NAME = "rpt_teacher_session";
const SESSION_DURATION_HOURS = 24;
const SESSION_TABLE = "teacher_sessions";

export type TeacherSession = {
  sessionId: number;
  teacherId: string | null;
  userId: number;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createTeacherSession(
  db: PoolConnection,
  teacherId: string | null,
  userId: number,
  deviceName?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = sha256(token);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  await db.execute(
    `
    INSERT INTO ${SESSION_TABLE}
      (teacher_id, user_id, token_hash, user_agent, created_at, last_active_at, expires_at)
    VALUES (?, ?, ?, ?, NOW(), NOW(), ?)
    `,
    [teacherId, userId, tokenHash, deviceName ?? null, expiresAt],
  );

  return { token, expiresAt };
}

export function buildTeacherSessionCookie(token: string, expiresAt: Date): string {
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

export async function getTeacherSessionFromCookies(): Promise<TeacherSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!rawToken) return null;

  const tokenHash = sha256(rawToken);
  const { query } = await import("@/lib/db");

  const [rows] = await query<RowDataPacket[]>(
    `
    SELECT
      session_id,
      teacher_id,
      user_id,
      expires_at,
      revoked_at
    FROM ${SESSION_TABLE}
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash],
  );

  if (!rows.length) return null;

  const session = rows[0];

  await query(
    `UPDATE ${SESSION_TABLE} SET last_active_at = NOW() WHERE session_id = ?`,
    [session.session_id],
  );

  return {
    sessionId: session.session_id,
    teacherId: session.teacher_id ? String(session.teacher_id) : null,
    userId: session.user_id,
  };
}

export async function revokeTeacherSession(sessionId: number): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(`UPDATE ${SESSION_TABLE} SET revoked_at = NOW() WHERE session_id = ?`, [sessionId]);
}
