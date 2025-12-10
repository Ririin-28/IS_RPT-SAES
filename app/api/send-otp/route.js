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
    const logoUrl = "https://raw.githubusercontent.com/Ririin-28/IS_RPT-SAES/main/public/RPT-SAES/RPTLogo.png";
    const plainTextMessage = `Hello,\n\nYour One-Time Password (OTP) for account verification is: ${otp}.\n\nThis code is valid for 5 minutes. Please keep it confidential and do not share it with anyone.\n\nIf you did not request this code, please ignore this email.\n\nThank you for using RPT-SAES.`;

    const htmlMessage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your OTP Code</title>
  </head>
  <body style="margin:0; padding:24px; background-color:#f5f7fb; font-family:'Segoe UI', Arial, sans-serif; color:#1a2b3d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px; margin:0 auto; background-color:#ffffff; border-radius:16px; box-shadow:0 20px 60px rgba(15, 55, 95, 0.12); overflow:hidden;">
      <tr>
        <td style="padding:32px 32px 0; background:linear-gradient(135deg, #3bbf7b 0%, #0f3d1e 100%); text-align:center;">
          <img src="${logoUrl}" alt="RPT-SAES Logo" width="72" height="72" style="display:block; margin:0 auto 12px;" />
          <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:0.5px; color:#ffffff;">RPT-SAES</h1>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.85);">San Agustin Elementary School Remedial Progress Tracker</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 0; text-align:center;">
          <h2 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#1a2b3d;">Your OTP Code</h2>
          <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4a5568;">
            Hello,<br />
            Use the one-time password below to verify your account.
          </p>
          <div style="display:inline-block; padding:18px 32px; border-radius:12px; background-color:#edfdf6; border:1px solid #a7f3d0;">
            <span style="font-size:32px; font-weight:700; letter-spacing:6px; color:#1a4731;">${otp}</span>
          </div>
          <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#4a5568;">
            This code is valid for <strong style="color:#1a4731;">5 minutes</strong>. Please keep it confidential and do not share it with anyone.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;">
          <div style="height:1px; width:100%; background-color:#e2e8f0;"></div>
          <p style="margin:20px 0 0; font-size:13px; line-height:1.6; color:#64748b; text-align:center;">
            If you did not request this code, please ignore this email. You may need to request a new OTP if this one expires.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 32px; text-align:center; font-size:12px; color:#94a3b8; background-color:#f8fafc;">
          © ${new Date().getFullYear()} RPT-SAES. All rights reserved.
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await transporter.sendMail({
      from: "rptsaes.system@gmail.com",
      to: email,
      subject: "RPT-SAES OTP Verification",
      text: plainTextMessage,
      html: htmlMessage,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, message: "Server error" }), { status: 500 });
  }
}
