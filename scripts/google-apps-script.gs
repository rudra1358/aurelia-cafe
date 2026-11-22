/**
 * Aurelia — Reservations → Google Sheets
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * set SECRET below, then Deploy → New deployment → Web app
 * (or, when updating: Deploy → Manage deployments → ✏️ → New version).
 * Full steps: README.md → "Google Sheets setup".
 *
 * What it handles:
 *  - Writes each value under its column NAME, so the owner can reorder columns safely
 *    (renamed/deleted required columns are re-created at the end of the header row).
 *  - Skips duplicate requests: the same email OR phone with an active request on that date
 *    within an hour (the website sends the window, see data/site.ts → duplicateWindowMinutes).
 *  - Turns a request away when that time is full (data/site.ts → capacity), counting the
 *    guests of active rows on the same date.
 *  - Lets the website mark a row "Guest not emailed" if the guest's confirmation email failed.
 *  - Two requests at the same moment are serialised with LockService.
 *  - Lets the guest's "Manage booking" page look up, change or cancel their booking.
 *  - Emails the guest when you change Status to Confirmed, Declined or Cancelled (onStatusEdit),
 *    and sends a reminder the day before a Confirmed booking (sendReminders) — both through the
 *    website, so emails, calendar invites and WhatsApp all come from one place.
 *    Run installTriggers() ONCE from the editor to switch these on.
 *  - archiveOldReservations(): moves past years' rows into "Archive <year>" tabs.
 */

// Must exactly match GOOGLE_SHEETS_SECRET in the website's environment variables.
// Paste it here in the Apps Script editor only — never commit the real value to git.
const SECRET = "PASTE_YOUR_SECRET_HERE";
const PLACEHOLDER_SECRET = "PASTE_YOUR_SECRET_HERE";

// The live website address, without a trailing slash — e.g. "https://aurelia-cafe.vercel.app".
// Used to send the status-change and reminder emails.
const SITE_URL = "PASTE_YOUR_SITE_URL_HERE";

// Café time zone, used to work out "tomorrow" for reminders.
const TIME_ZONE = "Asia/Kolkata";
// Reminders go out for tomorrow's Confirmed bookings, between these hours (café time).
const REMINDER_FROM_HOUR = 10;
const REMINDER_UNTIL_HOUR = 21;
// Changing Status to one of these emails the guest.
const NOTIFY_STATUSES = ["Confirmed", "Declined", "Cancelled"];

const SHEET_NAME = "Reservations";
const COLUMNS = {
  reference: "Reference",
  submittedAt: "Submitted (IST)",
  status: "Status",
  name: "Name",
  email: "Email",
  phone: "Phone",
  date: "Date",
  time: "Time",
  guests: "Guests",
  notes: "Special requests",
  event: "Event",
  whatsapp: "WhatsApp",
  guestNotified: "Guest notified",
  reminderSent: "Reminder sent",
};
const HEADERS = Object.keys(COLUMNS).map(function (k) { return COLUMNS[k]; });
const STATUSES = ["Pending", "Guest not emailed", "Confirmed", "Declined", "Cancelled", "Completed", "No-show", "Email failed"];
/**
 * Rows with these statuses don't count as duplicates or towards capacity.
 * ("Email failed" is from older versions of this script; "Guest not emailed" is still an active booking.)
 */
const INACTIVE = ["Declined", "Cancelled", "Email failed"];
/** After these, the guest can't change or cancel online (the website sends the same list). */
const CLOSED = ["Declined", "Cancelled", "Completed", "No-show", "Email failed"];
/** How many recent rows to check for duplicates and capacity (keeps it fast; use the yearly archive). */
const SCAN_ROWS = 5000;

// ───────────────────────── Web app entry points ─────────────────────────

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return respond({ ok: false, error: "invalid json" });
  }
  if (!SECRET || SECRET === PLACEHOLDER_SECRET || body.secret !== SECRET) {
    return respond({ ok: false, error: "unauthorized" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // serialise simultaneous submissions
  } catch (err) {
    return respond({ ok: false, error: "busy, try again" });
  }

  try {
    if (body.action === "markGuestNotEmailed" || body.action === "markEmailFailed") {
      return respond(markGuestNotEmailed(String(body.reference || "")));
    }
    if (body.action === "get") return respond(getBooking(String(body.reference || "")));
    if (body.action === "cancel") return respond(guestCancel(String(body.reference || ""), body.closedStatuses));
    if (body.action === "change") return respond(guestChange(body, body.rules || {}));
    return respond(addReservation(body.reservation, body.rules || {}));
  } catch (err) {
    console.error(err);
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Visiting the web app URL in a browser shows this — useful to check the deployment works. */
function doGet() {
  return respond({ ok: true, service: "Aurelia reservations sheet" });
}

// ───────────────────────── Actions ─────────────────────────

/**
 * rules (sent by the website):
 *   duplicateWindowMinutes: number          — same email/phone within this many minutes = duplicate
 *   capacity: { maxGuests, windowMinutes }  — or null for no limit
 */
function addReservation(r, rules) {
  if (!r || !r.reference) return { ok: false, error: "missing reservation" };

  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const sameDay = activeRowsOn(sheet, cols, String(r.date));
  const minutes = toMinutes(String(r.time));

  // 1. Duplicate: same guest (email or phone) close to the same time.
  const dupWindow = Number(rules.duplicateWindowMinutes) || 0;
  const email = String(r.email).trim().toLowerCase();
  const phone = phoneKey(r.phone);
  for (let i = sameDay.length - 1; i >= 0; i--) {
    const row = sameDay[i];
    const sameGuest = row.email === email || (phone && row.phone === phone);
    if (sameGuest && row.minutes !== null && Math.abs(row.minutes - minutes) <= dupWindow) {
      return { ok: true, duplicate: true, reference: row.reference, date: String(r.date), time: row.time };
    }
  }

  // 2. Capacity: guests already booked near this time, plus this party.
  if (isFull(sameDay, minutes, Number(r.guests) || 0, rules.capacity)) return { ok: true, full: true };

  const row = new Array(sheet.getLastColumn()).fill("");
  const values = {
    reference: r.reference,
    submittedAt: r.submittedAt,
    status: "Pending",
    name: r.name,
    email: r.email,
    phone: r.phone,
    date: r.date,
    time: r.time,
    guests: Number(r.guests) || r.guests,
    notes: r.notes || "",
    event: r.event || "",
    whatsapp: r.whatsapp ? "Yes" : "No",
  };
  Object.keys(values).forEach(function (k) {
    row[cols[k] - 1] = safe(values[k]);
  });
  sheet.appendRow(row);
  return { ok: true, duplicate: false, reference: r.reference };
}

function markGuestNotEmailed(reference) {
  if (!reference) return { ok: false, error: "missing reference" };
  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false, error: "not found" };
  const refs = sheet.getRange(2, cols.reference, last - 1, 1).getDisplayValues();
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i][0] === reference) {
      sheet.getRange(i + 2, cols.status).setValue("Guest not emailed");
      return { ok: true };
    }
  }
  return { ok: false, error: "not found" };
}

/** Guests booked within the capacity window of `minutes`, plus this party, over the limit? */
function isFull(rows, minutes, guests, cap) {
  if (!cap || !(Number(cap.maxGuests) > 0)) return false;
  const windowMinutes = Math.max(Number(cap.windowMinutes) || 0, 1);
  let booked = 0;
  rows.forEach(function (row) {
    if (row.minutes !== null && Math.abs(row.minutes - minutes) < windowMinutes) booked += row.guests;
  });
  return booked + guests > Number(cap.maxGuests);
}

/** 1-based sheet row of a reference (most recent match), or 0. */
function findRow(sheet, cols, reference) {
  const last = sheet.getLastRow();
  if (!reference || last < 2) return 0;
  const refs = sheet.getRange(2, cols.reference, last - 1, 1).getDisplayValues();
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i][0] === reference) return i + 2;
  }
  return 0;
}

/** One row as a booking object (as the website expects it). */
function readBooking(sheet, cols, row) {
  const width = sheet.getLastColumn();
  const v = sheet.getRange(row, 1, 1, width).getDisplayValues()[0];
  const get = function (key) { return String(v[cols[key] - 1] || "").trim(); };
  return {
    reference: get("reference"),
    status: get("status") || "Pending",
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    date: get("date"),
    time: get("time"),
    guests: parseInt(get("guests"), 10) || 0,
    notes: get("notes"),
    event: get("event"),
    whatsapp: /^(yes|true|y)$/i.test(get("whatsapp")),
    guestNotified: get("guestNotified"),
    reminderSent: get("reminderSent"),
  };
}

function getBooking(reference) {
  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const row = findRow(sheet, cols, reference);
  if (!row) return { ok: false, error: "not found" };
  return { ok: true, booking: readBooking(sheet, cols, row) };
}

function guestCancel(reference, closedStatuses) {
  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const row = findRow(sheet, cols, reference);
  if (!row) return { ok: false, error: "not found" };
  const closed = closedStatuses || CLOSED;
  const current = readBooking(sheet, cols, row);
  if (closed.indexOf(current.status) !== -1) return { ok: false, error: "closed" };
  sheet.getRange(row, cols.status).setValue("Cancelled");
  // Edits made by a script don't fire onStatusEdit, so the guest isn't emailed twice.
  sheet.getRange(row, cols.guestNotified).setValue("Cancelled (by guest online)");
  return { ok: true, booking: readBooking(sheet, cols, row) };
}

/** The guest picked a new date / time / number of guests: back to Pending for the owner to confirm. */
function guestChange(body, rules) {
  const reference = String(body.reference || "");
  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const row = findRow(sheet, cols, reference);
  if (!row) return { ok: false, error: "not found" };
  const closed = body.closedStatuses || CLOSED;
  const current = readBooking(sheet, cols, row);
  if (closed.indexOf(current.status) !== -1) return { ok: false, error: "closed" };

  const date = String(body.date || "");
  const time = String(body.time || "");
  const guests = Number(body.guests) || 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toMinutes(time) === null || guests < 1) return { ok: false, error: "invalid change" };

  const others = activeRowsOn(sheet, cols, date, reference);
  if (isFull(others, toMinutes(time), guests, rules.capacity)) return { ok: true, full: true };

  sheet.getRange(row, cols.date).setValue(date);
  sheet.getRange(row, cols.time).setValue(time);
  sheet.getRange(row, cols.guests).setValue(guests);
  sheet.getRange(row, cols.status).setValue("Pending");
  sheet.getRange(row, cols.guestNotified).setValue("");
  sheet.getRange(row, cols.reminderSent).setValue("");
  const note = "Changed online " + Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm") +
    " (was " + current.date + " " + current.time + ", " + current.guests + " guests)";
  sheet.getRange(row, cols.reference).setNote(note);
  return { ok: true, booking: readBooking(sheet, cols, row) };
}

// ───────────────────────── Guest emails: status changes & reminders ─────────────────────────

/**
 * Installable "On edit" trigger (set up by installTriggers). When the owner changes Status to
 * Confirmed, Declined or Cancelled, the website emails the guest (and WhatsApps them if they
 * opted in). The "Guest notified" column records what was sent, so re-selecting the same status
 * doesn't email twice; if sending fails it says so — pick the status again to retry.
 */
function onStatusEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  const cols = columnIndex(sheet);
  const first = e.range.getColumn();
  const lastCol = first + e.range.getNumColumns() - 1;
  if (cols.status < first || cols.status > lastCol) return;

  const startRow = Math.max(e.range.getRow(), 2);
  const endRow = e.range.getRow() + e.range.getNumRows() - 1;
  if (endRow - startRow > 50) return; // a big paste or sort — don't email everyone
  for (let row = startRow; row <= endRow; row++) {
    const b = readBooking(sheet, cols, row);
    if (!b.reference || NOTIFY_STATUSES.indexOf(b.status) === -1) continue;
    if (b.guestNotified.indexOf(b.status) === 0) continue; // already told the guest this
    const result = callWebsite({ event: "status", status: b.status, booking: b });
    sheet.getRange(row, cols.guestNotified).setValue(describe(b.status, result));
  }
}

/**
 * Time-driven trigger, every hour (set up by installTriggers). Between REMINDER_FROM_HOUR and
 * REMINDER_UNTIL_HOUR, sends a reminder for each Confirmed booking dated tomorrow that hasn't
 * had one, and fills in "Reminder sent".
 */
function sendReminders() {
  const now = new Date();
  const hour = Number(Utilities.formatDate(now, TIME_ZONE, "H"));
  if (hour < REMINDER_FROM_HOUR || hour > REMINDER_UNTIL_HOUR) return;
  const tomorrow = Utilities.formatDate(new Date(now.getTime() + 24 * 60 * 60 * 1000), TIME_ZONE, "yyyy-MM-dd");

  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const start = Math.max(2, last - SCAN_ROWS + 1);
  const n = last - start + 1;
  const dates = sheet.getRange(start, cols.date, n, 1).getDisplayValues();
  const statuses = sheet.getRange(start, cols.status, n, 1).getDisplayValues();
  const sent = sheet.getRange(start, cols.reminderSent, n, 1).getDisplayValues();

  let count = 0;
  for (let i = 0; i < n && count < 40; i++) {
    if (dates[i][0] !== tomorrow || statuses[i][0].trim() !== "Confirmed" || sent[i][0]) continue;
    const row = start + i;
    const result = callWebsite({ event: "reminder", booking: readBooking(sheet, cols, row) });
    if (result.ok) {
      sheet.getRange(row, cols.reminderSent).setValue(Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm") + channels(result));
    } else {
      console.error("Reminder failed for row " + row + ": " + result.error); // retried next hour
    }
    count++;
  }
}

function callWebsite(payload) {
  if (!SITE_URL || SITE_URL === "PASTE_YOUR_SITE_URL_HERE") return { ok: false, error: "SITE_URL is not set in the Apps Script" };
  payload.secret = SECRET;
  try {
    const res = UrlFetchApp.fetch(SITE_URL.replace(/\/+$/, "") + "/api/notify", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true,
    });
    const text = res.getContentText();
    try {
      return JSON.parse(text);
    } catch (err) {
      return { ok: false, error: "HTTP " + res.getResponseCode() + ": " + text.slice(0, 120) };
    }
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 160) };
  }
}

function channels(result) {
  const list = [];
  if (result.email) list.push("email");
  if (result.whatsapp) list.push("WhatsApp");
  return list.length ? " (" + list.join(" + ") + ")" : "";
}

function describe(status, result) {
  const when = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm");
  if (result.ok) return status + " · " + when + channels(result);
  return "NOT SENT (" + status + "): " + (result.error || "unknown error") + " — select the status again to retry";
}

/**
 * Run ONCE from the editor (▶ Run → installTriggers) and allow the permissions it asks for.
 * Sets up: status-change emails (on edit), hourly reminders, and the yearly archive.
 * Safe to run again — it replaces its own triggers.
 */
function installTriggers() {
  const ours = ["onStatusEdit", "sendReminders", "archiveOldReservations"];
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return ours.indexOf(t.getHandlerFunction()) !== -1; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onStatusEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("sendReminders").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("archiveOldReservations").timeBased().onMonthDay(1).atHour(1).create();
  columnIndex(getSheet()); // adds any new columns now
}

// ───────────────────────── Yearly archive ─────────────────────────

/**
 * Moves every row whose reservation Date is in a previous year to an "Archive <year>" tab.
 * Run it from the Apps Script editor (▶ Run), or call installYearlyArchive() once
 * to run it automatically every 1 January.
 */
function archiveOldReservations() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet();
    const cols = columnIndex(sheet);
    const last = sheet.getLastRow();
    if (last < 2) return;

    const width = sheet.getLastColumn();
    const header = sheet.getRange(1, 1, 1, width).getValues()[0];
    const data = sheet.getRange(2, 1, last - 1, width).getValues();
    const display = sheet.getRange(2, cols.date, last - 1, 1).getDisplayValues();
    const thisYear = new Date().getFullYear();

    const keep = [];
    const byYear = {};
    data.forEach(function (row, i) {
      const year = parseInt(String(display[i][0]).slice(0, 4), 10);
      if (year && year < thisYear) (byYear[year] = byYear[year] || []).push(row);
      else keep.push(row);
    });

    const years = Object.keys(byYear);
    if (years.length === 0) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    years.forEach(function (year) {
      const name = "Archive " + year;
      const archive = ss.getSheetByName(name) || ss.insertSheet(name);
      if (archive.getLastRow() === 0) {
        archive.getRange(1, 1, 1, width).setValues([header]).setFontWeight("bold");
        archive.setFrozenRows(1);
      }
      const rows = byYear[year];
      archive.getRange(archive.getLastRow() + 1, 1, rows.length, width).setValues(rows);
    });

    // Rewrite the main tab with only the rows we keep.
    sheet.getRange(2, 1, last - 1, width).clearContent();
    if (keep.length) sheet.getRange(2, 1, keep.length, width).setValues(keep);
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor to archive automatically every 1 January at ~1 am. */
function installYearlyArchive() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === "archiveOldReservations"; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("archiveOldReservations").timeBased().onMonthDay(1).atHour(1).create();
  // Monthly trigger; the function only moves rows from previous years, so it does real work in January.
}

// ───────────────────────── Helpers ─────────────────────────

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#F1EEE8");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 150);
    sheet.setColumnWidth(HEADERS.length, 320);
  }
  return sheet;
}

/**
 * Maps each field to its 1-based column by header NAME, so reordered columns still work.
 * A required header that was renamed or deleted is added back at the end of row 1.
 */
function columnIndex(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const cols = {};
  Object.keys(COLUMNS).forEach(function (key) {
    let idx = header.indexOf(COLUMNS[key].toLowerCase()) + 1;
    if (idx === 0) {
      idx = sheet.getLastColumn() + 1;
      sheet.getRange(1, idx).setValue(COLUMNS[key]).setFontWeight("bold");
      header.push(COLUMNS[key].toLowerCase());
    }
    cols[key] = idx;
  });
  // Formatting is a convenience. If the tab has been turned into a Google Sheets *table*
  // ("typed columns"), Google refuses these changes. Never let that block a booking.
  try {
    formatColumns(sheet, cols);
  } catch (err) {
    console.warn("Skipped column formatting: " + err + " — if this tab is a table, use Table menu → Convert to range.");
  }
  return cols;
}

/** Status dropdown + plain-text phone/date/time, applied by column name. */
function formatColumns(sheet, cols) {
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const statusRange = sheet.getRange(2, cols.status, rows, 1);
  const current = statusRange.getDataValidation();
  const list =
    current && current.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST
      ? current.getCriteriaValues()[0]
      : null;
  // Create the dropdown, or add statuses from a newer script version without removing the owner's own.
  const missing = STATUSES.filter(function (s) { return !list || list.indexOf(s) === -1; });
  if (!list || missing.length) {
    const values = (list || []).concat(missing);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build();
    statusRange.setDataValidation(rule);
  }
  [cols.phone, cols.date, cols.time, cols.guestNotified, cols.reminderSent].forEach(function (c) {
    const r = sheet.getRange(2, c, rows, 1);
    if (r.getNumberFormat() !== "@") r.setNumberFormat("@");
  });
}

/** Active rows (status not in INACTIVE) whose Date is `date`, from the most recent SCAN_ROWS rows. */
function activeRowsOn(sheet, cols, date, excludeReference) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - SCAN_ROWS + 1);
  const n = last - start + 1;
  const get = function (c) { return sheet.getRange(start, c, n, 1).getDisplayValues(); };
  const dates = get(cols.date);
  const refs = get(cols.reference), emails = get(cols.email), phones = get(cols.phone);
  const times = get(cols.time), guests = get(cols.guests), statuses = get(cols.status);
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (dates[i][0] !== date || INACTIVE.indexOf(statuses[i][0].trim()) !== -1) continue;
    if (excludeReference && refs[i][0] === excludeReference) continue;
    rows.push({
      reference: refs[i][0],
      email: emails[i][0].trim().toLowerCase(),
      phone: phoneKey(phones[i][0]),
      time: times[i][0],
      minutes: toMinutes(times[i][0]),
      guests: parseInt(guests[i][0], 10) || 0,
    });
  }
  return rows;
}

/** "19:30" → 1170, or null if the cell isn't a time. */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Last 10 digits, so "+91 98765 43210" and "098765-43210" match. "" if too short. */
function phoneKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** Stop text that starts with = + - @ being treated as a formula. */
function safe(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
