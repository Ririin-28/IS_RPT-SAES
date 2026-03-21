import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { runWithConnection } from "@/lib/db";
import {
  TEACHER_SESSION_COOKIE_NAME,
  extractTeacherSessionToken,
  getTeacherSessionFromCookies,
} from "@/lib/server/teacher-session";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";

export type TeacherAuthResult =
  | { ok: true; userId: number; teacherId: string | null; role: string | null; canonicalRole: string }
  | { ok: false; response: Response };

export async function requireTeacher(request: Request): Promise<TeacherAuthResult> {
  const cookieHeader = request.headers.get("cookie");
  let sessionToken = extractTeacherSessionToken(cookieHeader);

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(TEACHER_SESSION_COOKIE_NAME)?.value ?? null;
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

  const session = await getTeacherSessionFromCookies().catch(() => null);
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
        } as TeacherAuthResult;
      }

      const resolvedRole = await resolveUserRole(connection, user as any);
      const roleForLogic = resolvedRole ?? null;
      const normalizedRole = normalizeRoleName(roleForLogic);
      const canonicalRole = resolveCanonicalRole(normalizedRole);

      if (canonicalRole !== "teacher") {
        return {
          ok: false,
          response: new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          }),
        } as TeacherAuthResult;
      }

      return {
        ok: true,
        userId: Number(user.user_id),
        teacherId: session.teacherId,
        role: roleForLogic,
        canonicalRole,
      } as TeacherAuthResult;
    });
  } catch (error) {
    console.error("Teacher authorization failed", error);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    };
  }
}
