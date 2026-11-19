// Checks your Gmail SMTP settings, then sends ONE test email to GMAIL_USER (yourself).
// Usage:  npm run test:email      (reads .env.local)
import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
const port = Number(process.env.SMTP_PORT ?? 465);

if (!user || !pass) {
  console.error("✗ GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log(`✓ Logged in to smtp.gmail.com:${port} as ${user}`);
  const info = await transporter.sendMail({
    from: { name: "Aurelia", address: user },
    to: user,
    subject: "Aurelia — SMTP test",
    text: "If you can read this, Gmail SMTP is configured correctly for the Aurelia website.",
  });
  console.log(`✓ Test email accepted by Gmail (id ${info.messageId}). Check the inbox of ${user}.`);
} catch (err) {
  console.error("✗ SMTP test failed:", err.message);
  if (/Invalid login|535/.test(err.message)) {
    console.error("  → Use a 16-character App Password, not your normal Gmail password, and make sure 2-Step Verification is on.");
  }
  process.exit(1);
}
