// Checks an SMTP account, then sends ONE test email to yourself.
//   npm run test:email            → main account (GMAIL_USER), sends to GMAIL_USER
//   npm run test:email:fallback   → backup provider (FALLBACK_*), sends to OWNER_EMAIL
import nodemailer from "nodemailer";

const useFallback = process.argv.includes("--fallback");
const env = (k) => process.env[k]?.trim();

const account = useFallback
  ? {
      name: "backup provider",
      host: env("FALLBACK_SMTP_HOST"),
      port: Number(env("FALLBACK_SMTP_PORT") || 587),
      user: env("FALLBACK_SMTP_USER"),
      pass: env("FALLBACK_SMTP_PASS"),
      from: env("FALLBACK_FROM_EMAIL"),
      to: env("OWNER_EMAIL") || env("GMAIL_USER"),
    }
  : {
      name: "main account",
      host: env("SMTP_HOST") || "smtp.gmail.com",
      port: Number(env("SMTP_PORT") || 465),
      user: env("GMAIL_USER"),
      pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""),
      from: env("GMAIL_USER"),
      to: env("GMAIL_USER"),
    };

const missing = useFallback
  ? ["FALLBACK_SMTP_HOST", "FALLBACK_SMTP_USER", "FALLBACK_SMTP_PASS", "FALLBACK_FROM_EMAIL"].filter((k) => !env(k))
  : ["GMAIL_USER", "GMAIL_APP_PASSWORD"].filter((k) => !env(k));
if (missing.length) {
  console.error(`✗ Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: account.host,
  port: account.port,
  secure: account.port === 465,
  requireTLS: account.port === 587,
  auth: { user: account.user, pass: account.pass },
});

try {
  await transporter.verify();
  console.log(`✓ Logged in to ${account.host}:${account.port} (${account.name})`);
  const info = await transporter.sendMail({
    from: { name: "Aurelia", address: account.from },
    to: account.to,
    subject: `Aurelia — SMTP test (${account.name})`,
    text: `If you can read this, the ${account.name} is configured correctly for the Aurelia website.`,
  });
  console.log(`✓ Test email accepted (id ${info.messageId}). Check the inbox of ${account.to}.`);
} catch (err) {
  console.error(`✗ SMTP test failed (${account.name}):`, err.message);
  if (!useFallback && /Invalid login|535/.test(err.message)) {
    console.error("  → Use a 16-character App Password, not your normal Gmail password, and make sure 2-Step Verification is on.");
  }
  if (useFallback && /sender|not (allowed|authorized|verified)/i.test(err.message)) {
    console.error("  → FALLBACK_FROM_EMAIL must be a sender you have verified with the backup provider.");
  }
  process.exitCode = 1;
}
