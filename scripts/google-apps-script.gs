/**
 * Aurelia — Reservations → Google Sheets
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * set SECRET below, then Deploy → New deployment → Web app.
 * Full steps: README.md → "Saving reservations to Google Sheets".
 */

// Must exactly match GOOGLE_SHEETS_SECRET in the website's .env.local
const SECRET = "PASTE_YOUR_SECRET_HERE";

const SHEET_NAME = "Reservations";
const HEADERS = [
  "Reference",
  "Submitted (IST)",
  "Status",
  "Name",
  "Email",
  "Phone",
  "Date",
  "Time",
  "Guests",
  "Special requests",
];
const STATUSES = ["Pending", "Confirmed", "Declined", "Cancelled", "Completed", "No-show"];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!SECRET || SECRET === "PASTE_YOUR_SECRET_HERE" || body.secret !== SECRET) {
      return respond({ ok: false, error: "unauthorized" });
    }
    const r = body.reservation;
    if (!r || !r.reference) return respond({ ok: false, error: "missing reservation" });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // avoid two simultaneous requests writing the same row
    try {
      const sheet = getSheet();
      sheet.appendRow([
        r.reference,
        r.submittedAt,
        "Pending",
        r.name,
        r.email,
        r.phone,
        r.date,
        r.time,
        Number(r.guests) || r.guests,
        r.notes || "",
      ].map(safe));
    } finally {
      lock.releaseLock();
    }
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

/** Visiting the web app URL in a browser shows this — useful to check the deployment works. */
function doGet() {
  return respond({ ok: true, service: "Aurelia reservations sheet" });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#F1EEE8");
    sheet.setFrozenRows(1);
    // Status column: dropdown the owner can update as bookings are handled.
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build();
    sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
    // Keep phone numbers and dates/times as plain text exactly as submitted.
    sheet.getRange(2, 6, sheet.getMaxRows() - 1, 3).setNumberFormat("@");
    sheet.setColumnWidths(1, HEADERS.length, 150);
    sheet.setColumnWidth(10, 320);
  }
  return sheet;
}

/** Stop text that starts with = + - @ being treated as a formula. */
function safe(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
