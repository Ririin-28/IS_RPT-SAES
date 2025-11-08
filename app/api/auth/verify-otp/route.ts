import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { randomBytes } from "crypto";
import { recordAccountLogin } from "@/lib/server/account-logs";

interface VerifyOtpPayload {
  email: string;
  otp: string;
  deviceName?: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  otp_code: string | null;
  otp_expires_at: Date | string | null;
  role: string | null;
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
    const { email, otp, deviceName } = (await req.json()) as VerifyOtpPayload;

    db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    const [users] = await db.execute<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];

    if (!user) {
      return respond(400, { error: "User not found" });
    }

    if (!user.otp_code || user.otp_code !== otp) {
      return respond(400, { error: "Invalid OTP" });
    }

    const expiry = user.otp_expires_at ? new Date(user.otp_expires_at) : null;
    if (!expiry || Number.isNaN(expiry.getTime()) || Date.now() > expiry.getTime()) {
      return respond(400, { error: "OTP expired" });
    }

    await db.execute<ResultSetHeader>(
      "UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?",
      [user.user_id]
    );

    const deviceToken = randomBytes(32).toString("hex");
    const computedDeviceName = deviceName && deviceName.trim().length > 0 ? deviceName : "Unnamed Device";

    await db.execute<ResultSetHeader>(
      "INSERT INTO trusted_devices (user_id, device_token, device_name) VALUES (?, ?, ?)",
      [user.user_id, deviceToken, computedDeviceName]
    );

    await db.execute<ResultSetHeader>(
      "UPDATE trusted_devices SET last_used = NOW() WHERE user_id = ? AND device_token = ?",
      [user.user_id, deviceToken]
    );

    await recordAccountLogin(db, user.user_id, user.role);

    return respond(200, { success: true, deviceToken });
  } catch (error) {
    console.error("OTP verification failed", error);
    return respond(500, { error: "Server error" });
  } finally {
    if (db) {
      await db.end();
    }
  }
}
