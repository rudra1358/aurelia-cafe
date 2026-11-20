import { site } from "@/data/site";
import { REFERENCE_RE, verifyReference } from "@/lib/booking-token";
import { formatDate, formatGuests, formatTime } from "@/lib/format";
import { clientIp, json, readJsonBody, sameOrigin } from "@/lib/http";
import { ownerChangeEmail } from "@/lib/email-templates";
import { MailConfigError, assertMailConfigured, sendOwnerEmail } from "@/lib/mailer";
import { manageState } from "@/lib/manage";
import { notifyGuest } from "@/lib/notifications";
import { isRateLimited, type Limit } from "@/lib/rate-limit";
import { getBooking, updateBooking, type Booking } from "@/lib/sheets";
import { validateReservation } from "@/lib/validation";
import { WHATSAPP_TEMPLATES, whatsappOwner } from "@/lib/whatsapp";

/**
 * "Manage booking" page actions: the guest cancels, or changes the date / time / guests.
 * Authorised by the signed token from the guest's email (lib/booking-token.ts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT: Limit = { name: "manage-ip", max: 10, windowSeconds: 10 * 60 };
const UNAVAILABLE = `We couldn’t update your booking just now. Please try again in a moment, or call us on ${site.contact.phoneDisplay}.`;

/** What the page needs to show; never includes the guest's contact details. */
function publicView(b: Booking) {
  const state = manageState(b);
  return {
    reference: b.reference,
    status: b.status,
    date: b.date,
    time: b.time,
    guests: b.guests,
    event: b.event,
    ...state,
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, error: "Invalid request." }, 403);
  const body = await readJsonBody(request);
  if (!body) return json({ ok: false, error: "Invalid request." }, 400);

  if (await isRateLimited(LIMIT, clientIp(request) ?? "unknown")) {
    return json({ ok: false, error: "Too many attempts. Please wait a few minutes, or call us." }, 429);
  }

  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  if (!REFERENCE_RE.test(reference) || !verifyReference(reference, body.token)) {
    return json({ ok: false, error: "This link isn’t valid. Please use the link in your latest email." }, 403);
  }
  const action = body.action;
  if (action !== "cancel" && action !== "change") return json({ ok: false, error: "Invalid request." }, 400);

  try {
    assertMailConfigured();
  } catch (err) {
    if (err instanceof MailConfigError) return json({ ok: false, error: UNAVAILABLE }, 503);
    throw err;
  }

  const found = await getBooking(reference);
  if (found.status === "not-found") return json({ ok: false, error: "We couldn’t find this booking." }, 404);
  if (found.status !== "found") return json({ ok: false, error: UNAVAILABLE }, 503);
  const before = found.booking;

  const state = manageState(before);
  if (action === "cancel" ? !state.canCancel : !state.canChange) {
    return json({ ok: false, error: state.reason ?? "This booking can’t be changed online.", booking: publicView(before) }, 409);
  }

  let change: { action: "cancel" } | { action: "change"; date: string; time: string; guests: number };
  if (action === "change") {
    // Re-use the reservation form's rules (opening hours, closed days, guest limits …).
    const check = validateReservation({ ...before, whatsapp: before.whatsapp ? "yes" : "", event: "", date: body.date, time: body.time, guests: body.guests });
    if (!check.ok) {
      const { date, time, guests } = check.errors;
      const errors = { date, time, guests };
      if (date || time || guests) return json({ ok: false, errors }, 422);
      // The stored name/email/phone no longer pass the form's checks: let the owner handle it.
      return json({ ok: false, error: `Please call us on ${site.contact.phoneDisplay} to change this booking.` }, 422);
    }
    const { date, time, guests } = check.data;
    if (date === before.date && time === before.time && guests === before.guests) {
      return json({ ok: false, error: "That’s the same as your current booking — nothing to change." }, 422);
    }
    change = { action: "change", date, time, guests };
  } else {
    change = { action: "cancel" };
  }

  const updated = await updateBooking(reference, change);
  if (updated.status === "full") {
    return json(
      { ok: false, errors: { time: `This time is fully booked online. Please choose another time, or call us on ${site.contact.phoneDisplay}.` } },
      422,
    );
  }
  if (updated.status === "not-found") return json({ ok: false, error: "We couldn’t find this booking." }, 404);
  if (updated.status === "closed") return json({ ok: false, error: "This booking can no longer be changed online." }, 409);
  if (updated.status !== "updated") return json({ ok: false, error: UNAVAILABLE }, 503);
  const after = updated.booking;

  // The sheet is updated; now tell the guest and the owner. Failures here don't undo the change.
  const wasConfirmed = before.status === "Confirmed";
  const ownerKind = action === "cancel" ? "cancelled" : "changed";
  const whatHappened =
    action === "cancel"
      ? "cancelled"
      : `changed to ${formatGuests(after.guests)} on ${formatDate(after.date)} at ${formatTime(after.time)}`;
  const [guest] = await Promise.all([
    action === "cancel"
      ? notifyGuest("cancelled-by-guest", after, wasConfirmed ? "CANCELLED" : undefined)
      : notifyGuest("changed", after, wasConfirmed ? "CANCELLED" : undefined),
    sendOwnerEmail(ownerChangeEmail(ownerKind, after, reference, before), `Owner ${ownerKind} email for ${reference}`, {
      name: after.name,
      address: after.email,
    }),
    whatsappOwner(WHATSAPP_TEMPLATES.ownerBookingChanged, [reference, after.name, whatHappened]),
  ]);

  return json({ ok: true, booking: publicView(after), emailed: guest.email }, 200);
}

export function GET() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
