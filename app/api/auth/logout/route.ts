import mysql, { type Connection } from "mysql2/promise";
import { recordAccountLogout } from "@/lib/server/account-logs";
import {
  buildClearedParentSessionCookie,
  extractParentSessionToken,
  revokeParentSession,
} from "@/lib/server/parent-session";
import {
  buildClearedAdminSessionCookie,
  extractAdminSessionToken,
  revokeAdminSession,
} from "@/lib/server/admin-session";

interface LogoutPayload {
  userId?: number | string | null;
}

export async function POST(req: Request): Promise<Response> {
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
    const { userId } = (await req.json().catch(() => ({ userId: null }))) as LogoutPayload;
    const cookieHeader = req.headers.get("cookie");
    const parentSessionToken = extractParentSessionToken(cookieHeader);
    const adminSessionToken = extractAdminSessionToken(cookieHeader);
    const numericUserId = Number(userId);
    const hasValidBodyUserId = Number.isFinite(numericUserId) && numericUserId > 0;

    if (!parentSessionToken && !adminSessionToken && !hasValidBodyUserId) {
      return respond(400, { error: "Invalid user id" });
    }

    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    let resolvedUserId: number | null = null;
    const responseCookies: string[] = [];

    if (parentSessionToken) {
      const sessionUserId = await revokeParentSession(db, parentSessionToken);
      if (sessionUserId != null) {
        resolvedUserId = sessionUserId;
      }
      responseCookies.push(buildClearedParentSessionCookie());
    }

    if (adminSessionToken) {
      const sessionUserId = await revokeAdminSession(db, adminSessionToken);
      if (sessionUserId != null) {
        resolvedUserId = sessionUserId;
      }
      responseCookies.push(buildClearedAdminSessionCookie());
    }

    if (resolvedUserId == null && hasValidBodyUserId) {
      resolvedUserId = numericUserId;
    }

    if (resolvedUserId != null) {
      await recordAccountLogout(db, resolvedUserId);
    }

    return respond(200, { success: true }, responseCookies.length > 0 ? { "Set-Cookie": responseCookies } : undefined);
  } catch (error) {
    console.error("Logout request failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
