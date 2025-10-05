import mysql from "mysql2/promise";
import { compare } from "bcryptjs";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
  const { email, password, deviceToken, deviceName } = await req.json();
    const db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });
    // 1. Check user
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      await db.end();
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }
    // 2. Check password (direct string comparison, no bcrypt)
    if (password !== user.password) {
      await db.end();
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }
    // 3. Check if device is trusted (by token or device name)
    let trusted = false;
    if (deviceToken) {
      const [devices] = await db.execute(
        "SELECT * FROM trusted_devices WHERE user_id = ? AND device_token = ?",
        [user.user_id, deviceToken]
      );
      if (devices.length) trusted = true;
    }
    if (!trusted && deviceName) {
      const [devicesByName] = await db.execute(
        "SELECT * FROM trusted_devices WHERE user_id = ? AND device_name = ?",
        [user.user_id, deviceName]
      );
      if (devicesByName.length) trusted = true;
    }
    if (trusted) {
      await db.execute("UPDATE trusted_devices SET last_used = NOW() WHERE user_id = ?", [user.user_id]);
      await db.end();
      return new Response(
        JSON.stringify({ success: true, skipOtp: true, role: user.role, user_id: user.user_id }),
        { status: 200 }
      );
    }
    // 4. Device not trusted → redirect to verification (OTP will be sent from /api/send-otp)
    await db.end();
    return new Response(
      JSON.stringify({ success: true, otpRequired: true, role: user.role, user_id: user.user_id }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
