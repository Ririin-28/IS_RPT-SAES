import mysql from "mysql2/promise";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { email, user_id } = await req.json();
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0');
    // Store OTP and expiry in DB
    const db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await db.execute("UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE user_id = ?", [otp, expiresAt, user_id]);
    await db.end();
    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "rptsaes.system@gmail.com",
        pass: "brqu lxmz ozsf eqyw",
      },
    });
    await transporter.sendMail({
      from: "rptsaes.system@gmail.com",
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, message: "Server error" }), { status: 500 });
  }
}
