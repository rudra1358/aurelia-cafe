import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { site } from "@/data/site";
import { MailConfigError, alertOwnerGuestNotEmailed, assertMailConfigured, sendReservationEmails } from "@/lib/mailer";
import { markSheetGuestNotEmailed, saveReservationToSheet } from "@/lib/sheets";
import { isRateLimited, type Limit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { nowInCafeTimeZone, validateReservation } from "@/lib/validation";

/** Short, readable reference such as "AUR-7KQ2XD", used in the sheet and both emails. */
function makeReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const bytes = randomBytes(6);
  let id = "";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return `AUR-${id}`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;

/**
 * Rate limits. Shared across server instances when Upstash Redis is configured
 * (see lib/rate-limit.ts), otherwise per instance.
 * - per IP: blunts scripted floods from one connection
 * - per email / phone: stops the form being used to spam one person's inbox from many IPs
 */
const LIMITS = {
  ip: { name: "ip", max: 5, windowSeconds: 10 * 60 },
  email: { name: "email", max: 3, windowSeconds: 24 * 60 * 60 },
  phone: { name: "phone", max: 3, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, Limit>;

const TOO_MANY = "Too many requests were sent. Please wait a while, or call us to book.";

/** Client IP. On Vercel these headers are set by the platform and can't be spoofed by the visitor. */
function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/**
 * Only accept requests from this site's own pages: blocks other websites from posting
 * to the API from a visitor's browser (CSRF) and casual cross-site abuse.
 */
function sameOrigin(request: Request): boolean {
  const h = request.headers;
  if (h.get("sec-fetch-site") === "cross-site") return false;
  const origin = h.get("origin");
  if (!origin) return true; // non-browser clients; the other checks still apply
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  return originHost === host;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ ok: false, error: "Invalid request." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Invalid request." }, 415);
  }

  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Honeypot field: real visitors never fill it. Pretend success so bots learn nothing.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return json({ ok: true }, 200);
  }

  const ip = clientIp(request);
  if (await isRateLimited(LIMITS.ip, ip ?? "unknown")) {
    return json({ ok: false, error: TOO_MANY }, 429);
  }

  const result = validateReservation(body);
  if (!result.ok) {
    return json({ ok: false, errors: result.errors }, 422);
  }

  // Bot check (Cloudflare Turnstile), when configured. If Cloudflare itself is unreachable we
  // let the request through rather than lose a booking — the rate limits still apply.
  const human = await verifyTurnstile(body.turnstileToken, ip);
  if (human === "missing" || human === "invalid") {
    return json({ ok: false, error: "The security check didn’t complete.", turnstile: true }, 400);
  }

  // Per-recipient limits: checked after validation so they count only real-looking requests.
  const emailKey = result.data.email.toLowerCase();
  const phoneKey = result.data.phone.replace(/\D/g, "").slice(-10);
  const [emailLimited, phoneLimited] = await Promise.all([
    isRateLimited(LIMITS.email, emailKey),
    isRateLimited(LIMITS.phone, phoneKey),
  ]);
  if (emailLimited || phoneLimited) {
    return json({ ok: false, error: TOO_MANY }, 429);
  }

  try {
    assertMailConfigured();
  } catch (err) {
    if (err instanceof MailConfigError) {
      console.error("[reservations] Email is not configured:", err.message);
      return json({ ok: false, error: "Online reservations are temporarily unavailable." }, 503);
    }
    throw err;
  }

  const now = new Date();
  const reference = makeReference();

  // 1. Save to the owner's Google Sheet first (never throws).
  const { date, time } = nowInCafeTimeZone();
  const sheet = await saveReservationToSheet({ ...result.data, reference, submittedAt: `${date} ${time}` });

  // Same guest (email or phone) already has an active request near that time: don't create a
  // second row or resend emails. This also stops a retry after a failed guest email reaching the owner twice.
  if (sheet.status === "duplicate") {
    return json({ ok: true, duplicate: true, reference: sheet.existing?.reference, existing: sheet.existing }, 200);
  }

  // That time already has as many guests as the café takes online.
  if (sheet.status === "full") {
    return json(
      {
        ok: false,
        errors: {
          time: `This time is fully booked online. Please choose another time, or call us on ${site.contact.phoneDisplay}.`,
        },
      },
      422,
    );
  }

  // 2. Email the owner, then the guest. The owner email says whether the sheet save worked.
  let sent;
  try {
    sent = await sendReservationEmails(result.data, { reference, submittedAt: now, sheet: sheet.status });
  } catch (err) {
    // Only thrown when the sheet save failed AND the owner email failed: nothing reached the owner.
    console.error(`[reservations] ${reference} reached nobody (sheet ${sheet.status}, owner email failed):`, err);
    return json({ ok: false, error: "We couldn’t send your request just now, so it hasn’t reached us." }, 502);
  }

  // The booking reached the owner, but the guest's confirmation email didn't go out.
  if (!sent.guest) {
    if (sheet.status === "saved") await markSheetGuestNotEmailed(reference);
    else alertOwnerGuestNotEmailed(result.data, reference);
    return json({ ok: true, reference, emailFailed: true }, 200);
  }

  return json({ ok: true, reference }, 200);
}

export function GET() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
