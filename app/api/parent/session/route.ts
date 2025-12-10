import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import {
  buildClearedParentSessionCookie,
  buildParentSessionCookie,
  createParentSession,
  extractParentSessionToken,
  validateParentSession,
} from "@/lib/server/parent-session";

interface ParentUserRow extends RowDataPacket {
  user_id: number;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
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
    const sessionToken = extractParentSessionToken(cookieHeader);
    if (!sessionToken) {
      return respond(401, { error: "Not authenticated" });
    }

    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    const session = await validateParentSession(db, sessionToken);
    if (!session) {
      return respond(401, { error: "Session expired" }, {
        "Set-Cookie": buildClearedParentSessionCookie(),
      });
    }

    const [rows] = await db.execute<ParentUserRow[]>(
      `SELECT user_id, email, first_name, middle_name, last_name FROM users WHERE user_id = ? LIMIT 1`,
      [session.userId],
    );
    const user = rows[0];
    if (!user) {
      return respond(401, { error: "Account not found" }, {
        "Set-Cookie": buildClearedParentSessionCookie(),
      });
    }

    // Rotate session to extend validity on active use.
    const userAgent = req.headers.get("user-agent");
    const { token, expiresAt } = await createParentSession(db, session.userId, userAgent);

    return respond(200, {
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
      },
    }, {
      "Set-Cookie": buildParentSessionCookie(token, expiresAt),
    });
  } catch (error) {
    console.error("Parent session lookup failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
