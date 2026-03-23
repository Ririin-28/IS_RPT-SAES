import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";
import {
  PRINCIPAL_SESSION_COOKIE_NAME,
  extractPrincipalSessionToken,
  getPrincipalSessionFromCookies,
} from "@/lib/server/principal-session";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";

export type PrincipalAuthResult =
  | { ok: true; userId: number; principalId: string; role: string | null; canonicalRole: string }
  | { ok: false; response: Response };

export async function requirePrincipal(request: Request): Promise<PrincipalAuthResult> {
  const cookieHeader = request.headers.get("cookie");
  let sessionToken = extractPrincipalSessionToken(cookieHeader);

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(PRINCIPAL_SESSION_COOKIE_NAME)?.value ?? null;
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

  const session = await getPrincipalSessionFromCookies().catch(() => null);
  if (!session) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }

  try {
    return await runWithConnection(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM users WHERE user_id = ? LIMIT 1",
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
        } as PrincipalAuthResult;
      }

      const resolvedRole = await resolveUserRole(connection, user as any);
      const roleForLogic = resolvedRole ?? null;
      const normalizedRole = normalizeRoleName(roleForLogic);
      const canonicalRole = resolveCanonicalRole(normalizedRole);

      if (canonicalRole !== "principal") {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as PrincipalAuthResult;
      }

      return {
        ok: true,
        userId: Number(user.user_id),
        principalId: String(session.principalId),
        role: roleForLogic,
        canonicalRole,
      } as PrincipalAuthResult;
    });
  } catch (error) {
    console.error("Principal authorization failed", error);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
