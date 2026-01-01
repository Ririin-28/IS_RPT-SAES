import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import {
  buildClearedAdminSessionCookie,
  buildAdminSessionCookie,
  createAdminSession,
  extractAdminSessionToken,
  validateAdminSession,
} from "@/lib/server/admin-session";

interface AdminUserRow extends RowDataPacket {
  user_id: number;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  role: string | null;
}

const ADMIN_ROLE_SET = new Set(["admin", "it_admin", "itadmin"]);

function normalizeRole(role: string | null): string {
  if (!role) {
    return "";
  }
  return role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
}

export async function GET(req: Request): Promise<Response> {
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
    const cookieHeader = req.headers.get("cookie");
    const sessionToken = extractAdminSessionToken(cookieHeader);
    if (!sessionToken) {
      return respond(401, { error: "Not authenticated" });
    }

    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    });

    const session = await validateAdminSession(db, sessionToken);
    if (!session) {
      return respond(401, { error: "Session expired" }, {
        "Set-Cookie": buildClearedAdminSessionCookie(),
      });
    }

    const [rows] = await db.execute<AdminUserRow[]>(
      `SELECT user_id, email, first_name, middle_name, last_name, role FROM users WHERE user_id = ? LIMIT 1`,
      [session.userId],
    );
    const user = rows[0];
    if (!user || !ADMIN_ROLE_SET.has(normalizeRole(user.role))) {
      return respond(401, { error: "Account not found" }, {
        "Set-Cookie": buildClearedAdminSessionCookie(),
      });
    }

    const userAgent = req.headers.get("user-agent");
    const { token, expiresAt } = await createAdminSession(db, session.userId, userAgent);

    return respond(200, {
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
        role: normalizeRole(user.role),
      },
    }, {
      "Set-Cookie": buildAdminSessionCookie(token, expiresAt),
    });
  } catch (error) {
    console.error("Admin session lookup failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
