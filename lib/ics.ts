import "server-only";
import { site } from "@/data/site";
import { formatGuests } from "./format";

/**
 * Calendar invite (.ics) for a booking, so it lands in the guest's calendar.
 * Uses METHOD:PUBLISH (an event to add, not a meeting to RSVP to). A cancellation re-sends the
 * same UID with STATUS:CANCELLED and a higher SEQUENCE, which removes or strikes the event.
 */

export interface CalendarBooking {
  reference: string;
  date: string; // YYYY-MM-DD (café time)
  time: string; // HH:MM (café time)
  guests: number;
  event?: string;
}

/** India has no daylight saving, so IST is always UTC+05:30. */
const IST_OFFSET_MINUTES = 330;

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function startUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000);
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets must be folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (Buffer.byteLength(current + ch, "utf8") > limit) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function bookingIcs(b: CalendarBooking, status: "CONFIRMED" | "CANCELLED"): string {
  const start = startUtc(b.date, b.time);
  const end = new Date(start.getTime() + site.reservations.calendarMinutes * 60_000);
  const host = new URL(site.url).hostname || "aurelia.local";
  const location = site.location.exactAddress ? `${site.location.exactAddress}, ${site.location.display}` : site.location.display;
  const summary = b.event ? `${b.event} at ${site.name}` : `Table at ${site.name}`;
  const description = [
    `${formatGuests(b.guests)} · reference ${b.reference}`,
    `To change or cancel, use the link in your email or call ${site.contact.phoneDisplay}.`,
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${site.name}//Reservations//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.reference}@${host}`,
    `SEQUENCE:${Math.floor(Date.now() / 1000) - 1_700_000_000}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `STATUS:${status}`,
    "TRANSP:OPAQUE",
    ...(status === "CONFIRMED"
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(summary)}`, "TRIGGER:-PT2H", "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
