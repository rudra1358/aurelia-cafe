import "server-only";
import { createHmac } from "node:crypto";
import { site } from "@/data/site";
import { safeEqual } from "./http";

/**
 * Signed "Manage booking" links: /booking/AUR-7KQ2XD?t=<token>.
 * The token is an HMAC of the reference, so only someone who received the guest email can open it.
 * Signed with BOOKING_LINK_SECRET, or GOOGLE_SHEETS_SECRET when that isn't set
 * (changing the secret invalidates links that were already sent).
 */
function signingKey(): string | null {
  return process.env.BOOKING_LINK_SECRET?.trim() || process.env.GOOGLE_SHEETS_SECRET?.trim() || null;
}

/** Managing a booking reads and updates the Google Sheet, so it needs the sheet to be set up. */
export function manageLinksEnabled(): boolean {
  return !!process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() && !!signingKey();
}

export function signReference(reference: string): string | null {
  const key = signingKey();
  if (!key) return null;
  return createHmac("sha256", key).update(`manage:${reference}`).digest("base64url").slice(0, 32);
}

export function verifyReference(reference: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = signReference(reference);
  return !!expected && safeEqual(expected, token);
}

/** Full "Manage booking" URL for emails, or null when managing online isn't available. */
export function manageUrl(reference: string): string | null {
  if (!manageLinksEnabled()) return null;
  const token = signReference(reference);
  return token ? `${site.url}/booking/${encodeURIComponent(reference)}?t=${token}` : null;
}

export const REFERENCE_RE = /^AUR-[A-Z2-9]{6}$/;
