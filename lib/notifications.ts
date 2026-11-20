import "server-only";
import { formatDate, formatGuests, formatTime } from "./format";
import { manageUrl } from "./booking-token";
import { guestUpdateEmail, type GuestUpdate } from "./email-templates";
import { bookingIcs } from "./ics";
import { sendGuestEmail } from "./mailer";
import type { Booking } from "./sheets";
import { WHATSAPP_TEMPLATES, whatsappEnabled, whatsappGuest } from "./whatsapp";

/** Status word used in the guest's WhatsApp status template ("Your table … is {{2}}"). */
const WHATSAPP_STATUS: Partial<Record<GuestUpdate, string>> = {
  Confirmed: "confirmed",
  Declined: "not available, sorry",
  Cancelled: "cancelled",
  "cancelled-by-guest": "cancelled",
  changed: "changed and awaiting confirmation",
};

/** Updates that still let the guest change or cancel. */
const WITH_MANAGE_LINK: GuestUpdate[] = ["Confirmed", "reminder", "changed"];

export interface GuestNotified {
  email: boolean;
  /** null = not attempted (guest didn't opt in, or WhatsApp isn't set up). */
  whatsapp: boolean | null;
}

/**
 * Tells the guest about a change to their booking by email (with a calendar invite when it's
 * confirmed or cancelled) and, if they opted in, on WhatsApp.
 */
export async function notifyGuest(
  kind: GuestUpdate,
  b: Booking,
  calendar?: "CONFIRMED" | "CANCELLED",
): Promise<GuestNotified> {
  const link = WITH_MANAGE_LINK.includes(kind) ? manageUrl(b.reference) : null;
  const content = guestUpdateEmail(kind, b, b.reference, link);
  const ics = calendar ? bookingIcs(b, calendar) : undefined;

  const wantsWhatsApp = b.whatsapp && whatsappEnabled();
  const [email, whatsapp] = await Promise.all([
    b.email ? sendGuestEmail({ name: b.name, address: b.email }, content, `${kind} email for ${b.reference}`, ics) : false,
    wantsWhatsApp ? sendWhatsApp(kind, b) : Promise.resolve(null),
  ]);
  return { email, whatsapp };
}

function sendWhatsApp(kind: GuestUpdate, b: Booking): Promise<boolean> {
  const date = formatDate(b.date);
  const time = formatTime(b.time);
  if (kind === "reminder") {
    return whatsappGuest(b.phone, WHATSAPP_TEMPLATES.guestReminder, [b.name, date, time, formatGuests(b.guests), b.reference]);
  }
  const word = WHATSAPP_STATUS[kind];
  if (!word) return Promise.resolve(false);
  return whatsappGuest(b.phone, WHATSAPP_TEMPLATES.guestStatus, [b.name, word, date, time, formatGuests(b.guests), b.reference]);
}
