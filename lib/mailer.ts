import "server-only";
import { after } from "next/server";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { site } from "@/data/site";
import { customerEmail, ownerEmail } from "./email-templates";
import type { Reservation } from "./validation";
import type { SheetStatus } from "./sheets";

/** Thrown when the SMTP environment variables are missing or invalid. */
export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigError";
  }
}

type Label = "primary" | "fallback";

interface SmtpAccount {
  label: Label;
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Address the email is sent from (must be allowed by this provider). */
  fromAddress: string;
}

interface MailConfig {
  primary: SmtpAccount;
  fallback: SmtpAccount | null;
  owner: string;
  /** "each" = email the owner for every booking; "off" = only when the booking couldn't be saved to the sheet. */
  ownerNotify: "each" | "off";
}

const ALLOWED_PORTS = [465, 587, 2525];

function parsePort(value: string | undefined, fallback: number, name: string): number {
  const port = Number(value?.trim() || fallback);
  if (!ALLOWED_PORTS.includes(port)) throw new MailConfigError(`${name} must be one of ${ALLOWED_PORTS.join(", ")}`);
  return port;
}

function readConfig(): MailConfig {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows App Passwords as "abcd efgh ijkl mnop" — spaces are not part of it.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const missing = [!user && "GMAIL_USER", !pass && "GMAIL_APP_PASSWORD"].filter(Boolean);
  if (missing.length) throw new MailConfigError(`Missing environment variable(s): ${missing.join(", ")}`);

  const primary: SmtpAccount = {
    label: "primary",
    // Defaults to Gmail. Override only for another SMTP provider or local testing.
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: parsePort(process.env.SMTP_PORT, 465, "SMTP_PORT"),
    user: user!,
    pass: pass!,
    fromAddress: user!,
  };

  // Optional backup provider (e.g. Brevo). All four values are needed to enable it.
  let fallback: SmtpAccount | null = null;
  const fHost = process.env.FALLBACK_SMTP_HOST?.trim();
  if (fHost) {
    const fUser = process.env.FALLBACK_SMTP_USER?.trim();
    const fPass = process.env.FALLBACK_SMTP_PASS?.trim();
    const fFrom = process.env.FALLBACK_FROM_EMAIL?.trim();
    if (fUser && fPass && fFrom) {
      fallback = {
        label: "fallback",
        host: fHost,
        port: parsePort(process.env.FALLBACK_SMTP_PORT, 587, "FALLBACK_SMTP_PORT"),
        user: fUser,
        pass: fPass,
        fromAddress: fFrom,
      };
    } else {
      console.error(
        "[mail] FALLBACK_SMTP_HOST is set but FALLBACK_SMTP_USER, FALLBACK_SMTP_PASS or FALLBACK_FROM_EMAIL is missing — backup disabled.",
      );
    }
  }

  const notify = process.env.OWNER_NOTIFY?.trim().toLowerCase();
  return {
    primary,
    fallback,
    owner: process.env.OWNER_EMAIL?.trim() || site.contact.email,
    ownerNotify: notify === "off" ? "off" : "each",
  };
}

/** Throws early if email is not configured, so nothing is written to the sheet for a request that can't be emailed. */
export function assertMailConfigured(): void {
  readConfig();
}

const transporters = new Map<string, Transporter>();

function getTransporter(a: SmtpAccount): Transporter {
  const key = `${a.user}@${a.host}:${a.port}`;
  let t = transporters.get(key);
  if (!t) {
    t = nodemailer.createTransport({
      host: a.host,
      port: a.port,
      secure: a.port === 465, // 465 = implicit TLS
      requireTLS: a.port === 587, // 587 = must upgrade with STARTTLS; 2525 = upgrade if offered
      auth: { user: a.user, pass: a.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transporters.set(key, t);
  }
  return t;
}

/**
 * When the primary account reports it is over its sending limit, skip it for a while
 * and go straight to the backup. In memory, so per server instance — best effort.
 */
const PRIMARY_PAUSE_MS = 60 * 60 * 1000;
let primaryPausedUntil = 0;

function isQuotaError(err: unknown): boolean {
  const e = err as { responseCode?: number; response?: string; message?: string };
  const text = `${e?.response ?? ""} ${e?.message ?? ""}`;
  return (
    /5\.4\.5|4\.7\.0|daily (user )?sending (quota|limit)|sending limit|quota exceeded|rate limit|too many/i.test(text) ||
    e?.responseCode === 421 ||
    e?.responseCode === 454
  );
}

/**
 * Tells the owner when the primary account is failing and mail is going through the backup,
 * so a broken Gmail App Password or an exhausted quota doesn't go unnoticed.
 * At most once every 6 hours per server instance; sent after the response so the guest doesn't wait.
 */
const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;
let lastAlertAt = 0;

function alertOwnerPrimaryFailing(cfg: MailConfig, reason: string): void {
  if (!cfg.fallback || Date.now() - lastAlertAt < ALERT_EVERY_MS) return;
  lastAlertAt = Date.now();
  const fallback = cfg.fallback;
  const text = [
    `The ${site.name} website could not send email through its main account (${cfg.primary.user}),`,
    `so reservation emails are being sent through the backup provider (${fallback.host}).`,
    "",
    `Reason: ${reason}`,
    "",
    "Bookings are still arriving. If this keeps happening, check the Gmail App Password",
    "and the account's sending limit. You'll get at most one of these alerts every 6 hours.",
  ].join("\n");
  const send = async () => {
    try {
      await getTransporter(fallback).sendMail({
        from: { name: `${site.name} website`, address: fallback.fromAddress },
        to: cfg.owner,
        subject: `[${site.name} website] Main email account is failing — using backup`,
        text,
      });
    } catch (err) {
      console.error("[mail] Could not send the owner alert:", (err as Error)?.message ?? err);
    }
  };
  try {
    after(send); // runs once the response has been sent
  } catch {
    void send(); // outside a request (e.g. scripts)
  }
}

/**
 * Sends one message through the primary account, retrying through the backup if the
 * primary fails. Returns which account delivered it; throws if every option failed.
 */
async function deliver(cfg: MailConfig, message: Omit<SendMailOptions, "from">, what: string): Promise<Label> {
  const accounts: SmtpAccount[] = [];
  const primaryPaused = cfg.fallback !== null && Date.now() < primaryPausedUntil;
  if (!primaryPaused) accounts.push(cfg.primary);
  if (cfg.fallback) accounts.push(cfg.fallback);

  let lastError: unknown;
  let primaryError: string | null = null;
  for (const account of accounts) {
    try {
      await getTransporter(account).sendMail({ ...message, from: { name: site.name, address: account.fromAddress } });
      if (account.label === "fallback") {
        console.warn(`[mail] ${what} sent via the backup provider.`);
        if (primaryError) alertOwnerPrimaryFailing(cfg, primaryError);
      }
      return account.label;
    } catch (err) {
      lastError = err;
      if (account.label === "primary") primaryError = String((err as Error)?.message ?? err).slice(0, 300);
      if (account.label === "primary" && isQuotaError(err)) {
        primaryPausedUntil = Date.now() + PRIMARY_PAUSE_MS;
        console.error(`[mail] Primary account hit a sending limit; using the backup for the next hour.`);
      }
      console.error(`[mail] ${what} failed via ${account.label}:`, (err as Error)?.message ?? err);
    }
  }
  throw lastError ?? new Error("No email account available");
}

export interface SendResult {
  /** null when the guest's confirmation could not be sent. The booking has still reached the owner. */
  guest: Label | null;
  /** null when the owner email was skipped (OWNER_NOTIFY=off) or could not be sent but the booking is in the sheet. */
  owner: Label | null;
}

/**
 * Sends the reservation emails, owner first, so the guest is only told "received" once
 * the booking has reached the owner (in the sheet or by email).
 * - The owner email is sent for every booking (OWNER_NOTIFY=each, default), or — with
 *   OWNER_NOTIFY=off — only when the booking could NOT be saved to the Google Sheet.
 *   If the sheet save failed, this email is the only record: if it can't be sent, this
 *   throws and the guest email is not sent, so the visitor sees an error.
 * - If the guest email fails, the booking has still reached the owner, so this does NOT
 *   throw: it returns guest = null and the caller tells the visitor and the owner.
 */
export async function sendReservationEmails(
  r: Reservation,
  meta: { reference: string; submittedAt: Date; sheet: SheetStatus },
): Promise<SendResult> {
  const cfg = readConfig();
  const inSheet = meta.sheet === "saved";
  const ownerRequired = !inSheet; // without the sheet, the owner email is the only record
  const sendOwner = cfg.ownerNotify === "each" || ownerRequired;

  let owner: Label | null = null;
  if (sendOwner) {
    const o = ownerEmail(r, meta.submittedAt, meta.reference, meta.sheet);
    try {
      owner = await deliver(
        cfg,
        { to: cfg.owner, replyTo: { name: r.name, address: r.email }, subject: o.subject, text: o.text, html: o.html },
        `Owner email for ${meta.reference}`,
      );
    } catch (err) {
      if (ownerRequired) throw err;
      console.error(`[mail] Owner email for ${meta.reference} not sent; the booking is in the Google Sheet.`);
    }
  }

  const c = customerEmail(r, meta.reference);
  let guest: Label | null = null;
  try {
    guest = await deliver(
      cfg,
      {
        to: { name: r.name, address: r.email },
        replyTo: { name: site.name, address: cfg.owner },
        subject: c.subject,
        text: c.text,
        html: c.html,
      },
      `Guest email for ${meta.reference}`,
    );
  } catch {
    console.error(`[mail] Guest email for ${meta.reference} not sent; the booking has reached the owner.`);
  }

  return { guest, owner };
}

/**
 * Tells the owner that a guest never got their confirmation email, so they should contact
 * the guest directly. Used when the booking isn't in the sheet (there it is marked instead).
 * Best effort, sent after the response.
 */
export function alertOwnerGuestNotEmailed(r: Reservation, reference: string): void {
  const cfg = readConfig();
  const text = [
    `The confirmation email to the guest for booking ${reference} could not be sent.`,
    `The booking itself reached you in the earlier "New Table Reservation" email.`,
    "",
    `Please contact ${r.name} directly: ${r.phone} · ${r.email}`,
  ].join("\n");
  const send = async () => {
    try {
      await deliver(
        cfg,
        { to: cfg.owner, subject: `[${site.name}] Guest not emailed — please contact them (${reference})`, text },
        `Owner alert for ${reference}`,
      );
    } catch {
      // Already logged by deliver(); the owner still has the booking email.
    }
  };
  try {
    after(send); // runs once the response has been sent
  } catch {
    void send(); // outside a request (e.g. scripts)
  }
}

/** Checks the primary SMTP login without sending anything. */
export async function verifySmtp(): Promise<void> {
  await getTransporter(readConfig().primary).verify();
}
