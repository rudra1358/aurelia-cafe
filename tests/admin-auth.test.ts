import { afterEach, describe, expect, it, vi } from "vitest";
import { adminSetup, checkPassword, createSessionToken, SESSION_SECONDS, verifySessionToken } from "@/lib/admin-auth";

afterEach(() => vi.unstubAllEnvs());

describe("owner admin sign-in", () => {
  it("is off without a long enough ADMIN_PASSWORD", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminSetup()).toBe("missing");
    expect(checkPassword("")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect(adminSetup()).toBe("too-short");
    expect(checkPassword("short")).toBe(false);
  });

  it("checks the password", () => {
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery");
    expect(checkPassword("correct horse battery")).toBe(true);
    expect(checkPassword("wrong password here")).toBe(false);
    expect(checkPassword(undefined)).toBe(false);
  });

  it("accepts its own session token until it expires", () => {
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery");
    const now = Date.UTC(2026, 10, 23, 10);
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    expect(verifySessionToken(token, now + (SESSION_SECONDS - 5) * 1000)).toBe(true);
    expect(verifySessionToken(token, now + (SESSION_SECONDS + 5) * 1000)).toBe(false);
  });

  it("rejects forged or tampered tokens, and all tokens after a password change", () => {
    vi.stubEnv("ADMIN_PASSWORD", "correct horse battery");
    const now = Date.UTC(2026, 10, 23, 10);
    const token = createSessionToken(now);
    const [exp, sig] = token.split(".");
    expect(verifySessionToken(`${Number(exp) + 3600}.${sig}`, now)).toBe(false);
    expect(verifySessionToken(`${exp}.x${sig.slice(1)}`, now)).toBe(false);
    expect(verifySessionToken("garbage", now)).toBe(false);
    expect(verifySessionToken(undefined, now)).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "a brand new password");
    expect(verifySessionToken(token, now)).toBe(false);
  });
});
