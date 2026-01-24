import crypto from "crypto";
import { cookies } from "next/headers";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

const COOKIE_NAME = "mt_session";
const SESSION_DURATION_HOURS = 24;
const SESSION_TABLE = "mt_sessions";

export type MasterTeacherRoleContext = "coordinator" | "remedial" | null;

export type MasterTeacherSession = {
  sessionId: number;
  masterTeacherId: string;
  userId: number;
  roleContext: MasterTeacherRoleContext;
  coordinatorRoleId: string | null;
  remedialRoleId: string | null;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createMasterTeacherSession(
  db: PoolConnection,
  masterTeacherId: string,
  userId: number,
  deviceName?: string | null,
  roleContext: MasterTeacherRoleContext = "coordinator",
  coordinatorRoleId: string | null = null,
  remedialRoleId: string | null = null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = sha256(token);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  const storedRoleContext: MasterTeacherRoleContext = roleContext ?? "coordinator";

  await db.execute(
    `
    INSERT INTO ${SESSION_TABLE}
      (master_teacher_id, role_context, user_id, token_hash, user_agent, created_at, last_active_at, expires_at, coordinator_role_id, remedial_role_id)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
    `,
    [masterTeacherId, storedRoleContext, userId, tokenHash, deviceName ?? null, expiresAt, coordinatorRoleId, remedialRoleId],
  );

  return { token, expiresAt };
}

export function buildMasterTeacherSessionCookie(token: string, expiresAt: Date): string {
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

export async function getMasterTeacherSessionFromCookies(): Promise<MasterTeacherSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!rawToken) return null;

  const tokenHash = sha256(rawToken);
  const { query } = await import("@/lib/db");

  const [rows] = await query<RowDataPacket[]>(
    `
    SELECT
      session_id,
      master_teacher_id,
      role_context,
      coordinator_role_id,
      remedial_role_id,
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
    masterTeacherId: String(session.master_teacher_id),
    userId: session.user_id,
    roleContext: (session.role_context as MasterTeacherRoleContext) ?? null,
    coordinatorRoleId: session.coordinator_role_id ? String(session.coordinator_role_id) : null,
    remedialRoleId: session.remedial_role_id ? String(session.remedial_role_id) : null,
  };
}

export async function updateMasterTeacherSessionRole(
  sessionId: number,
  roleContext: MasterTeacherRoleContext,
  coordinatorRoleId: string | null,
  remedialRoleId: string | null,
): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(
    `UPDATE ${SESSION_TABLE}
     SET role_context = ?, coordinator_role_id = ?, remedial_role_id = ?, last_active_at = NOW()
     WHERE session_id = ?`,
    [roleContext, coordinatorRoleId, remedialRoleId, sessionId],
  );
}

export async function revokeMasterTeacherSession(sessionId: number): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(`UPDATE ${SESSION_TABLE} SET revoked_at = NOW() WHERE session_id = ?`, [sessionId]);
}
