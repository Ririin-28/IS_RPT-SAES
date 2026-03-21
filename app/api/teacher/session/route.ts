import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import {
  buildClearedTeacherSessionCookie,
  getTeacherSessionFromCookies,
} from "@/lib/server/teacher-session";
import { normalizeRoleName, resolveCanonicalRole, resolveUserRole } from "@/lib/server/role-resolution";

interface TeacherUserRow extends RowDataPacket {
  user_id: number;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  profile_image_url?: string | null;
  role?: string | null;
  role_id?: number | null;
  user_code?: string | null;
}

function canonicalizeRole(role: string | null): string {
  const normalized = normalizeRoleName(role);
  return resolveCanonicalRole(normalized) || normalized;
}

export async function GET(): Promise<Response> {
  const session = await getTeacherSessionFromCookies().catch(() => null);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session expired" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": buildClearedTeacherSessionCookie(),
      },
    });
  }

  try {
    const payload = await runWithConnection(async (connection) => {
      const [rows] = await connection.execute<TeacherUserRow[]>(
        "SELECT user_id, email, first_name, middle_name, last_name, profile_image_url, role_id, user_code FROM users WHERE user_id = ? LIMIT 1",
        [session.userId],
      );

      const user = rows[0];
      if (!user) {
        return null;
      }

      const resolvedRole = await resolveUserRole(connection, user);
      const canonicalRole = canonicalizeRole(resolvedRole ?? null);
      if (canonicalRole !== "teacher") {
        return null;
      }

      return {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
        profileImageUrl: user.profile_image_url ?? null,
        role: canonicalRole,
      };
    });

    if (!payload) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Set-Cookie": buildClearedTeacherSessionCookie(),
        },
      });
    }

    return new Response(JSON.stringify({ success: true, user: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Teacher session lookup failed", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
