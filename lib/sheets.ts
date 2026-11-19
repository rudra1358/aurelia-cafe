import "server-only";
import type { Reservation } from "./validation";

/**
 * - "saved":    the row was added to the Google Sheet
 * - "disabled": GOOGLE_SHEETS_WEBHOOK_URL is not set, so saving is switched off
 * - "failed":   saving was attempted but did not succeed (the owner email says so)
 */
export type SheetStatus = "saved" | "disabled" | "failed";

export interface SheetRow extends Reservation {
  reference: string;
  submittedAt: string; // "2026-11-19 18:42" in IST
}

const TIMEOUT_MS = 10_000;

/**
 * Appends the reservation to the owner's Google Sheet through the Apps Script web app
 * (scripts/google-apps-script.gs). Never throws: the emails are still sent if this fails.
 */
export async function saveReservationToSheet(row: SheetRow): Promise<SheetStatus> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!url) return "disabled";

  const secret = process.env.GOOGLE_SHEETS_SECRET?.trim();
  if (!secret) {
    console.error("[sheets] GOOGLE_SHEETS_SECRET is not set — skipping Google Sheets.");
    return "failed";
  }

  try {
    // Apps Script answers POST with a redirect to the result; fetch follows it.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, reservation: row }),
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let data: { ok?: boolean; error?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      // A non-JSON reply usually means the web app is not deployed with access "Anyone".
    }
    if (res.ok && data.ok) return "saved";
    console.error(`[sheets] Google Sheets did not accept the row (HTTP ${res.status}):`, data.error ?? text.slice(0, 200));
    return "failed";
  } catch (err) {
    console.error("[sheets] Could not reach Google Sheets:", err);
    return "failed";
  }
}
