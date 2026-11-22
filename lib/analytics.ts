/**
 * Privacy-friendly analytics (Vercel Web Analytics): no cookies, no personal data, visitors
 * aren't tracked across sites. Only page views and the two booking events below are sent.
 *
 * Never put a name, email, phone number, booking reference or token in an event.
 */
import { track, type BeforeSendEvent } from "@vercel/analytics";

export const ANALYTICS_EVENTS = {
  /** The visitor typed into the reservation form for the first time on this page view. */
  bookingStarted: "Booking started",
  /** The request was accepted by the server (it reached the café). */
  bookingRequested: "Booking requested",
} as const;

export function trackBookingStarted(): void {
  track(ANALYTICS_EVENTS.bookingStarted);
}

export function trackBookingRequested(details: { kind: "table" | "event"; guests: number; duplicate: boolean }): void {
  track(ANALYTICS_EVENTS.bookingRequested, details);
}

/**
 * Runs on every event before it leaves the browser. Manage-booking links look like
 * /booking/AUR-7KQ2XD?t=<signed token>: the reference and token must never reach analytics,
 * so those pages are reported as /booking/[reference]. Query strings and hashes are dropped
 * everywhere (they could carry an email link's parameters).
 */
export function scrubAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  try {
    const url = new URL(event.url);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/^\/booking\/[^/]+/, "/booking/[reference]");
    return { ...event, url: url.toString() };
  } catch {
    return { ...event, url: "" };
  }
}
