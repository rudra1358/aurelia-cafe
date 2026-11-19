import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { MailConfigError, assertMailConfigured, sendReservationEmails } from "@/lib/mailer";
import { saveReservationToSheet } from "@/lib/sheets";
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
 * Best-effort rate limit: 5 requests per IP per 10 minutes.
 * In-memory, so it resets on restart and is per server instance — enough to blunt
 * accidental repeats and casual abuse, not a substitute for a shared store at scale.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return false;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Too many requests were sent from your connection. Please wait a few minutes." }, 429);
  }

  const result = validateReservation(body);
  if (!result.ok) {
    return json({ ok: false, errors: result.errors }, 422);
  }

  try {
    assertMailConfigured();
    const now = new Date();
    const reference = makeReference();

    // Save to the owner's Google Sheet first (never throws), then email.
    // The owner email says whether the sheet save worked.
    const { date, time } = nowInCafeTimeZone();
    const sheet = await saveReservationToSheet({ ...result.data, reference, submittedAt: `${date} ${time}` });

    await sendReservationEmails(result.data, { reference, submittedAt: now, sheet });
  } catch (err) {
    if (err instanceof MailConfigError) {
      console.error("[reservations] Email is not configured:", err.message);
      return json({ ok: false, error: "Online reservations are temporarily unavailable." }, 503);
    }
    console.error("[reservations] Failed to send reservation emails:", err);
    return json({ ok: false, error: "We couldn’t send your request just now, so it hasn’t reached us." }, 502);
  }

  return json({ ok: true }, 200);
}

export function GET() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
