import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "@/data/site";
import { customerEmail, ownerEmail } from "./email-templates";
import type { Reservation } from "./validation";
import type { SheetStatus } from "./sheets";

/** Throws early if email is not configured, so nothing is written to the sheet for a request that can't be emailed. */
export function assertMailConfigured(): void {
  readConfig();
}

/** Thrown when the SMTP environment variables are missing. */
export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigError";
  }
}

interface MailConfig {
  user: string;
  pass: string;
  owner: string;
  host: string;
  port: number;
}

function readConfig(): MailConfig {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows App Passwords as "abcd efgh ijkl mnop" — spaces are not part of it.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const owner = process.env.OWNER_EMAIL?.trim() || site.contact.email;
  const port = Number(process.env.SMTP_PORT ?? 465);
  // Defaults to Gmail. Override only for another SMTP provider or local testing.
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";

  const missing = [!user && "GMAIL_USER", !pass && "GMAIL_APP_PASSWORD"].filter(Boolean);
  if (missing.length) throw new MailConfigError(`Missing environment variable(s): ${missing.join(", ")}`);
  if (port !== 465 && port !== 587) throw new MailConfigError("SMTP_PORT must be 465 or 587");

  return { user: user!, pass: pass!, owner, host, port };
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(cfg: MailConfig): Transporter {
  const key = `${cfg.user}@${cfg.host}:${cfg.port}`;
  if (cached?.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = implicit TLS; 587 = STARTTLS upgrade
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cached = { key, transporter };
  return transporter;
}

/**
 * Sends both reservation emails. Resolves only when Gmail has accepted BOTH messages;
 * throws otherwise so the API can report failure to the visitor.
 *
 * The owner notification is sent first — it is the one the café must not miss.
 */
export async function sendReservationEmails(
  r: Reservation,
  meta: { reference: string; submittedAt: Date; sheet: SheetStatus },
): Promise<void> {
  const cfg = readConfig();
  const transporter = getTransporter(cfg);
  const from = { name: site.name, address: cfg.user };

  const owner = ownerEmail(r, meta.submittedAt, meta.reference, meta.sheet);
  await transporter.sendMail({
    from,
    to: cfg.owner,
    replyTo: { name: r.name, address: r.email },
    subject: owner.subject,
    text: owner.text,
    html: owner.html,
  });

  const customer = customerEmail(r, meta.reference);
  await transporter.sendMail({
    from,
    to: { name: r.name, address: r.email },
    replyTo: { name: site.name, address: cfg.owner },
    subject: customer.subject,
    text: customer.text,
    html: customer.html,
  });
}

/** Checks the SMTP login without sending anything. Used by scripts/test-email.mjs-style checks. */
export async function verifySmtp(): Promise<void> {
  await getTransporter(readConfig()).verify();
}
