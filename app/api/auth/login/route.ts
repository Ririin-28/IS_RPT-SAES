import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { recordAccountLogin } from "@/lib/server/account-logs";

interface LoginRequestPayload {
  email: string;
  password: string;
  userId?: string | number | null;
  deviceToken?: string | null;
  deviceName?: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  password: string;
  role: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

function roleRequiresUserId(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
  return normalized === "it_admin" || normalized === "admin" || normalized === "itadmin";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    const { email, password, userId, deviceToken, deviceName } = (await req.json()) as LoginRequestPayload;

    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    const [users] = await db.execute<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];

    if (!user) {
      return respond(401, { error: "Invalid credentials" });
    }

    let normalizedUserId: number | null = null;
    if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
      normalizedUserId = toNumber(userId);
      if (normalizedUserId === null) {
        return respond(401, { error: "Invalid credentials" });
      }

      if (Number(user.user_id) !== normalizedUserId) {
        return respond(401, { error: "Invalid credentials" });
      }
    }

    if (roleRequiresUserId(user.role) && normalizedUserId === null) {
      return respond(401, {
        error: "Admin login requires user ID",
        errorCode: "ADMIN_USER_ID_REQUIRED",
        requireUserId: true,
      });
    }

    if (password !== user.password) {
      return respond(401, { error: "Invalid credentials" });
    }

    let trusted = false;

    if (deviceToken) {
      const [devices] = await db.execute<RowDataPacket[]>(
        "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_token = ? LIMIT 1",
        [user.user_id, deviceToken]
      );
      if (devices.length > 0) {
        trusted = true;
      }
    }

    if (!trusted && deviceName) {
      const [devicesByName] = await db.execute<RowDataPacket[]>(
        "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_name = ? LIMIT 1",
        [user.user_id, deviceName]
      );
      if (devicesByName.length > 0) {
        trusted = true;
      }
    }

    if (trusted) {
      await db.execute("UPDATE trusted_devices SET last_used = NOW() WHERE user_id = ?", [user.user_id]);
      await recordAccountLogin(db, user.user_id, user.role);

      return respond(200, {
        success: true,
        skipOtp: true,
        role: user.role,
        user_id: user.user_id,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        email: user.email,
      });
    }

    return respond(200, {
      success: true,
      otpRequired: true,
      role: user.role,
      user_id: user.user_id,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      email: user.email,
    });
  } catch (error) {
    console.error("Login request failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
