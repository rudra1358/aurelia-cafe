/**
 * Reservation validation shared by the browser form and the API route.
 * The server always re-validates — client checks are only for convenience.
 */
import { site } from "@/data/site";
import { formatTime } from "./format";

export const reservationFields = ["name", "email", "phone", "date", "time", "guests", "notes"] as const;
export type ReservationField = (typeof reservationFields)[number];

export type ReservationInput = Record<ReservationField, string>;
export type ReservationErrors = Partial<Record<ReservationField, string>>;

export interface Reservation {
  name: string;
  email: string;
  phone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  guests: number;
  notes: string;
}

export type ValidationResult =
  | { ok: true; data: Reservation }
  | { ok: false; errors: ReservationErrors };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{10,15}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Control characters (incl. newlines) are never valid in single-line fields.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** Current date (YYYY-MM-DD) and time (HH:MM) in the café's time zone. */
export function nowInCafeTimeZone(timeZone = site.timeZone): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function validateReservation(
  raw: unknown,
  now: { date: string; time: string } = nowInCafeTimeZone(),
): ValidationResult {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { maxGuests, maxNotesLength, maxDaysAhead } = site.reservations;
  const errors: ReservationErrors = {};

  const name = str(src.name).trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Please enter your full name.";
  else if (name.length < 2) errors.name = "Please enter at least 2 characters.";
  else if (name.length > 100) errors.name = "Please keep your name under 100 characters.";
  else if (CONTROL_RE.test(name) || /[<>]/.test(name)) errors.name = "Please remove special characters from your name.";

  const email = str(src.email).trim();
  if (!email) errors.email = "Please enter your email address.";
  else if (email.length > 254 || CONTROL_RE.test(email) || !EMAIL_RE.test(email))
    errors.email = "Please enter a valid email address.";

  const phoneRaw = str(src.phone).trim();
  const phone = phoneRaw.replace(/[\s\-().]/g, "");
  if (!phoneRaw) errors.phone = "Please enter your phone number.";
  else if (!PHONE_RE.test(phone)) errors.phone = "Please enter a valid phone number.";

  const date = str(src.date).trim();
  if (!date) errors.date = "Please choose a date.";
  else if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    errors.date = "Please choose a valid date.";
  else if (date < now.date) errors.date = "Please choose today or a future date.";
  else if (date > addDays(now.date, maxDaysAhead)) errors.date = "Please choose a date within the next year.";

  const time = str(src.time).trim();
  if (!time) errors.time = "Please choose a preferred time.";
  else if (!TIME_RE.test(time)) errors.time = "Please choose a valid time.";
  else if (time < site.hours.open || time > site.hours.lastReservation)
    errors.time = `Please choose a time between ${formatTime(site.hours.open)} and ${formatTime(site.hours.lastReservation)}.`;
  else if (!errors.date && date === now.date && time <= now.time) errors.time = "Please choose a time later today.";

  const guestsRaw = str(src.guests).trim();
  const guests = Number(guestsRaw);
  if (!guestsRaw) errors.guests = "Please select the number of guests.";
  else if (!Number.isInteger(guests) || guests < 1 || guests > maxGuests)
    errors.guests = `Online requests are for 1–${maxGuests} guests.`;

  const notes = str(src.notes).trim();
  if (notes.length > maxNotesLength) errors.notes = `Please keep special requests under ${maxNotesLength} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { name, email, phone: phoneRaw.replace(/\s+/g, " "), date, time, guests, notes } };
}
