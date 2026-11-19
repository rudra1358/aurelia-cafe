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

function displayValues(r: Reservation) {
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

/** Email 1 — acknowledgement to the customer. */
export function customerEmail(r: Reservation, reference: string): EmailContent {
  const v = displayValues(r);
  const subject = "Your Reservation Request at Aurelia";

  const html = shell(
    `
      <tr><td align="center" style="background:${C.dark};padding:40px 48px;">
        <div style="font:500 30px/1 ${SERIF};letter-spacing:.36em;color:${C.cream};padding-left:.36em;">${site.wordmark}</div>
        <div style="margin-top:10px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accentLight};">${esc(site.location.area)} · ${esc(site.location.city)}</div>
      </td></tr>
      <tr><td style="padding:48px 48px 8px;">
        <div style="font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.accent};">Request received</div>
        <h1 style="margin:14px 0 0;font:300 38px/1.1 ${SERIF};color:${C.ink};">Thank you, ${esc(r.name)}.</h1>
        <p style="margin:24px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">We’ve received your reservation request at Aurelia. Our team will contact you shortly to confirm availability.</p>
        <div style="margin-top:24px;padding:16px 18px;border:1px solid #D9CDBD;background:${C.cream};font:400 14px/1.6 ${SANS};color:${C.ink};">
          <strong style="font-weight:600;">Please note:</strong> this is not yet a confirmed booking. Your table is confirmed only once we contact you.
        </div>
        <div style="margin:40px 0 6px;font:500 11px/1 ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.muted};">Your request</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.ink};">
          ${rows([
            ["Reference", esc(reference)],
            ["Name", esc(r.name)],
            ["Date", esc(v.date)],
            ["Time", esc(v.time)],
            ["Guests", esc(v.guests)],
            ["Special requests", multiline(v.notes)],
          ])}
        </table>
        ${policyLines().length ? `<p style="margin:32px 0 0;font:400 14px/1.7 ${SANS};color:${C.muted};">${policyLines().map(esc).join("<br>")}</p>` : ""}
        <p style="margin:24px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">If anything changes, simply reply to this email or call us on <a href="tel:${site.contact.phoneE164}" style="color:${C.accent};">${site.contact.phoneDisplay}</a>.</p>
        <p style="margin:28px 0 40px;font:italic 400 22px/1.4 ${SERIF};color:${C.ink};">We look forward to welcoming you.<br>— The Aurelia team</p>
      </td></tr>
      <tr><td align="center" style="border-top:1px solid #E6E1D8;padding:28px 48px;font:400 12px/1.7 ${SANS};color:${C.muted};">
        ${site.name} · ${esc(site.location.display)}<br>
        <a href="mailto:${site.contact.email}" style="color:${C.accent};">${site.contact.email}</a> · <a href="tel:${site.contact.phoneE164}" style="color:${C.accent};">${site.contact.phoneDisplay}</a><br>
        You received this email because a reservation request was made with this address on our website.
      </td></tr>`,
    "We’ve received your reservation request — our team will contact you to confirm availability.",
  );

  const text = [
    `Thank you, ${r.name}.`,
    "",
    "We've received your reservation request at Aurelia. Our team will contact you shortly to confirm availability.",
    "",
    "PLEASE NOTE: this is not yet a confirmed booking. Your table is confirmed only once we contact you.",
    "",
    "YOUR REQUEST",
    `Reference:        ${reference}`,
    `Name:             ${r.name}`,
    `Date:             ${v.date}`,
    `Time:             ${v.time}`,
    `Guests:           ${v.guests}`,
    `Special requests: ${v.notes}`,
    "",
    ...(policyLines().length ? [...policyLines(), ""] : []),
    `If anything changes, reply to this email or call us on ${site.contact.phoneDisplay}.`,
    "",
    "We look forward to welcoming you.",
    "— The Aurelia team",
    "",
    `${site.name} · ${site.location.display}`,
    `${site.contact.email} · ${site.contact.phoneDisplay}`,
  ].join("\n");

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
        <p style="margin:18px 0 0;font:400 15px/1.7 ${SANS};color:${C.body};">A guest has requested a table through the website. Please contact them to confirm availability — they have been told their table is not confirmed until they hear from you.</p>
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
            ["Date", esc(v.date)],
            ["Preferred time", esc(v.time)],
            ["Guests", esc(v.guests)],
            ["Special requests", multiline(v.notes)],
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
    `Date:             ${v.date}`,
    `Preferred time:   ${v.time}`,
    `Guests:           ${v.guests}`,
    `Special requests: ${v.notes}`,
    `Submitted:        ${submitted} IST`,
    "",
    "Please contact the guest to confirm availability. Replying to this email goes directly to the guest.",
    ...(sheet === "saved" ? [sheetNote] : []),
  ].join("\n");

  return { subject, html, text };
}
