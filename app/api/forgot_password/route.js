import nodemailer from "nodemailer";
import { query } from "@/lib/db";

export async function POST(req) {
  const { step, email, otp, newPassword } = await req.json();

  if (step === 'send_otp') {
    // Find user by email
    const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: 'Email not found.' }), { status: 404 });
    }
    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await query("UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE user_id = ?", [otpCode, expiresAt, user.user_id]);
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
    return new Response(JSON.stringify({ success: true, message: 'OTP sent to email.' }), { status: 200 });
  }

  if (step === 'verify_otp') {
    // Find user by email
    const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user || !user.otp_code || !user.otp_expires_at) {
      return new Response(JSON.stringify({ success: false, message: 'OTP not found.' }), { status: 400 });
    }
    const now = new Date();
    if (user.otp_code !== otp) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid OTP.' }), { status: 400 });
    }
    if (now > user.otp_expires_at) {
      return new Response(JSON.stringify({ success: false, message: 'OTP expired.' }), { status: 400 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (step === 'reset_password') {
    // Find user by email
    const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: 'User not found.' }), { status: 404 });
    }
    // Update password and clear OTP
    await query("UPDATE users SET password = ?, otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?", [newPassword, user.user_id]);
    return new Response(JSON.stringify({ success: true, message: 'Password reset successful.' }), { status: 200 });
  }

  return new Response(JSON.stringify({ success: false, message: 'Invalid step.' }), { status: 400 });
}
