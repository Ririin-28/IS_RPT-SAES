
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";

export async function POST(req) {
  const { step, email, otp, newPassword } = await req.json();
  // DB connection
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  });

  if (step === 'send_otp') {
    // Find user by email
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      await db.end();
      return new Response(JSON.stringify({ success: false, message: 'Email not found.' }), { status: 404 });
    }
    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await db.execute("UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE user_id = ?", [otpCode, expiresAt, user.user_id]);
    // Send OTP email
    const transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: "rptsaes.system@gmail.com",
      to: email,
      subject: "Your Password Reset OTP",
      text: `Your OTP code is: ${otpCode}`,
    });
    await db.end();
    return new Response(JSON.stringify({ success: true, message: 'OTP sent to email.' }), { status: 200 });
  }

  if (step === 'verify_otp') {
    // Find user by email
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user || !user.otp_code || !user.otp_expires_at) {
      await db.end();
      return new Response(JSON.stringify({ success: false, message: 'OTP not found.' }), { status: 400 });
    }
    const now = new Date();
    if (user.otp_code !== otp) {
      await db.end();
      return new Response(JSON.stringify({ success: false, message: 'Invalid OTP.' }), { status: 400 });
    }
    if (now > user.otp_expires_at) {
      await db.end();
      return new Response(JSON.stringify({ success: false, message: 'OTP expired.' }), { status: 400 });
    }
    await db.end();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (step === 'reset_password') {
    // Find user by email
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      await db.end();
      return new Response(JSON.stringify({ success: false, message: 'User not found.' }), { status: 404 });
    }
    // Update password and clear OTP
    await db.execute("UPDATE users SET password = ?, otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?", [newPassword, user.user_id]);
    await db.end();
    return new Response(JSON.stringify({ success: true, message: 'Password reset successful.' }), { status: 200 });
  }

  await db.end();
  return new Response(JSON.stringify({ success: false, message: 'Invalid step.' }), { status: 400 });
}
