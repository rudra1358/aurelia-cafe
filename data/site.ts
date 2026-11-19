/**
 * Central business configuration for Aurelia.
 *
 * Anything marked "OWNER TODO" has not been decided or provided yet.
 * Leave it as `null` until the real value is known — the UI handles nulls
 * gracefully and never invents a value.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export const site = {
  name: "Aurelia",
  wordmark: "AURELIA",
  tagline: "Good coffee. Good food. Good moments.",
  description:
    "Aurelia is a café in Sindhu Bhavan, Ahmedabad — thoughtfully crafted coffee, delightful flavors, and moments worth slowing down for. Request a table online.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "en_IN",
  timeZone: "Asia/Kolkata",

  /**
   * Portfolio / concept mode: shows a thin banner explaining the site is a concept with a working demo form.
   * Set `enabled: false` when the site is used for a real café.
   */
  demo: {
    enabled: true,
    author: "Rudra Patel",
    authorUrl: "https://github.com/rudra1358",
  },

  contact: {
    email: "rudra300806@gmail.com",
    phoneDisplay: "+91 8585858585",
    phoneE164: "+918585858585",
  },

  location: {
    area: "Sindhu Bhavan",
    city: "Ahmedabad",
    region: "Gujarat",
    country: "India",
    display: "Sindhu Bhavan, Ahmedabad, Gujarat, India",
    /** OWNER TODO: full street address of the café, e.g. "Shop 4, …, Sindhu Bhavan Road". */
    exactAddress: null as string | null,
    /** Exact storefront coordinates. Set to null to fall back to the general area. */
    coordinates: { lat: 23.037785, lng: 72.509667 } as Coordinates | null,
    /** Used for the map and directions while exact coordinates are unknown. */
    areaQuery: "Sindhu Bhavan Road, Ahmedabad, Gujarat, India",
  },

  hours: {
    /** 24-hour times. "24:00" means midnight at the end of the day. */
    open: "10:00",
    close: "24:00",
    display: "10:00 am – 12:00 am (midnight)",
    /** Latest time a table can be requested online. */
    lastReservation: "23:30",
  },

  reservations: {
    /** Largest party that can be requested online; larger groups are asked to call. */
    maxGuests: 10,
    maxNotesLength: 500,
    /** How far ahead a request may be made (catches typos such as year 2062). */
    maxDaysAhead: 365,
  },

  legal: {
    lastUpdated: "19 November 2026",
    /** OWNER TODO: e.g. "Vercel". Shown in the Privacy Policy. */
    hostingProvider: null as string | null,
    /** OWNER TODO: e.g. "6 months after your visit". */
    retentionPeriod: null as string | null,
    /** Shown in the Terms, on the reservation form and in the guest's email. */
    cancellationPolicy:
      "There is no charge for cancelling or changing a reservation — please just let us know as early as you can." as string | null,
    lateArrivalPolicy:
      "If you arrive more than 30 minutes after your reserved time, a late-arrival charge of 5% of your final bill applies." as string | null,
    /** false = taxes are charged in addition to menu prices. */
    pricesIncludeTax: false as boolean | null,
    /** Set to false once the Privacy Policy and Terms have been reviewed and approved. */
    showDraftNotice: true,
  },
};

export const mailtoHref = `mailto:${site.contact.email}`;
export const telHref = `tel:${site.contact.phoneE164}`;

/** Where the map is centred: exact coordinates if configured, otherwise the area search. */
function mapTarget(): string {
  const c = site.location.coordinates;
  return c ? `${c.lat},${c.lng}` : site.location.areaQuery;
}

/** Keyless Google Maps embed URL. */
export function mapEmbedUrl(): string {
  const zoom = site.location.coordinates ? 17 : 15;
  return `https://www.google.com/maps?q=${encodeURIComponent(mapTarget())}&z=${zoom}&output=embed`;
}

export function directionsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapTarget())}`;
}

/** True once the owner has supplied the exact storefront location. */
export const hasExactLocation = site.location.coordinates !== null;
