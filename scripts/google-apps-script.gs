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
 *  - Skips duplicate requests (same email + date + time that is still active).
 *  - Lets the website mark a row "Email failed" if the emails could not be sent.
 *  - Two requests at the same moment are serialised with LockService.
 *  - archiveOldReservations(): moves past years' rows into "Archive <year>" tabs.
 */

// Must exactly match GOOGLE_SHEETS_SECRET in the website's environment variables.
const SECRET = "PASTE_YOUR_SECRET_HERE";

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
};
const HEADERS = Object.keys(COLUMNS).map(function (k) { return COLUMNS[k]; });
const STATUSES = ["Pending", "Confirmed", "Declined", "Cancelled", "Completed", "No-show", "Email failed"];
/** Rows with these statuses don't block a new request for the same email/date/time. */
const INACTIVE = ["Declined", "Cancelled", "Email failed"];
/** How many recent rows to check for duplicates (keeps it fast on big sheets). */
const DUPLICATE_SCAN_ROWS = 500;

// ───────────────────────── Web app entry points ─────────────────────────

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return respond({ ok: false, error: "invalid json" });
  }
  if (!SECRET || SECRET === "PASTE_YOUR_SECRET_HERE" || body.secret !== SECRET) {
    return respond({ ok: false, error: "unauthorized" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // serialise simultaneous submissions
  } catch (err) {
    return respond({ ok: false, error: "busy, try again" });
  }

  try {
    if (body.action === "markEmailFailed") return respond(markEmailFailed(String(body.reference || "")));
    return respond(addReservation(body.reservation));
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

function addReservation(r) {
  if (!r || !r.reference) return { ok: false, error: "missing reservation" };

  const sheet = getSheet();
  const cols = columnIndex(sheet);

  const existing = findActiveDuplicate(sheet, cols, r);
  if (existing) return { ok: true, duplicate: true, reference: existing };

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
  };
  Object.keys(values).forEach(function (k) {
    row[cols[k] - 1] = safe(values[k]);
  });
  sheet.appendRow(row);
  return { ok: true, duplicate: false, reference: r.reference };
}

function markEmailFailed(reference) {
  if (!reference) return { ok: false, error: "missing reference" };
  const sheet = getSheet();
  const cols = columnIndex(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false, error: "not found" };
  const refs = sheet.getRange(2, cols.reference, last - 1, 1).getDisplayValues();
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i][0] === reference) {
      sheet.getRange(i + 2, cols.status).setValue("Email failed");
      return { ok: true };
    }
  }
  return { ok: false, error: "not found" };
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
  formatColumns(sheet, cols);
  return cols;
}

/** Status dropdown + plain-text phone/date/time, applied by column name. */
function formatColumns(sheet, cols) {
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const statusRange = sheet.getRange(2, cols.status, rows, 1);
  if (!statusRange.getDataValidation()) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build();
    statusRange.setDataValidation(rule);
  }
  [cols.phone, cols.date, cols.time].forEach(function (c) {
    const r = sheet.getRange(2, c, rows, 1);
    if (r.getNumberFormat() !== "@") r.setNumberFormat("@");
  });
}

/** Returns the Reference of a still-active row with the same email + date + time, or "". */
function findActiveDuplicate(sheet, cols, r) {
  const last = sheet.getLastRow();
  if (last < 2) return "";
  const start = Math.max(2, last - DUPLICATE_SCAN_ROWS + 1);
  const n = last - start + 1;
  const get = function (c) { return sheet.getRange(start, c, n, 1).getDisplayValues(); };
  const refs = get(cols.reference), emails = get(cols.email), dates = get(cols.date), times = get(cols.time), statuses = get(cols.status);
  const email = String(r.email).trim().toLowerCase();
  for (let i = n - 1; i >= 0; i--) {
    if (
      emails[i][0].trim().toLowerCase() === email &&
      dates[i][0] === String(r.date) &&
      times[i][0] === String(r.time) &&
      INACTIVE.indexOf(statuses[i][0]) === -1
    ) {
      return refs[i][0];
    }
  }
  return "";
}

/** Stop text that starts with = + - @ being treated as a formula. */
function safe(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
