import mysql, { type Connection, type ResultSetHeader } from "mysql2/promise";
import { recordAccountLogout } from "@/lib/server/account-logs";

interface LogoutPayload {
  userId?: number | string | null;
}

export async function POST(req: Request): Promise<Response> {
  let db: Connection | null = null;

  const respond = async (status: number, payload: Record<string, unknown>): Promise<Response> => {
    if (db) {
      await db.end();
      db = null;
    }

    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  try {
    const { userId } = (await req.json()) as LogoutPayload;

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      return respond(400, { error: "Invalid user id" });
    }

    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    await recordAccountLogout(db, numericUserId);

    return respond(200, { success: true });
  } catch (error) {
    console.error("Logout request failed", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
