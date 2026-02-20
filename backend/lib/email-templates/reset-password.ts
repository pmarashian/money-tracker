/**
 * Escape string for safe use in HTML text and attributes.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getResetPasswordEmailContent(params: {
  resetUrl: string;
  code: string;
}): { html: string; text: string } {
  const resetUrl = escapeHtml(params.resetUrl);
  const code = escapeHtml(params.code);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f5f8; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f5f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <h1 style="margin:0 0 24px 0; font-size:22px; font-weight:700; color:#222428;">Money Tracker</h1>
              <p style="margin:0 0 24px 0; font-size:16px; line-height:1.5; color:#222428;">You requested a password reset.</p>
              <p style="margin:0 0 20px 0; font-size:16px; line-height:1.5; color:#222428;">Click the button below to choose a new password:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="border-radius:6px; background-color:#3880ff;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block; padding:12px 24px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0; font-size:14px; line-height:1.5; color:#92949c;">Or use this code on the reset page:</p>
              <p style="margin:0 0 24px 0; font-size:18px; font-weight:600; font-family:ui-monospace, monospace; letter-spacing:0.1em; padding:12px 16px; background-color:#f4f5f8; border-radius:6px; color:#222428;">${code}</p>
              <p style="margin:0 0 24px 0; font-size:14px; line-height:1.5; color:#92949c;">This link and code expire in 1 hour.</p>
              <p style="margin:0; font-size:13px; line-height:1.5; color:#92949c;">If you didn't request this, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = [
    "Money Tracker",
    "",
    "You requested a password reset.",
    "",
    "Reset your password by visiting this link:",
    params.resetUrl,
    "",
    "Or use this code on the reset page: " + params.code,
    "",
    "This link and code expire in 1 hour.",
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");

  return { html, text };
}
