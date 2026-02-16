import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";
import { ensureSuperAdminPhaseOneMigration } from "@/lib/server/super-admin-migration";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

interface AdminUserRow extends RowDataPacket {
  user_id: number;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  role?: string | null;
  role_id?: number | null;
  user_code?: string | null;
}

function canonicalizeRole(role: string | null): string {
  const normalized = normalizeRoleName(role);
  return resolveCanonicalRole(normalized) || normalized;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = await runWithConnection(async (connection) => {
      await ensureSuperAdminPhaseOneMigration(connection);

      const [rows] = await connection.execute<AdminUserRow[]>(
        "SELECT user_id, email, first_name, middle_name, last_name, role_id, user_code FROM users WHERE user_id = ? LIMIT 1",
        [auth.userId],
      );

      const user = rows[0];
      if (!user) {
        return null;
      }

      const resolvedRole = await resolveUserRole(connection, user);
      const roleForLogic = resolvedRole ?? null;

      return {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
        role: canonicalizeRole(roleForLogic),
      };
    });

    if (!payload) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: payload,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Admin session lookup failed", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
