/**
 * POST /api/reservations, with the outside world (sheet, email, rate limits, Turnstile,
 * WhatsApp) mocked so the tests check only the route's own decisions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn() }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/whatsapp", () => ({ WHATSAPP_TEMPLATES: { ownerNewBooking: "owner_new_booking" }, whatsappOwner: vi.fn() }));
vi.mock("@/lib/sheets", () => ({ saveReservationToSheet: vi.fn(), markSheetGuestNotEmailed: vi.fn() }));
vi.mock("@/lib/mailer", () => {
  class MailConfigError extends Error {}
  return {
    MailConfigError,
    assertMailConfigured: vi.fn(),
    sendReservationEmails: vi.fn(),
    alertOwnerGuestNotEmailed: vi.fn(),
  };
});

import { after } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { markSheetGuestNotEmailed, saveReservationToSheet } from "@/lib/sheets";
import { MailConfigError, alertOwnerGuestNotEmailed, assertMailConfigured, sendReservationEmails } from "@/lib/mailer";
import { GET, POST } from "@/app/api/reservations/route";

const ORIGIN = "https://aurelia.example";

const booking = {
  name: "Asha Mehta",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  date: "2026-11-28",
  time: "19:30",
  guests: "2",
  notes: "",
  whatsapp: "",
  event: "",
  turnstileToken: "token",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/reservations`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "aurelia.example", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function send(body: unknown, headers?: Record<string, string>) {
  const res = await POST(post(body, headers));
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, res };
}

beforeEach(() => {
  // 23 Nov 2026, 12:00 in Ahmedabad (UTC+5:30).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T06:30:00Z"));

  vi.mocked(isRateLimited).mockResolvedValue(false);
  vi.mocked(verifyTurnstile).mockResolvedValue("ok");
  vi.mocked(assertMailConfigured).mockImplementation(() => {});
  vi.mocked(saveReservationToSheet).mockResolvedValue({ status: "saved" });
  vi.mocked(sendReservationEmails).mockResolvedValue({ owner: "Primary", guest: "Primary" } as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("POST /api/reservations: happy path", () => {
  it("saves, emails and returns a reference", async () => {
    const { status, body, res } = await send(booking);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, reference: expect.stringMatching(/^AUR-[A-HJ-NP-Z2-9]{6}$/) });
    expect(res.headers.get("cache-control")).toBe("no-store");

    expect(saveReservationToSheet).toHaveBeenCalledOnce();
    expect(vi.mocked(saveReservationToSheet).mock.calls[0][0]).toMatchObject({
      name: "Asha Mehta",
      guests: 2,
      reference: body.reference,
      submittedAt: "2026-11-23 12:00",
    });
    expect(sendReservationEmails).toHaveBeenCalledWith(
      expect.objectContaining({ email: "asha@example.com" }),
      expect.objectContaining({ reference: body.reference, sheet: "saved" }),
    );
    expect(after).toHaveBeenCalledOnce(); // owner WhatsApp alert, after the response
  });

  it("gives every booking a different reference", async () => {
    const a = await send(booking);
    const b = await send(booking);
    expect(a.body.reference).not.toBe(b.body.reference);
  });
});

describe("POST /api/reservations: request checks", () => {
  it("rejects a cross-site request", async () => {
    expect((await send(booking, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await send(booking, { origin: "https://evil.example" })).status).toBe(403);
  });

  it("rejects a body that isn't JSON", async () => {
    expect((await send(booking, { "content-type": "text/plain" })).status).toBe(415);
    expect((await send("{not json")).status).toBe(400);
    expect((await send("null")).status).toBe(400);
    expect((await send("")).status).toBe(400);
  });

  it("rejects an oversized body", async () => {
    expect((await send({ ...booking, notes: "x".repeat(20_000) })).status).toBe(400);
  });

  it("quietly accepts a bot that fills the honeypot, without saving anything", async () => {
    const { status, body } = await send({ ...booking, company: "Spam Inc" });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(saveReservationToSheet).not.toHaveBeenCalled();
    expect(sendReservationEmails).not.toHaveBeenCalled();
  });

  it("returns field errors for an invalid booking", async () => {
    const { status, body } = await send({ ...booking, email: "nope", date: "2026-11-22" });
    expect(status).toBe(422);
    expect(body).toEqual({
      ok: false,
      errors: { email: "Please enter a valid email address.", date: "Please choose today or a future date." },
    });
    expect(saveReservationToSheet).not.toHaveBeenCalled();
  });

  it("uses the café's clock for 'later today'", async () => {
    const { body } = await send({ ...booking, date: "2026-11-23", time: "11:45" });
    expect(body.errors).toEqual({ time: "Please choose a time later today." });
  });

  it.each(["missing", "invalid"] as const)("rejects a %s Turnstile token", async (result) => {
    vi.mocked(verifyTurnstile).mockResolvedValue(result);
    const { status, body } = await send(booking);
    expect(status).toBe(400);
    expect(body.turnstile).toBe(true);
    expect(saveReservationToSheet).not.toHaveBeenCalled();
  });

  it("lets the booking through when Turnstile is unreachable", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue("unavailable");
    expect((await send(booking)).status).toBe(200);
  });
});

describe("POST /api/reservations: rate limits", () => {
  it("limits by IP before validating", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);
    const { status } = await send({}, { "x-real-ip": "203.0.113.9" });
    expect(status).toBe(429);
    expect(isRateLimited).toHaveBeenCalledWith(expect.objectContaining({ name: "ip" }), "203.0.113.9");
  });

  it("limits by email and by the last 10 digits of the phone", async () => {
    vi.mocked(isRateLimited).mockImplementation(async (limit) => limit.name === "phone");
    const { status } = await send(booking);
    expect(status).toBe(429);
    expect(isRateLimited).toHaveBeenCalledWith(expect.objectContaining({ name: "email" }), "asha@example.com");
    expect(isRateLimited).toHaveBeenCalledWith(expect.objectContaining({ name: "phone" }), "9876543210");
    expect(saveReservationToSheet).not.toHaveBeenCalled();
  });
});

describe("POST /api/reservations: sheet and email outcomes", () => {
  it("returns 503 when email isn't configured", async () => {
    vi.mocked(assertMailConfigured).mockImplementation(() => {
      throw new MailConfigError("no SMTP");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await send(booking)).status).toBe(503);
    expect(saveReservationToSheet).not.toHaveBeenCalled();
  });

  it("returns the existing request for a duplicate, without emailing again", async () => {
    const existing = { reference: "AUR-AAAAAA", date: "2026-11-28", time: "19:00" };
    vi.mocked(saveReservationToSheet).mockResolvedValue({ status: "duplicate", existing });
    const { status, body } = await send(booking);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, duplicate: true, reference: "AUR-AAAAAA", existing });
    expect(sendReservationEmails).not.toHaveBeenCalled();
  });

  it("returns a time error when the slot is full", async () => {
    vi.mocked(saveReservationToSheet).mockResolvedValue({ status: "full" });
    const { status, body } = await send(booking);
    expect(status).toBe(422);
    expect((body.errors as Record<string, string>).time).toMatch(/fully booked/);
    expect(sendReservationEmails).not.toHaveBeenCalled();
  });

  it("returns 502 when the booking reached nobody", async () => {
    vi.mocked(saveReservationToSheet).mockResolvedValue({ status: "failed" });
    vi.mocked(sendReservationEmails).mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await send(booking);
    expect(status).toBe(502);
    expect(body.ok).toBe(false);
  });

  it("marks the sheet row when only the guest email failed", async () => {
    vi.mocked(sendReservationEmails).mockResolvedValue({ owner: "Primary", guest: null } as never);
    const { status, body } = await send(booking);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, emailFailed: true });
    expect(markSheetGuestNotEmailed).toHaveBeenCalledWith(body.reference);
    expect(alertOwnerGuestNotEmailed).not.toHaveBeenCalled();
  });

  it("emails the owner instead when the guest email failed and there's no sheet", async () => {
    vi.mocked(saveReservationToSheet).mockResolvedValue({ status: "disabled" });
    vi.mocked(sendReservationEmails).mockResolvedValue({ owner: "Primary", guest: null } as never);
    const { body } = await send(booking);
    expect(body).toMatchObject({ ok: true, emailFailed: true });
    expect(alertOwnerGuestNotEmailed).toHaveBeenCalledWith(expect.objectContaining({ name: "Asha Mehta" }), body.reference);
    expect(markSheetGuestNotEmailed).not.toHaveBeenCalled();
  });
});

describe("GET /api/reservations", () => {
  it("is not allowed", async () => {
    expect(GET().status).toBe(405);
  });
});
