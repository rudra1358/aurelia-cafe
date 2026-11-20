import "server-only";
import { site } from "@/data/site";
import { formatDate, formatGuests, formatTime } from "./format";
import type { Reservation } from "./validation";
import type { SheetStatus } from "./sheets";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped multi-line text → HTML with <br>. */
function multiline(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

const C = {
  cream: "#FAF9F6",
  sand: "#F1EEE8",
  ink: "#302820",
  body: "#4A4239",
  muted: "#6F665C",
  accent: "#7E6548",
  accentLight: "#C4AA88",
  dark: "#28251F",
};
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'DM Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function rows(items: [string, string][]): string {
  return items
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:13px 16px 13px 0;border-bottom:1px solid #E6E1D8;width:150px;vertical-align:top;font:500 11px/1.6 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.accent};">${label}</td>
        <td style="padding:13px 0;border-bottom:1px solid #E6E1D8;vertical-align:top;font:400 15px/1.6 ${SANS};color:${C.ink};">${value}</td>
      </tr>`,
    )
    .join("");
}

function shell(inner: string, preheader: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${site.name}</title></head>
<body style="margin:0;padding:0;background:${C.sand};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sand};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
      ${inner}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** What every booking email shows. Works for a new request and for a booking read back from the sheet. */
export interface BookingDetails {
  name: string;
  date: string;
  time: string;
  guests: number;
  notes: string;
  event?: string;
}

function displayValues(r: BookingDetails) {
  return {
    date: formatDate(r.date),
    time: formatTime(r.time),
    guests: formatGuests(r.guests),
    notes: r.notes.trim() || "None",
  };
}

/** Cancellation and late-arrival policy, as configured in data/site.ts. */
function policyLines(): string[] {
  return [site.legal.cancellationPolicy, site.legal.lateArrivalPolicy].filter((s): s is string => !!s);
}

interface GuestEmailOptions {
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  paragraphs: string[];
  /** Boxed note under the intro. */
  callout?: string;
  tableTitle: string;
  booking: BookingDetails;
  reference: string;
  /** Signed "Manage booking" link; omitted for bookings that can no longer be changed. */
  manageUrl?: string | null;
  showPolicies?: boolean;
  /** Line about the attached calendar invite. */
  calendarNote?: boolean;
  signOff?: string;
}

/** Shared layout for every email to the guest. */
function guestEmail(o: GuestEmailOptions): EmailContent {
  const v = displayValues(o.booking);
  const details: [string, string][] = [
    ["Reference", o.reference],
    ...(o.booking.event ? ([["Event", o.booking.event]] as [string, string][]) : []),
    ["Name", o.booking.name],
    ["Date", v.date],
    ["Time", v.time],
    ["Guests", v.guests],
    ["Special requests", v.notes],
  ];
  const policies = o.showPolicies ? policyLines() : [];
  const signOff = o.signOff ?? "We look forward to welcoming you.";
  const contactHtml = o.manageUrl
    ? "To change or cancel, use the button above, reply to this email or call us on"
    : "If you have any questions, simply reply to this email or call us on";
  const contactText = o.manageUrl
    ? "To change or cancel, use the link above, reply to this email or call us on"
    : "If you have any questions, simply reply to this email or call us on";

  const html = shell(
    `
      <tr><td align="center" style="background:${C.dark};padding:40px 48px;">
        <div style="font:500 30px/1 ${SERIF};letter-spacing:.36em;color:${C.cream};padding-left:.36em;">${site.wordmark}</div>
        <div style="margin-top:10px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accentLight};">${esc(site.location.area)} · ${esc(site.location.city)}</div>
      </td></tr>
      <tr><td style="padding:48px 48px 8px;">
        <div style="font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accent};">${esc(o.eyebrow)}</div>
        <h1 style="margin:14px 0 0;font:300 38px/1.1 ${SERIF};color:${C.ink};">${esc(o.headline)}</h1>
        ${o.paragraphs.map((p) => `<p style="margin:24px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">${esc(p)}</p>`).join("")}
        ${
          o.callout
            ? `<div style="margin-top:24px;padding:16px 18px;border:1px solid #D9CDBD;background:${C.cream};font:400 14px/1.6 ${SANS};color:${C.ink};">${esc(o.callout)}</div>`
            : ""
        }
        <div style="margin:40px 0 6px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.muted};">${esc(o.tableTitle)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.ink};">
          ${rows(details.map(([k, val]) => [k, multiline(val)]))}
        </table>
        ${
          o.manageUrl
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0;"><tr>
          <td style="background:${C.ink};"><a href="${esc(o.manageUrl)}" style="display:inline-block;padding:15px 22px;font:500 11px/1 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${C.cream};text-decoration:none;">Change or cancel booking</a></td>
        </tr></table>`
            : ""
        }
        ${o.calendarNote ? `<p style="margin:24px 0 0;font:400 14px/1.7 ${SANS};color:${C.muted};">A calendar invite is attached — open it to add the booking to your calendar.</p>` : ""}
        ${policies.length ? `<p style="margin:32px 0 0;font:400 14px/1.7 ${SANS};color:${C.muted};">${policies.map(esc).join("<br>")}</p>` : ""}
        <p style="margin:24px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">${esc(contactHtml)} <a href="tel:${site.contact.phoneE164}" style="color:${C.accent};">${site.contact.phoneDisplay}</a>.</p>
        <p style="margin:28px 0 40px;font:italic 400 22px/1.4 ${SERIF};color:${C.ink};">${esc(signOff)}<br>— The Aurelia team</p>
      </td></tr>
      <tr><td align="center" style="border-top:1px solid #E6E1D8;padding:28px 48px;font:400 12px/1.7 ${SANS};color:${C.muted};">
        ${site.name} · ${esc(site.location.display)}<br>
        <a href="mailto:${site.contact.email}" style="color:${C.accent};">${site.contact.email}</a> · <a href="tel:${site.contact.phoneE164}" style="color:${C.accent};">${site.contact.phoneDisplay}</a><br>
        You received this email because a reservation was made with this address on our website.
      </td></tr>`,
    o.preheader,
  );

  const pad = (k: string) => `${k}:`.padEnd(18);
  const text = [
    o.headline,
    "",
    ...o.paragraphs.flatMap((p) => [p, ""]),
    ...(o.callout ? [o.callout.toUpperCase(), ""] : []),
    o.tableTitle.toUpperCase(),
    ...details.map(([k, val]) => `${pad(k)}${val}`),
    "",
    ...(o.manageUrl ? [`Change or cancel your booking: ${o.manageUrl}`, ""] : []),
    ...(o.calendarNote ? ["A calendar invite is attached.", ""] : []),
    ...(policies.length ? [...policies, ""] : []),
    `${contactText} ${site.contact.phoneDisplay}.`,
    "",
    signOff,
    "— The Aurelia team",
    "",
    `${site.name} · ${site.location.display}`,
    `${site.contact.email} · ${site.contact.phoneDisplay}`,
  ].join("\n");

  return { subject: o.subject, html, text };
}

/** Email 1 — acknowledgement to the customer. */
export function customerEmail(r: BookingDetails, reference: string, manageUrl?: string | null): EmailContent {
  return guestEmail({
    subject: r.event ? `Your request for ${r.event} at Aurelia` : "Your Reservation Request at Aurelia",
    preheader: "We’ve received your reservation request — we’ll email you once it’s confirmed.",
    eyebrow: "Request received",
    headline: `Thank you, ${r.name}.`,
    paragraphs: [
      r.event
        ? `We’ve received your request for ${r.event} at Aurelia. We’ll email you as soon as your seats are confirmed.`
        : "We’ve received your reservation request at Aurelia. We’ll email you as soon as your table is confirmed.",
    ],
    callout: "Please note: this is not yet a confirmed booking. Your table is confirmed only once you hear from us.",
    tableTitle: "Your request",
    booking: r,
    reference,
    manageUrl,
    showPolicies: true,
  });
}

export type GuestUpdate = "Confirmed" | "Declined" | "Cancelled" | "reminder" | "changed" | "cancelled-by-guest";

/** Emails sent after the request: the owner's status change in the sheet, reminders, and the guest's own changes. */
export function guestUpdateEmail(kind: GuestUpdate, b: BookingDetails, reference: string, manageUrl?: string | null): EmailContent {
  const v = displayValues(b);
  const what = b.event ? `your place at ${b.event}` : "your table";
  const when = `${v.date} at ${v.time}`;
  switch (kind) {
    case "Confirmed":
      return guestEmail({
        subject: `Confirmed: ${b.event || "your table"} at Aurelia, ${v.date}`,
        preheader: `See you on ${when} — ${v.guests}.`,
        eyebrow: "Booking confirmed",
        headline: `You’re booked, ${b.name}.`,
        paragraphs: [`Good news — ${what} for ${v.guests} on ${when} is confirmed.`],
        tableTitle: "Your booking",
        booking: b,
        reference,
        manageUrl,
        showPolicies: true,
        calendarNote: true,
      });
    case "Declined":
      return guestEmail({
        subject: "About your reservation request at Aurelia",
        preheader: "We’re sorry — we can’t confirm your request.",
        eyebrow: "Request not confirmed",
        headline: `We’re sorry, ${b.name}.`,
        paragraphs: [
          `Unfortunately we can’t offer ${what} for ${v.guests} on ${when}.`,
          "If another day or time works for you, please make a new request on our website or call us — we’d love to find you a table.",
        ],
        tableTitle: "Your request",
        booking: b,
        reference,
        signOff: "We hope to welcome you another time.",
      });
    case "Cancelled":
      return guestEmail({
        subject: "Your Aurelia booking has been cancelled",
        preheader: `Your booking for ${when} has been cancelled.`,
        eyebrow: "Booking cancelled",
        headline: `Your booking is cancelled, ${b.name}.`,
        paragraphs: [`Your booking for ${v.guests} on ${when} has been cancelled. If you didn’t expect this, please call us.`],
        tableTitle: "Cancelled booking",
        booking: b,
        reference,
        signOff: "We hope to welcome you another time.",
      });
    case "cancelled-by-guest":
      return guestEmail({
        subject: "You’ve cancelled your Aurelia booking",
        preheader: `Your booking for ${when} is cancelled.`,
        eyebrow: "Cancellation received",
        headline: `All cancelled, ${b.name}.`,
        paragraphs: [`As you asked, your booking for ${v.guests} on ${when} has been cancelled. There is no charge.`],
        tableTitle: "Cancelled booking",
        booking: b,
        reference,
        signOff: "We hope to welcome you another time.",
      });
    case "changed":
      return guestEmail({
        subject: "We’ve received your change — Aurelia",
        preheader: `Your new request: ${v.guests} on ${when}.`,
        eyebrow: "Change received",
        headline: `Thanks, ${b.name}.`,
        paragraphs: [`We’ve updated your request to ${v.guests} on ${when}. We’ll email you again once it’s confirmed.`],
        callout: "Please note: the changed booking is not confirmed until you hear from us.",
        tableTitle: "Your updated request",
        booking: b,
        reference,
        manageUrl,
        showPolicies: true,
      });
    case "reminder":
      return guestEmail({
        subject: `See you tomorrow at Aurelia — ${v.time}`,
        preheader: `A reminder of your booking: ${v.guests}, ${when}.`,
        eyebrow: "See you tomorrow",
        headline: `Looking forward to it, ${b.name}.`,
        paragraphs: [
          `A quick reminder that ${what} for ${v.guests} is booked for tomorrow, ${when}.`,
          "If your plans have changed, please let us know so we can offer the table to someone else.",
        ],
        tableTitle: "Your booking",
        booking: b,
        reference,
        manageUrl,
        showPolicies: true,
      });
  }
}

/** To the owner when a guest changes or cancels on the "Manage booking" page. */
export function ownerChangeEmail(
  kind: "changed" | "cancelled",
  b: BookingDetails & { email: string; phone: string },
  reference: string,
  before?: { date: string; time: string; guests: number },
): EmailContent {
  const v = displayValues(b);
  const subject =
    kind === "cancelled" ? `Cancelled by guest — ${b.name}, ${v.date} (${reference})` : `Changed by guest — ${b.name} (${reference})`;
  const lines =
    kind === "cancelled"
      ? [`${b.name} cancelled their booking for ${v.guests} on ${v.date} at ${v.time}. The sheet now shows it as Cancelled.`]
      : [
          `${b.name} changed their booking. It is back to Pending in the sheet — please confirm or decline it again.`,
          ...(before ? [`Before: ${formatGuests(before.guests)} on ${formatDate(before.date)} at ${formatTime(before.time)}`] : []),
          `Now:    ${v.guests} on ${v.date} at ${v.time}`,
        ];
  const text = [
    ...lines,
    "",
    `Reference: ${reference}`,
    ...(b.event ? [`Event:     ${b.event}`] : []),
    `Guest:     ${b.name} · ${b.phone} · ${b.email}`,
    `Requests:  ${v.notes}`,
  ].join("\n");
  const html = shell(
    `<tr><td style="padding:36px 40px;font:400 15px/1.7 ${SANS};color:${C.body};">
      <div style="font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accent};">${kind === "cancelled" ? "Booking cancelled by guest" : "Booking changed by guest"}</div>
      <pre style="margin:20px 0 0;white-space:pre-wrap;font:400 14px/1.7 ${SANS};color:${C.ink};">${esc(text)}</pre>
    </td></tr>`,
    lines[0],
  );
  return { subject, html, text };
}

/** Email 2 — notification to the café owner. */
export function ownerEmail(r: Reservation, submittedAt: Date, reference: string, sheet: SheetStatus): EmailContent {
  const v = displayValues(r);
  const sheetNote =
    sheet === "saved"
      ? "Saved to the Reservations Google Sheet."
      : sheet === "failed"
        ? "This request could NOT be saved to the Google Sheet. Please add it manually."
        : "";
  const subject = "New Table Reservation — Aurelia";
  const submitted = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: site.timeZone,
  }).format(submittedAt);
  const telDigits = r.phone.replace(/[^\d+]/g, "");

  const html = shell(
    `
      <tr><td style="padding:26px 40px;border-bottom:1px solid #E6E1D8;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font:500 22px/1 ${SERIF};letter-spacing:.34em;color:${C.ink};">${site.wordmark}</td>
          <td align="right"><span style="display:inline-block;border:1px solid #C9B79F;padding:6px 9px 5px;font:500 10px/1 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${C.accent};">Awaiting confirmation</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:40px 40px 8px;">
        <div style="font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accent};">New reservation request</div>
        <h1 style="margin:12px 0 0;font:300 34px/1.15 ${SERIF};color:${C.ink};">${esc(v.guests)} · ${esc(v.date)}, ${esc(v.time)}</h1>
        <p style="margin:18px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">A guest has requested a table through the website. ${sheet === "saved" ? "Set its Status to Confirmed or Declined in the Google Sheet to email the guest automatically, or contact them directly." : "Please contact them to confirm availability."} They have been told their table is not confirmed until they hear from you.</p>
        ${
          sheet === "failed"
            ? `<div style="margin-top:20px;padding:14px 16px;border:1px solid #D9A497;background:#FBEFEC;font:500 14px/1.6 ${SANS};color:#8A3B2B;">${esc(sheetNote)}</div>`
            : ""
        }
        <div style="margin:32px 0 6px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.muted};">Guest</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.ink};">
          ${rows([
            ["Full name", esc(r.name)],
            ["Email", `<a href="mailto:${esc(r.email)}" style="color:${C.ink};">${esc(r.email)}</a>`],
            ["Phone", `<a href="tel:${esc(telDigits)}" style="color:${C.ink};">${esc(r.phone)}</a>`],
          ])}
        </table>
        <div style="margin:28px 0 6px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.muted};">Reservation</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.ink};">
          ${rows([
            ["Reference", esc(reference)],
            ...(r.event ? ([["Event", esc(r.event)]] as [string, string][]) : []),
            ["Date", esc(v.date)],
            ["Preferred time", esc(v.time)],
            ["Guests", esc(v.guests)],
            ["Special requests", multiline(v.notes)],
            ["WhatsApp updates", r.whatsapp ? "Yes" : "No"],
            ["Submitted", `${esc(submitted)} IST`],
          ])}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 40px;"><tr>
          <td style="background:${C.ink};"><a href="mailto:${esc(r.email)}" style="display:inline-block;padding:15px 22px;font:500 11px/1 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${C.cream};text-decoration:none;">Reply to guest</a></td>
          <td style="width:10px;"></td>
          <td style="border:1px solid #BDB3A6;"><a href="tel:${esc(telDigits)}" style="display:inline-block;padding:14px 22px;font:500 11px/1 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${C.ink};text-decoration:none;">Call guest</a></td>
        </tr></table>
      </td></tr>
      <tr><td style="border-top:1px solid #E6E1D8;padding:22px 40px;font:400 12px/1.6 ${SANS};color:${C.muted};">
        Sent automatically by the reservation form on the Aurelia website. Replying to this email goes directly to the guest.${
          sheet === "saved" ? `<br>${esc(sheetNote)}` : ""
        }
      </td></tr>`,
    `${v.guests} on ${v.date} at ${v.time} — ${r.name}`,
  );

  const text = [
    "NEW RESERVATION REQUEST — awaiting confirmation",
    ...(sheet === "failed" ? ["", `!! ${sheetNote}`] : []),
    "",
    "GUEST",
    `Full name:        ${r.name}`,
    `Email:            ${r.email}`,
    `Phone:            ${r.phone}`,
    "",
    "RESERVATION",
    `Reference:        ${reference}`,
    ...(r.event ? [`Event:            ${r.event}`] : []),
    `Date:             ${v.date}`,
    `Preferred time:   ${v.time}`,
    `Guests:           ${v.guests}`,
    `Special requests: ${v.notes}`,
    `WhatsApp updates: ${r.whatsapp ? "Yes" : "No"}`,
    `Submitted:        ${submitted} IST`,
    "",
    "Please contact the guest to confirm availability. Replying to this email goes directly to the guest.",
    ...(sheet === "saved" ? [sheetNote] : []),
  ].join("\n");

  return { subject, html, text };
}
