import "server-only";

/**
 * Cloudflare Turnstile server-side check.
 * Enabled when TURNSTILE_SECRET_KEY is set (the form shows the widget when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set — set both together).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 8_000;

export type TurnstileResult = "ok" | "disabled" | "missing" | "invalid" | "unavailable";

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

export async function verifyTurnstile(token: unknown, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return "disabled";
  if (typeof token !== "string" || !token || token.length > 2048) return "missing";

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return "ok";
    const codes = data["error-codes"] ?? [];
    if (codes.some((c) => c === "invalid-input-secret" || c === "missing-input-secret" || c === "internal-error")) {
      console.error("[turnstile] Verification problem:", codes.join(", "));
      return "unavailable";
    }
    return "invalid";
  } catch (err) {
    console.error("[turnstile] Could not reach Cloudflare:", (err as Error)?.message ?? err);
    return "unavailable";
  }
}
