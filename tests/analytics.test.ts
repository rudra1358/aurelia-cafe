import { describe, expect, it } from "vitest";
import { scrubAnalyticsEvent } from "@/lib/analytics";

const scrub = (url: string) => scrubAnalyticsEvent({ type: "pageview", url }).url;

describe("scrubAnalyticsEvent", () => {
  it("hides the booking reference and token on manage-booking pages", () => {
    expect(scrub("https://aurelia.example/booking/AUR-7KQ2XD?t=secret.token")).toBe(
      "https://aurelia.example/booking/[reference]",
    );
    expect(scrub("https://aurelia.example/booking/AUR-7KQ2XD/")).toBe("https://aurelia.example/booking/[reference]/");
  });

  it("drops query strings and hashes everywhere", () => {
    expect(scrub("https://aurelia.example/?event=sample-acoustic-2026-11-27#reservation")).toBe("https://aurelia.example/");
    expect(scrub("https://aurelia.example/events?utm_source=whatsapp")).toBe("https://aurelia.example/events");
  });

  it("leaves other paths alone", () => {
    expect(scrub("https://aurelia.example/privacy-policy")).toBe("https://aurelia.example/privacy-policy");
  });

  it("blanks a URL it can't parse rather than sending it", () => {
    expect(scrub("not a url")).toBe("");
  });

  it("keeps custom event data", () => {
    const event = { type: "event" as const, url: "https://aurelia.example/?x=1", name: "Booking requested" };
    expect(scrubAnalyticsEvent(event as never)).toMatchObject({ name: "Booking requested", url: "https://aurelia.example/" });
  });
});
