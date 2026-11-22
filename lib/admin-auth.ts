import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Owner sign-in for /admin. There is one owner password, ADMIN_PASSWORD, set in the server's
 * environment variables — it is never sent to the browser. Signing in sets an HttpOnly cookie
 * holding an expiry time and a signature, so it can't be forged or read by page scripts.
 * Changing ADMIN_PASSWORD signs everyone out.
 */
export const ADMIN_COOKIE = "aurelia_admin";
export const SESSION_SECONDS = 12 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;

export type AdminSetup = "ok" | "missing" | "too-short";

function password(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function adminSetup(): AdminSetup {
  const pw = password();
  if (!pw) return "missing";
  if (pw.length < MIN_PASSWORD_LENGTH) return "too-short";
  return "ok";
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function sign(expires: number): string {
  return createHmac("sha256", sha256(`aurelia-admin-session:${password()}`)).update(String(expires)).digest("base64url");
}

/** Constant-time password check. */
export function checkPassword(input: unknown): boolean {
  if (adminSetup() !== "ok" || typeof input !== "string" || input.length > 200) return false;
  return timingSafeEqual(sha256(input.trim()), sha256(password()));
}

export function createSessionToken(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${sign(expires)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (adminSetup() !== "ok" || !token) return false;
  const [exp, sig] = token.split(".");
  const expires = Number(exp);
  if (!Number.isInteger(expires) || expires * 1000 <= now || expires * 1000 > now + SESSION_SECONDS * 1000 + 60_000 || !sig) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function startAdminSession(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}
