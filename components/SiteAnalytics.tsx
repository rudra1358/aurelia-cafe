"use client";

import { Analytics } from "@vercel/analytics/next";
import { scrubAnalyticsEvent } from "@/lib/analytics";

/**
 * Vercel Web Analytics, production only (in development the package loads a debug script
 * from another domain, which the Content Security Policy blocks anyway).
 * Turn it on in the Vercel dashboard: Project → Analytics → Enable.
 */
export default function SiteAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return <Analytics beforeSend={scrubAnalyticsEvent} />;
}
