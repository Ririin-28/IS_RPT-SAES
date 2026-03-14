import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE_NAME,
  extractAdminSessionToken,
  validateAdminSession,
} from "@/lib/server/admin-session";
import {
  type ItAdminPermission,
  type ItAdminPermissionRequest,
  IT_ADMIN_PERMISSION_SET,
  normalizeRequestedItAdminPermission,
} from "@/lib/server/it-admin-permissions";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";
import { ensureItAdminPhaseOneMigration } from "@/lib/server/it-admin-migration";

export type ItAdminAuthResult =
  | { ok: true; userId: number; role: string | null; canonicalRole: string }
  | { ok: false; response: Response };

export type { ItAdminPermission, ItAdminPermissionRequest } from "@/lib/server/it-admin-permissions";
export { normalizeRequestedItAdminPermission } from "@/lib/server/it-admin-permissions";

function hasPermission(canonicalRole: string, permission?: ItAdminPermissionRequest): boolean {
  if (canonicalRole !== "it_admin") {
    return false;
  }
  const normalizedPermission = normalizeRequestedItAdminPermission(permission);
  if (!normalizedPermission) {
    return true;
  }
  return IT_ADMIN_PERMISSION_SET.has(normalizedPermission);
}

export async function requireItAdmin(
  request: Request,
  options: { permission?: ItAdminPermissionRequest } = {},
): Promise<ItAdminAuthResult> {
  const cookieHeader = request.headers.get("cookie");
  let sessionToken = extractAdminSessionToken(cookieHeader);
  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      sessionToken = null;
    }
  }
  if (!sessionToken) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }

  try {
    return await runWithConnection(async (connection) => {
      await ensureItAdminPhaseOneMigration(connection);

      const session = await validateAdminSession(connection, sessionToken);
      if (!session) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Session expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as ItAdminAuthResult;
      }

      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id, role_id, user_code FROM users WHERE user_id = ? LIMIT 1",
        [session.userId],
      );
      const user = rows[0];
      if (!user) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Account not found" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as ItAdminAuthResult;
      }

      const resolvedRole = await resolveUserRole(connection, user as any);
      const roleForLogic = resolvedRole ?? null;
      const normalizedRole = normalizeRoleName(roleForLogic);
      const canonicalRole = resolveCanonicalRole(normalizedRole);

      if (!hasPermission(canonicalRole, options.permission)) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as ItAdminAuthResult;
      }

      return {
        ok: true,
        userId: Number(user.user_id),
        role: roleForLogic,
        canonicalRole,
      } as ItAdminAuthResult;
    });
  } catch (error) {
    console.error("IT admin authorization failed", error);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
