import mysql from "mysql2/promise";
import { randomBytes } from "crypto";

export async function POST(req) {
  try {
    const { email, otp, deviceName } = await req.json();
    const db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });
    // 1. Fetch user
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      await db.end();
      return new Response(JSON.stringify({ error: "User not found" }), { status: 400 });
    }
    // 2. Validate OTP
    if (user.otp_code !== otp) {
      await db.end();
      return new Response(JSON.stringify({ error: "Invalid OTP" }), { status: 400 });
    }
    if (new Date() > new Date(user.otp_expires_at)) {
      await db.end();
      return new Response(JSON.stringify({ error: "OTP expired" }), { status: 400 });
    }
    // 3. OTP valid → clear OTP
    await db.execute("UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?", [user.user_id]);
    // 4. Create trusted device token
    const deviceToken = randomBytes(32).toString("hex");
    await db.execute(
      "INSERT INTO trusted_devices (user_id, device_token, device_name) VALUES (?, ?, ?)",
      [user.user_id, deviceToken, deviceName || "Unnamed Device"]
    );
    await db.end();
    // Send deviceToken to client
    return new Response(JSON.stringify({ success: true, deviceToken }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
