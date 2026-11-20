import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Client IP. On Vercel these headers are set by the platform and can't be spoofed by the visitor. */
export function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/**
 * Only accept requests from this site's own pages: blocks other websites from posting
 * to the API from a visitor's browser (CSRF) and casual cross-site abuse.
 */
export function sameOrigin(request: Request): boolean {
  const h = request.headers;
  if (h.get("sec-fetch-site") === "cross-site") return false;
  const origin = h.get("origin");
  if (!origin) return true; // non-browser clients; the other checks still apply
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  return originHost === host;
}

export function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const MAX_BODY_BYTES = 10_000;

/** Reads a small JSON object body, or returns null if it isn't one. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (hashes first, so lengths don't leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
