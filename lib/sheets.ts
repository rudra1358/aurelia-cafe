import "server-only";
import { site } from "@/data/site";
import type { Reservation } from "./validation";

/**
 * - "saved":     the row was added to the Google Sheet
 * - "duplicate": the same guest (email or phone) already has an active request close to that time
 * - "full":      that time already has as many guests as site.reservations.capacity allows
 * - "disabled":  GOOGLE_SHEETS_WEBHOOK_URL is not set, so saving is switched off
 * - "failed":    saving was attempted but did not succeed (the owner email says so)
 */
export type SheetStatus = "saved" | "duplicate" | "full" | "disabled" | "failed";

export interface SheetResult {
  status: SheetStatus;
  /** For "duplicate": the request that already exists. */
  existing?: { reference?: string; date?: string; time?: string };
}

/** Booking rules applied inside the sheet, where the existing bookings are. */
function rules() {
  const { duplicateWindowMinutes, capacity } = site.reservations;
  return { duplicateWindowMinutes, capacity };
}

interface SheetReply {
  ok?: boolean;
  booking?: unknown;
  error?: string;
  duplicate?: boolean;
  full?: boolean;
  reference?: string;
  date?: string;
  time?: string;
}

export interface SheetRow extends Reservation {
  reference: string;
  submittedAt: string; // "2026-11-19 18:42" in IST
}

const TIMEOUT_MS = 10_000;

function config(): { url: string; secret: string } | null | "misconfigured" {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!url) return null;
  const secret = process.env.GOOGLE_SHEETS_SECRET?.trim();
  if (!secret) {
    console.error("[sheets] GOOGLE_SHEETS_SECRET is not set — skipping Google Sheets.");
    return "misconfigured";
  }
  return { url, secret };
}

/** POSTs to the Apps Script web app. Apps Script answers with a redirect to the result; fetch follows it. */
async function call(url: string, payload: object): Promise<SheetReply> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // A non-JSON reply usually means the web app is not deployed with access "Anyone".
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
  }
}

/**
 * Appends the reservation to the owner's Google Sheet through the Apps Script web app
 * (scripts/google-apps-script.gs). Never throws: the emails are still sent if this fails.
 */
export async function saveReservationToSheet(row: SheetRow): Promise<SheetResult> {
  const cfg = config();
  if (cfg === null) return { status: "disabled" };
  if (cfg === "misconfigured") return { status: "failed" };

  try {
    const data = await call(cfg.url, { secret: cfg.secret, reservation: row, rules: rules() });
    if (data.ok && data.duplicate) {
      return { status: "duplicate", existing: { reference: data.reference, date: data.date, time: data.time } };
    }
    if (data.ok && data.full) return { status: "full" };
    if (data.ok) return { status: "saved" };
    console.error("[sheets] Google Sheets did not accept the row:", data.error);
    return { status: "failed" };
  } catch (err) {
    console.error("[sheets] Could not reach Google Sheets:", err);
    return { status: "failed" };
  }
}

/** A booking as stored in the sheet (the owner may have edited any of it). */
export interface Booking {
  reference: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  notes: string;
  whatsapp: boolean;
  event: string;
}

/** Statuses after which a guest can no longer change or cancel online. */
export const CLOSED_STATUSES = ["Declined", "Cancelled", "Completed", "No-show", "Email failed"];

/** Normalises a booking that came from the sheet (via the Apps Script or the notify webhook). */
export function toBooking(raw: unknown): Booking | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
  const booking: Booking = {
    reference: s(b.reference),
    status: s(b.status) || "Pending",
    name: s(b.name),
    email: s(b.email),
    phone: s(b.phone),
    date: s(b.date),
    time: s(b.time).slice(0, 5),
    guests: Math.max(0, parseInt(s(b.guests), 10) || 0),
    notes: s(b.notes),
    whatsapp: b.whatsapp === true || /^(yes|true|y)$/i.test(s(b.whatsapp)),
    event: s(b.event),
  };
  if (!booking.reference || !/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !/^\d{2}:\d{2}$/.test(booking.time)) return null;
  return booking;
}

export type BookingLookup = { status: "found"; booking: Booking } | { status: "not-found" | "unavailable" };

/** Looks a booking up by reference. Never throws. */
export async function getBooking(reference: string): Promise<BookingLookup> {
  const cfg = config();
  if (!cfg || cfg === "misconfigured") return { status: "unavailable" };
  try {
    const data = await call(cfg.url, { secret: cfg.secret, action: "get", reference });
    if (data.ok) {
      const booking = toBooking(data.booking);
      return booking ? { status: "found", booking } : { status: "not-found" };
    }
    if (data.error === "not found") return { status: "not-found" };
    console.error(`[sheets] Could not look up ${reference}:`, data.error);
  } catch (err) {
    console.error(`[sheets] Could not look up ${reference}:`, err);
  }
  return { status: "unavailable" };
}

export type BookingUpdate =
  | { status: "updated"; booking: Booking }
  | { status: "full" | "closed" | "not-found" | "failed" };

/**
 * Guest changes their booking (date, time, guests) or cancels it, from the "Manage booking" page.
 * A change puts the booking back to "Pending" for the owner to confirm again. Never throws.
 */
export async function updateBooking(
  reference: string,
  change: { action: "cancel" } | { action: "change"; date: string; time: string; guests: number },
): Promise<BookingUpdate> {
  const cfg = config();
  if (!cfg || cfg === "misconfigured") return { status: "failed" };
  try {
    const data = await call(cfg.url, {
      secret: cfg.secret,
      ...change,
      reference,
      rules: rules(),
      closedStatuses: CLOSED_STATUSES,
    });
    if (data.ok && data.full) return { status: "full" };
    if (data.ok) {
      const booking = toBooking(data.booking);
      if (booking) return { status: "updated", booking };
    }
    if (data.error === "not found") return { status: "not-found" };
    if (data.error === "closed") return { status: "closed" };
    console.error(`[sheets] Could not ${change.action} ${reference}:`, data.error);
  } catch (err) {
    console.error(`[sheets] Could not ${change.action} ${reference}:`, err);
  }
  return { status: "failed" };
}

/**
 * Marks a saved row "Guest not emailed" so the owner knows to contact the guest directly:
 * the booking is real, but the guest never got their confirmation email. Never throws.
 */
export async function markSheetGuestNotEmailed(reference: string): Promise<void> {
  const cfg = config();
  if (!cfg || cfg === "misconfigured") return;
  try {
    const data = await call(cfg.url, { secret: cfg.secret, action: "markGuestNotEmailed", reference });
    if (!data.ok) console.error(`[sheets] Could not mark ${reference} as "Guest not emailed":`, data.error);
  } catch (err) {
    console.error(`[sheets] Could not mark ${reference} as "Guest not emailed":`, err);
  }
}
