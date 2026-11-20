import { json, readJsonBody, safeEqual } from "@/lib/http";
import { MailConfigError, assertMailConfigured } from "@/lib/mailer";
import { notifyGuest } from "@/lib/notifications";
import { toBooking } from "@/lib/sheets";

/**
 * Called by the Google Sheet's Apps Script (scripts/google-apps-script.gs), not by browsers:
 * - event "status":   the owner changed a row's Status to Confirmed, Declined or Cancelled
 * - event "reminder": the day-before reminder for a confirmed booking
 * Authenticated with GOOGLE_SHEETS_SECRET, the same secret the website uses to call the sheet.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_EVENTS = ["Confirmed", "Declined", "Cancelled"] as const;
type StatusEvent = (typeof STATUS_EVENTS)[number];

export async function POST(request: Request) {
  const secret = process.env.GOOGLE_SHEETS_SECRET?.trim();
  if (!secret) return json({ ok: false, error: "GOOGLE_SHEETS_SECRET is not set on the website" }, 503);

  const body = await readJsonBody(request);
  if (!body || typeof body.secret !== "string" || !safeEqual(body.secret, secret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const booking = toBooking(body.booking);
  if (!booking) return json({ ok: false, error: "missing or invalid booking (reference, date, time)" }, 400);
  if (!booking.email) return json({ ok: false, error: "the booking has no email address" }, 400);

  try {
    assertMailConfigured();
  } catch (err) {
    if (err instanceof MailConfigError) return json({ ok: false, error: `email not configured: ${err.message}` }, 503);
    throw err;
  }

  let result;
  if (body.event === "reminder") {
    result = await notifyGuest("reminder", booking);
  } else if (body.event === "status" && STATUS_EVENTS.includes(body.status as StatusEvent)) {
    const status = body.status as StatusEvent;
    const calendar = status === "Confirmed" ? "CONFIRMED" : status === "Cancelled" ? "CANCELLED" : undefined;
    result = await notifyGuest(status, booking, calendar);
  } else {
    return json({ ok: false, error: "unknown event" }, 400);
  }

  // Delivered if the email went out, or at least the WhatsApp message did.
  const ok = result.email || result.whatsapp === true;
  return json({ ok, ...result, ...(ok ? {} : { error: "email could not be sent" }) }, ok ? 200 : 502);
}

export function GET() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
