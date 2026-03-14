import nodemailer from "nodemailer";

export interface AccountCredentialEmailInput {
  email: string;
  recipientName: string;
  roleLabel: string;
  temporaryPassword: string;
  secondaryCredentialLabel?: string | null;
  secondaryCredentialValue?: string | null;
}

export interface AccountCredentialEmailDelivery {
  sent: boolean;
  error: string | null;
}

const LOGO_URL = "https://raw.githubusercontent.com/Ririin-28/IS_RPT-SAES/main/public/RPT-SAES/RPTLogo.png";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransporter() {
  return nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildPlainTextMessage(input: AccountCredentialEmailInput): string {
  const loginLines = [
    `Email: ${input.email}`,
    input.secondaryCredentialLabel && input.secondaryCredentialValue
      ? `${input.secondaryCredentialLabel}: ${input.secondaryCredentialValue}`
      : null,
    `Temporary Password: ${input.temporaryPassword}`,
  ].filter((line): line is string => Boolean(line));

  return [
    `Hello ${input.recipientName},`,
    "",
    `Your ${input.roleLabel} account in RPT-SAES has been created.`,
    "",
    "Use the following credentials to sign in:",
    ...loginLines,
    "",
    "For security, please sign in and change your password as soon as possible.",
    "",
    "If you were not expecting this account, please contact the school administrator.",
  ].join("\n");
}

function buildHtmlMessage(input: AccountCredentialEmailInput): string {
  const secondaryCredentialRow = input.secondaryCredentialLabel && input.secondaryCredentialValue
    ? `<tr>
          <td style="padding:12px 16px; font-size:14px; color:#475569; border-bottom:1px solid #e2e8f0; text-align:left; vertical-align:top;">${escapeHtml(input.secondaryCredentialLabel)}</td>
          <td style="padding:12px 16px; font-size:14px; font-weight:600; color:#0f172a; border-bottom:1px solid #e2e8f0; text-align:center; vertical-align:middle;">${escapeHtml(input.secondaryCredentialValue)}</td>
        </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RPT-SAES Account Credentials</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f7fb; font-family:'Segoe UI', Arial, sans-serif; color:#1a2b3d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; background-color:#f5f7fb;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="center" style="width:100%; max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:16px; box-shadow:0 20px 60px rgba(15, 55, 95, 0.12); overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0; background:linear-gradient(135deg, #3bbf7b 0%, #0f3d1e 100%); text-align:center;">
                <img src="${LOGO_URL}" alt="RPT-SAES Logo" width="72" height="72" style="display:block; margin:0 auto 12px;" />
                <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:0.5px; color:#ffffff;">RPT-SAES</h1>
                <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.85); text-align:center;">San Agustin Elementary School Remedial Progress Tracker</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0; text-align:left;">
                <h2 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#1a2b3d; text-align:left;">Your Account Is Ready</h2>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569; text-align:justify; text-justify:inter-word;">
                  Hello ${escapeHtml(input.recipientName)},
                </p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#475569; text-align:justify; text-justify:inter-word;">
                  Your ${escapeHtml(input.roleLabel)} account in RPT-SAES has been created. Use the credentials below to sign in.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="center" style="width:100%; max-width:460px; margin:0 auto; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                        <tr>
                          <td style="padding:12px 16px; font-size:14px; color:#475569; border-bottom:1px solid #e2e8f0; text-align:left; vertical-align:top;">Email</td>
                          <td style="padding:12px 16px; font-size:14px; font-weight:600; color:#0f172a; border-bottom:1px solid #e2e8f0; text-align:center; vertical-align:middle;">${escapeHtml(input.email)}</td>
                        </tr>
                        ${secondaryCredentialRow}
                        <tr>
                          <td style="padding:12px 16px; font-size:14px; color:#475569; text-align:left; vertical-align:top;">Temporary Password</td>
                          <td style="padding:12px 16px; font-size:16px; font-weight:700; color:#0f172a; letter-spacing:1px; text-align:center; vertical-align:middle;">${escapeHtml(input.temporaryPassword)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#475569; text-align:justify; text-justify:inter-word;">
                  For security, please sign in and change your password as soon as possible.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px; font-size:12px; color:#94a3b8; text-align:center; background-color:#f8fafc;">
                &copy; ${new Date().getFullYear()} RPT-SAES. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAccountCredentialEmail(input: AccountCredentialEmailInput): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Credential email transport is not configured.");
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.email,
    subject: "RPT-SAES Account Credentials",
    text: buildPlainTextMessage(input),
    html: buildHtmlMessage(input),
  });
}

export async function deliverAccountCredentialEmail(
  input: AccountCredentialEmailInput,
): Promise<AccountCredentialEmailDelivery> {
  try {
    await sendAccountCredentialEmail(input);
    return { sent: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send credential email.";
    console.error("Failed to send account credential email", {
      email: input.email,
      roleLabel: input.roleLabel,
      error,
    });
    return { sent: false, error: message };
  }
}
