import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";
import {
  MASTER_TEACHER_SESSION_COOKIE_NAME,
  extractMasterTeacherSessionToken,
  getMasterTeacherSessionFromCookies,
} from "@/lib/server/master-teacher-session";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";

export type MasterTeacherAuthResult =
  | {
      ok: true;
      userId: number;
      masterTeacherId: string;
      role: string | null;
      canonicalRole: string;
    }
  | { ok: false; response: Response };

export async function requireMasterTeacher(request: Request): Promise<MasterTeacherAuthResult> {
  const cookieHeader = request.headers.get("cookie");
  let sessionToken = extractMasterTeacherSessionToken(cookieHeader);

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(MASTER_TEACHER_SESSION_COOKIE_NAME)?.value ?? null;
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

  const session = await getMasterTeacherSessionFromCookies().catch(() => null);
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
        } as MasterTeacherAuthResult;
      }

      const resolvedRole = await resolveUserRole(connection, user as any);
      const roleForLogic = resolvedRole ?? null;
      const normalizedRole = normalizeRoleName(roleForLogic);
      const canonicalRole = resolveCanonicalRole(normalizedRole);

      if (canonicalRole !== "master_teacher" && canonicalRole !== "masterteacher") {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as MasterTeacherAuthResult;
      }

      return {
        ok: true,
        userId: Number(user.user_id),
        masterTeacherId: String(session.masterTeacherId),
        role: roleForLogic,
        canonicalRole: canonicalRole === "masterteacher" ? "master_teacher" : canonicalRole,
      } as MasterTeacherAuthResult;
    });
  } catch (error) {
    console.error("Master teacher authorization failed", error);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
