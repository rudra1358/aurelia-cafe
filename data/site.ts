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

/**
 * Public URL used for SEO, Open Graph and the sitemap.
 * Uses NEXT_PUBLIC_SITE_URL when it is a real address; on Vercel it falls back to the
 * project's production domain (VERCEL_PROJECT_PRODUCTION_URL, set automatically by Vercel).
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const isLocal = !configured || /localhost|127\.0\.0\.1/.test(configured);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!isLocal) return configured!;
  if (vercel) return `https://${vercel}`;
  return configured || "http://localhost:3000";
}

export const site = {
  name: "Aurelia",
  wordmark: "AURELIA",
  tagline: "Good coffee. Good food. Good moments.",
  description:
    "Aurelia is a café in Sindhu Bhavan, Ahmedabad — thoughtfully crafted coffee, delightful flavors, and moments worth slowing down for. Request a table online.",
  url: resolveSiteUrl(),
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
    /** Requests are in steps of this many minutes from midnight (10:00, 10:15, 10:30 …). */
    slotMinutes: 15,
    /** Days closed every week: 0 = Sunday, 1 = Monday … 6 = Saturday. Example: [1] = closed on Mondays. */
    closedWeekdays: [] as number[],
    /**
     * Dates closed for holidays or private events (YYYY-MM-DD). Add `until` to close a range
     * of days (inclusive). The reason is shown to guests who pick that date.
     */
    blackoutDates: [
      // { date: "2027-01-26", reason: "Republic Day" },
      // { date: "2027-10-28", until: "2027-10-30", reason: "Diwali" },
    ] as { date: string; until?: string; reason?: string }[],
    /**
     * Online capacity, counted from the active rows in the Google Sheet (needs the sheet).
     * A request is turned away when the guests already booked within `windowMinutes`
     * of the chosen time, plus this party, would exceed `maxGuests`. Set to null to turn off.
     */
    capacity: { maxGuests: 30, windowMinutes: 30 } as { maxGuests: number; windowMinutes: number } | null,
    /**
     * A request is treated as a duplicate when the same email OR phone number already has an
     * active request on that date within this many minutes (so 7:00 and 7:15 count as one).
     */
    duplicateWindowMinutes: 60,
    /** Length of the calendar event attached to confirmation emails (.ics). */
    calendarMinutes: 90,
  },

  /**
   * Links shown in the "Find us online" strip of the Contact section and the footer.
   * OWNER TODO: fill in the real URLs. Anything left as null is simply not shown —
   * the site never invents a profile, rating or review.
   */
  online: {
    /** e.g. "https://www.instagram.com/aurelia.cafe/" */
    instagram: null as string | null,
    /** Google Maps / Business Profile reviews link, e.g. "https://g.page/r/…/review" */
    googleReviews: null as string | null,
    /** Restaurant page on Swiggy, e.g. "https://www.swiggy.com/restaurants/…" */
    swiggy: null as string | null,
    /** Restaurant page on Zomato, e.g. "https://www.zomato.com/ahmedabad/…" */
    zomato: null as string | null,
    /**
     * Google rating as shown on the Business Profile. Only set real, current numbers,
     * e.g. { value: 4.6, count: 312 }.
     */
    googleRating: null as { value: number; count: number } | null,
  },

  /**
   * Guest reviews shown on the home page. Only add real reviews, quoted word for word,
   * with the reviewer's permission (e.g. copied from Google reviews). Empty = section hidden.
   */
  testimonials: [
    // { quote: "…", author: "Priya S.", source: "Google review" },
  ] as { quote: string; author: string; source?: string }[],

  legal: {
    lastUpdated: "23 November 2026",
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
