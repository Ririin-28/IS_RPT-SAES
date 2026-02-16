import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE_NAME,
  extractAdminSessionToken,
  validateAdminSession,
} from "@/lib/server/admin-session";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";
import { ensureSuperAdminPhaseOneMigration } from "@/lib/server/super-admin-migration";

export type SuperAdminAuthResult =
  | { ok: true; userId: number; role: string | null; canonicalRole: string }
  | { ok: false; response: Response };

export type SuperAdminPermission =
  | "super_admin:accounts.manage"
  | "super_admin:data.archive"
  | "super_admin:data.restore"
  | "super_admin:data.delete"
  | "super_admin:dashboard.view"
  | "super_admin:logs.view"
  | "super_admin:profile.manage"
  | "super_admin:content.manage"
  | "super_admin:maintenance.execute";

const SUPER_ADMIN_PERMISSION_SET: Set<SuperAdminPermission> = new Set([
  "super_admin:accounts.manage",
  "super_admin:data.archive",
  "super_admin:data.restore",
  "super_admin:data.delete",
  "super_admin:dashboard.view",
  "super_admin:logs.view",
  "super_admin:profile.manage",
  "super_admin:content.manage",
  "super_admin:maintenance.execute",
]);

function hasPermission(canonicalRole: string, permission?: SuperAdminPermission): boolean {
  if (canonicalRole !== "super_admin") {
    return false;
  }
  if (!permission) {
    return true;
  }
  return SUPER_ADMIN_PERMISSION_SET.has(permission);
}

export async function requireSuperAdmin(
  request: Request,
  options: { permission?: SuperAdminPermission } = {},
): Promise<SuperAdminAuthResult> {
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
      await ensureSuperAdminPhaseOneMigration(connection);

      const session = await validateAdminSession(connection, sessionToken);
      if (!session) {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Session expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as SuperAdminAuthResult;
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
        } as SuperAdminAuthResult;
      }

      const resolvedRole = await resolveUserRole(connection, user);
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
        } as SuperAdminAuthResult;
      }

      return {
        ok: true,
        userId: Number(user.user_id),
        role: roleForLogic,
        canonicalRole,
      } as SuperAdminAuthResult;
    });
  } catch (error) {
    console.error("Super admin authorization failed", error);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
