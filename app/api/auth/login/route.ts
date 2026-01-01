import { type RowDataPacket } from "mysql2/promise";
import { recordAccountLogin } from "@/lib/server/account-logs";
import { buildParentSessionCookie, createParentSession } from "@/lib/server/parent-session";
import { buildAdminSessionCookie, createAdminSession } from "@/lib/server/admin-session";
import { runWithConnection } from "@/lib/db";
import { normalizeRoleName, resolvePortalPath, resolveUserRole } from "@/lib/server/role-resolution";

interface LoginRequestPayload {
  email: string;
  password: string;
  userId?: string | number | null;
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

function roleRequiresUserId(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = normalizeRoleName(role);
  return normalized === "it_admin" || normalized === "admin" || normalized === "itadmin";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
        const { email, password, userId, deviceToken, deviceName } = (await req.json()) as LoginRequestPayload;

        const [users] = await db.execute<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
        const user = users[0];

        if (!user) {
          return respond(401, { error: "Invalid credentials" });
        }

        let normalizedUserId: number | null = null;
        if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
          normalizedUserId = toNumber(userId);
          if (normalizedUserId === null) {
            return respond(401, { error: "Invalid credentials" });
          }

          if (Number(user.user_id) !== normalizedUserId) {
            return respond(401, { error: "Invalid credentials" });
          }
        }

        const resolvedRole = await resolveUserRole(db, user);
        const roleForLogic = resolvedRole ?? user.role ?? null;
        const normalizedRole = normalizeRoleName(roleForLogic);
        const redirectPath = resolvePortalPath(normalizedRole);

        if (roleRequiresUserId(roleForLogic) && normalizedUserId === null) {
          return respond(401, {
            error: "Admin login requires user ID",
            errorCode: "ADMIN_USER_ID_REQUIRED",
            requireUserId: true,
          });
        }

        if (password !== user.password) {
          return respond(401, { error: "Invalid credentials" });
        }

        let trusted = false;

        if (deviceToken) {
          const [devices] = await db.execute<RowDataPacket[]>(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_token = ? LIMIT 1",
            [user.user_id, deviceToken],
          );
          if (devices.length > 0) {
            trusted = true;
          }
        }

        if (!trusted && deviceName) {
          const [devicesByName] = await db.execute<RowDataPacket[]>(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_name = ? LIMIT 1",
            [user.user_id, deviceName],
          );
          if (devicesByName.length > 0) {
            trusted = true;
          }
        }

        if (trusted) {
          const responseCookies: string[] = [];

          if (normalizedRole === "parent") {
            const { token, expiresAt } = await createParentSession(db, user.user_id, deviceName ?? null);
            responseCookies.push(buildParentSessionCookie(token, expiresAt));
          }

          if (normalizedRole === "admin" || normalizedRole === "it_admin" || normalizedRole === "itadmin") {
            const { token, expiresAt } = await createAdminSession(db, user.user_id, deviceName ?? null);
            responseCookies.push(buildAdminSessionCookie(token, expiresAt));
          }

          await db.execute("UPDATE trusted_devices SET last_used = NOW() WHERE user_id = ?", [user.user_id]);
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
            responseCookies.length > 0 ? { "Set-Cookie": responseCookies } : undefined,
          );
        }

        return respond(200, {
          success: true,
          otpRequired: true,
          role: roleForLogic,
          redirectPath,
          user_id: user.user_id,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          email: user.email,
        });
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
