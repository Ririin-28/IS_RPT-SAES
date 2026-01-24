import { type RowDataPacket } from "mysql2/promise";
import { recordAccountLogin } from "@/lib/server/account-logs";
import { buildParentSessionCookie, createParentSession } from "@/lib/server/parent-session";
import { buildAdminSessionCookie, createAdminSession } from "@/lib/server/admin-session";
import { buildPrincipalSessionCookie, createPrincipalSession } from "@/lib/server/principal-session";
import { buildMasterTeacherSessionCookie, createMasterTeacherSession } from "@/lib/server/master-teacher-session";
import { buildTeacherSessionCookie, createTeacherSession } from "@/lib/server/teacher-session";
import { getTableColumns, runWithConnection } from "@/lib/db";
import { normalizeRoleName, resolveCanonicalRole, resolvePortalPath, resolveUserRole } from "@/lib/server/role-resolution";

/* =======================
   Types
======================= */

interface LoginRequestPayload {
  email: string;
  password: string;
  userId?: string | number | null;
  itAdminId?: string | null;
  deviceToken?: string | null;
  deviceName?: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  password: string;
  role: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

/* =======================
   Helpers
======================= */

function roleRequiresItAdminId(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = normalizeRoleName(role);
  return normalized === "it_admin" || normalized === "admin" || normalized === "itadmin";
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeItAdminId(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const MASTER_TEACHER_TABLES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_tbl",
] as const;

const MASTER_TEACHER_ID_COLUMNS = [
  "master_teacher_id",
  "masterteacher_id",
  "mt_id",
  "teacher_id",
  "coordinator_id",
] as const;

const TEACHER_TABLES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_profile",
  "teacher_profiles",
  "faculty",
  "faculty_info",
  "faculty_profiles",
  "remedial_teachers",
] as const;

const TEACHER_ID_COLUMNS = [
  "teacher_id",
  "employee_id",
  "user_code",
  "id",
  "user_id",
] as const;

async function resolveMasterTeacherId(db: import("mysql2/promise").PoolConnection, userId: number): Promise<string | null> {
  for (const table of MASTER_TEACHER_TABLES) {
    let columns: Set<string>;
    try {
      columns = await getTableColumns(table);
    } catch {
      continue;
    }

    if (!columns.size || !columns.has("user_id")) {
      continue;
    }

    const idColumn = MASTER_TEACHER_ID_COLUMNS.find((col) => columns.has(col)) ?? null;
    const selectCol = idColumn ?? "user_id";

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT ${selectCol} AS master_teacher_id FROM ${table} WHERE user_id = ? LIMIT 1`,
        [userId],
      );

      const candidate = rows[0]?.master_teacher_id;
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        return String(candidate).trim();
      }
    } catch {
      continue;
    }
  }

  return String(userId);
}

async function resolveTeacherId(db: import("mysql2/promise").PoolConnection, userId: number): Promise<string | null> {
  for (const table of TEACHER_TABLES) {
    let columns: Set<string>;
    try {
      columns = await getTableColumns(table);
    } catch {
      continue;
    }

    if (!columns.size || !columns.has("user_id")) {
      continue;
    }

    const idColumn = TEACHER_ID_COLUMNS.find((col) => columns.has(col)) ?? null;
    const selectCol = idColumn ?? "user_id";

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT ${selectCol} AS teacher_id FROM ${table} WHERE user_id = ? LIMIT 1`,
        [userId],
      );

      const candidate = rows[0]?.teacher_id;
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        return String(candidate).trim();
      }
    } catch {
      continue;
    }
  }

  return String(userId);
}

/* =======================
   Route
======================= */

export async function POST(req: Request): Promise<Response> {
  try {
    return await runWithConnection(async (db) => {
      const respond = (
        status: number,
        payload: Record<string, unknown>,
        extraHeaders?: Record<string, string | string[]>,
      ): Response => {
        const headers = new Headers({
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });

        if (extraHeaders) {
          for (const [key, value] of Object.entries(extraHeaders)) {
            if (Array.isArray(value)) {
              value.forEach((v) => headers.append(key, v));
            } else {
              headers.append(key, value);
            }
          }
        }

        return new Response(JSON.stringify(payload), { status, headers });
      };

      try {
        const { email, password, userId, itAdminId, deviceToken, deviceName } =
          (await req.json()) as LoginRequestPayload;

        /* ===== Fetch user ===== */
        const [users] = await db.execute<UserRow[]>(
          "SELECT * FROM users WHERE email = ? LIMIT 1",
          [email],
        );
        const user = users[0];
        if (!user) return respond(401, { error: "Invalid credentials" });

        if (password !== user.password) {
          return respond(401, { error: "Invalid credentials" });
        }

        /* ===== Validate optional userId ===== */
        if (userId !== undefined && userId !== null && String(userId).trim()) {
          const normalizedUserId = toNumber(userId);
          if (normalizedUserId === null || normalizedUserId !== user.user_id) {
            return respond(401, { error: "Invalid credentials" });
          }
        }

        /* ===== Resolve role ===== */
        const resolvedRole = await resolveUserRole(db, user);
        const roleForLogic = resolvedRole ?? user.role ?? null;
        const normalizedRole = normalizeRoleName(roleForLogic);
        const canonicalRole = resolveCanonicalRole(normalizedRole);
        const redirectPath = resolvePortalPath(canonicalRole);

        /* ===== IT Admin validation ===== */
        if (roleRequiresItAdminId(roleForLogic)) {
          const normalizedItAdminId = sanitizeItAdminId(itAdminId);
          if (!normalizedItAdminId) {
            return respond(401, {
              error: "Admin login requires IT Admin ID",
              requireItAdminId: true,
            });
          }

          const [itAdmins] = await db.execute<RowDataPacket[]>(
            "SELECT user_id FROM it_admin WHERE it_admin_id = ? LIMIT 1",
            [normalizedItAdminId],
          );

          if (Number(itAdmins[0]?.user_id) !== user.user_id) {
            return respond(401, { error: "Invalid credentials" });
          }
        }

        /* ===== Trusted device check ===== */
        let trusted = false;

        if (deviceToken) {
          const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_token = ? LIMIT 1",
            [user.user_id, deviceToken],
          );
          trusted = rows.length > 0;
        }

        if (!trusted && deviceName) {
          const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_name = ? LIMIT 1",
            [user.user_id, deviceName],
          );
          trusted = rows.length > 0;
        }

        if (!trusted) {
          return respond(200, {
            success: true,
            otpRequired: true,
            role: roleForLogic,
            redirectPath,
            user_id: user.user_id,
          });
        }

        /* ===== Create sessions ===== */
        const cookies: string[] = [];

        if (canonicalRole === "parent") {
          const { token, expiresAt } = await createParentSession(db, user.user_id, deviceName);
          cookies.push(buildParentSessionCookie(token, expiresAt));
        }

        if (canonicalRole === "admin" || canonicalRole === "it_admin" || canonicalRole === "itadmin") {
          const { token, expiresAt } = await createAdminSession(db, user.user_id, deviceName);
          cookies.push(buildAdminSessionCookie(token, expiresAt));
        }

        /* ===== PRINCIPAL SESSION (NEW) ===== */
        if (canonicalRole === "principal") {
          const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT principal_id FROM principal WHERE user_id = ? LIMIT 1",
            [user.user_id],
          );

          const principalId = rows[0]?.principal_id;
          if (!principalId) {
            return respond(403, { error: "Principal record not found" });
          }

          const { token, expiresAt } = await createPrincipalSession(
            db,
            principalId,
            user.user_id,
            deviceName,
          );

          cookies.push(buildPrincipalSessionCookie(token, expiresAt));
        }

        /* ===== MASTER TEACHER SESSION ===== */
        if (canonicalRole === "master_teacher" || canonicalRole === "masterteacher") {
          const masterTeacherId = await resolveMasterTeacherId(db, user.user_id);
          if (!masterTeacherId) {
            return respond(403, { error: "Master teacher record not found" });
          }

          const { token, expiresAt } = await createMasterTeacherSession(
            db,
            masterTeacherId,
            user.user_id,
            deviceName,
          );

          cookies.push(buildMasterTeacherSessionCookie(token, expiresAt));
        }

        /* ===== TEACHER SESSION ===== */
        if (canonicalRole === "teacher") {
          const teacherId = await resolveTeacherId(db, user.user_id);
          if (!teacherId) {
            return respond(403, { error: "Teacher record not found" });
          }

          const { token, expiresAt } = await createTeacherSession(
            db,
            teacherId,
            user.user_id,
            deviceName,
          );

          cookies.push(buildTeacherSessionCookie(token, expiresAt));
        }

        await recordAccountLogin(db, user.user_id, roleForLogic);

        return respond(
          200,
          {
            success: true,
            skipOtp: true,
            role: roleForLogic,
            redirectPath,
            user_id: user.user_id,
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            email: user.email,
          },
          cookies.length ? { "Set-Cookie": cookies } : undefined,
        );
      } catch (error) {
        console.error("Login request failed", error);
        return respond(500, { error: "Server error" });
      }
    });
  } catch (error) {
    console.error("Login connection failed", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
