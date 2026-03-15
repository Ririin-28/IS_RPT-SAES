import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { randomBytes } from "crypto";
import { recordAccountLogin } from "@/lib/server/account-logs";
import { buildParentSessionCookie, createParentSession } from "@/lib/server/parent-session";
import { buildAdminSessionCookie, createAdminSession } from "@/lib/server/admin-session";
import { buildPrincipalSessionCookie, createPrincipalSession } from "@/lib/server/principal-session";
import { buildMasterTeacherSessionCookie, createMasterTeacherSession } from "@/lib/server/master-teacher-session";
import { buildTeacherSessionCookie, createTeacherSession } from "@/lib/server/teacher-session";
import { resolveMasterTeacherId, resolvePrincipalId, resolveTeacherId } from "@/lib/server/role-record-ids";
import { normalizeRoleName, resolveCanonicalRole, resolvePortalPath, resolveUserRole } from "@/lib/server/role-resolution";
import { ensureItAdminPhaseOneMigration } from "@/lib/server/it-admin-migration";

interface VerifyOtpPayload {
  email: string;
  otp: string;
  deviceName?: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  otp_code: string | null;
  otp_expires_at: Date | string | null;
  role: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
}

export async function POST(req: Request): Promise<Response> {
  let db: Connection | null = null;

  const respond = async (
    status: number,
    payload: Record<string, unknown>,
    extraHeaders?: Record<string, string | string[]>,
  ): Promise<Response> => {
    if (db) {
      await db.end();
      db = null;
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });

    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (Array.isArray(value)) {
          value.forEach((headerValue) => headers.append(key, headerValue));
        } else {
          headers.append(key, value);
        }
      }
    }

    return new Response(JSON.stringify(payload), {
      status,
      headers,
    });
  };

  try {
    const { email, otp, deviceName } = (await req.json()) as VerifyOtpPayload;

    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    });
    await ensureItAdminPhaseOneMigration(db);

    const [users] = await db.execute<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];

    if (!user) {
      return respond(400, { error: "User not found" });
    }

    if (!user.otp_code || user.otp_code !== otp) {
      return respond(400, { error: "Invalid OTP" });
    }

    const expiry = user.otp_expires_at ? new Date(user.otp_expires_at) : null;
    if (!expiry || Number.isNaN(expiry.getTime()) || Date.now() > expiry.getTime()) {
      return respond(400, { error: "OTP expired" });
    }

    await db.execute<ResultSetHeader>(
      "UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?",
      [user.user_id]
    );

    const deviceToken = randomBytes(32).toString("hex");
    const computedDeviceName = deviceName && deviceName.trim().length > 0 ? deviceName : "Unnamed Device";

    await db.execute<ResultSetHeader>(
      "INSERT INTO trusted_devices (user_id, device_token, device_name) VALUES (?, ?, ?)",
      [user.user_id, deviceToken, computedDeviceName]
    );

    await db.execute<ResultSetHeader>(
      "UPDATE trusted_devices SET last_used = NOW() WHERE user_id = ? AND device_token = ?",
      [user.user_id, deviceToken]
    );

    const resolvedRole = await resolveUserRole(db, user);
    const roleForLogic = resolvedRole ?? user.role ?? null;
    const normalizedRole = normalizeRoleName(roleForLogic);
    const canonicalRole = resolveCanonicalRole(normalizedRole);
    const responseRole = canonicalRole || normalizedRole || roleForLogic;
    const redirectPath = resolvePortalPath(canonicalRole || normalizedRole);
    const responseCookies: string[] = [];

    if (normalizedRole === "parent") {
      const { token, expiresAt } = await createParentSession(db, user.user_id, deviceName ?? null);
      responseCookies.push(buildParentSessionCookie(token, expiresAt));
    }

    if (canonicalRole === "it_admin") {
      const { token, expiresAt } = await createAdminSession(db, user.user_id, deviceName ?? null);
      responseCookies.push(buildAdminSessionCookie(token, expiresAt));
    }

    if (canonicalRole === "principal") {
      const principalId = await resolvePrincipalId(db, user.user_id);
      if (!principalId) {
        return respond(403, { error: "Principal record not found" });
      }

      const { token, expiresAt } = await createPrincipalSession(
        db,
        principalId,
        user.user_id,
        deviceName ?? null,
      );
      responseCookies.push(buildPrincipalSessionCookie(token, expiresAt));
    }

    if (canonicalRole === "master_teacher" || canonicalRole === "masterteacher") {
      const masterTeacherId = await resolveMasterTeacherId(db, user.user_id);
      if (!masterTeacherId) {
        return respond(403, { error: "Master teacher record not found" });
      }

      const { token, expiresAt } = await createMasterTeacherSession(
        db,
        masterTeacherId,
        user.user_id,
        deviceName ?? null,
      );
      responseCookies.push(buildMasterTeacherSessionCookie(token, expiresAt));
    }

    if (canonicalRole === "teacher") {
      const teacherId = await resolveTeacherId(db, user.user_id);
      if (!teacherId) {
        return respond(403, { error: "Teacher record not found" });
      }

      const { token, expiresAt } = await createTeacherSession(
        db,
        teacherId,
        user.user_id,
        deviceName ?? null,
      );
      responseCookies.push(buildTeacherSessionCookie(token, expiresAt));
    }

    await recordAccountLogin(db, user.user_id, responseRole);

    return respond(
      200,
      {
        success: true,
        deviceToken,
        role: responseRole,
        redirectPath,
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name ?? null,
        middle_name: user.middle_name ?? null,
        last_name: user.last_name ?? null,
        profileImageUrl: user.profile_image_url ?? null,
      },
      responseCookies.length > 0 ? { "Set-Cookie": responseCookies } : undefined,
    );
  } catch (error) {
    console.error("OTP verification failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
