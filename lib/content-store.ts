import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { events as defaultEvents } from "@/data/events";
import { menu as defaultMenu } from "@/data/menu";
import { sanitizeContent, type EditableContent, type SiteContent } from "./site-content";

/**
 * Where the owner's menu and events (edited at /admin) are stored. The first one available wins:
 *
 *  1. Upstash Redis   — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or Vercel's KV_REST_API_*)
 *  2. Google Sheet    — GOOGLE_SHEETS_WEBHOOK_URL + GOOGLE_SHEETS_SECRET (a hidden "Website content" tab)
 *  3. A local file    — .data/site-content.json, only when NOT on Vercel (its disk is read-only)
 *
 * Until the owner saves for the first time, data/menu.ts and data/events.ts are used.
 */
export type ContentBackend = "redis" | "sheets" | "file" | "none";

export const CONTENT_TAG = "site-content";
const REDIS_KEY = "aurelia:site-content";
const FILE = path.join(process.cwd(), ".data", "site-content.json");
const TIMEOUT_MS = 10_000;

interface Stored extends EditableContent {
  updatedAt: string;
}

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim().replace(/\/+$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url, token } : null;
}

function sheetsConfig(): { url: string; secret: string } | null {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  const secret = process.env.GOOGLE_SHEETS_SECRET?.trim();
  return url && secret ? { url, secret } : null;
}

export function contentBackend(): ContentBackend {
  // Optional override, e.g. SITE_CONTENT_STORE=file to try the admin locally without touching the live sheet.
  const forced = process.env.SITE_CONTENT_STORE?.trim().toLowerCase();
  if (forced === "redis" && redisConfig()) return "redis";
  if (forced === "sheets" && sheetsConfig()) return "sheets";
  if (forced === "file" && !process.env.VERCEL) return "file";
  if (redisConfig()) return "redis";
  if (sheetsConfig()) return "sheets";
  if (!process.env.VERCEL) return "file";
  return "none";
}

function defaults(): SiteContent {
  return { menu: defaultMenu, events: defaultEvents, updatedAt: null };
}

/** Accepts only well-formed stored content; anything else is treated as "nothing saved yet". */
function parseStored(raw: unknown): Stored | null {
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!value || typeof value !== "object") return null;
  const check = sanitizeContent(value);
  if (!check.ok) {
    console.error("[content] Stored menu/events are invalid, using the defaults:", check.error);
    return null;
  }
  const updatedAt = (value as { updatedAt?: unknown }).updatedAt;
  return { ...check.content, updatedAt: typeof updatedAt === "string" ? updatedAt : new Date(0).toISOString() };
}

// ───────────── Upstash Redis ─────────────

async function redis(cfg: { url: string; token: string }, command: string[]): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || data.error) throw new Error(`Upstash: ${data.error ?? `HTTP ${res.status}`}`);
  return data.result;
}

// ───────────── Google Sheet (Apps Script) ─────────────

async function sheets(cfg: { url: string; secret: string }, payload: object): Promise<Record<string, unknown>> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: cfg.secret, ...payload }),
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Google Sheet: HTTP ${res.status}: ${text.slice(0, 160)}`);
  }
  if (data.ok) return data;
  // An Apps Script from before this feature treats the call as a reservation.
  if (data.error === "missing reservation") {
    throw new Error("Google Sheet: the Apps Script is out of date. Paste the new scripts/google-apps-script.gs and deploy a new version.");
  }
  throw new Error(`Google Sheet: ${String(data.error ?? "unknown error")}`);
}

// ───────────── Read / write ─────────────

async function readStored(): Promise<Stored | null> {
  const backend = contentBackend();
  if (backend === "redis") return parseStored(await redis(redisConfig()!, ["GET", REDIS_KEY]));
  if (backend === "sheets") {
    const data = await sheets(sheetsConfig()!, { action: "getContent" });
    return data.content ? parseStored(data.content) : null;
  }
  if (backend === "file") {
    try {
      return parseStored(await readFile(FILE, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  return null;
}

async function writeStored(value: Stored): Promise<void> {
  const json = JSON.stringify(value);
  const backend = contentBackend();
  if (backend === "redis") {
    await redis(redisConfig()!, ["SET", REDIS_KEY, json]);
  } else if (backend === "sheets") {
    await sheets(sheetsConfig()!, { action: "saveContent", content: json });
  } else if (backend === "file") {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, json, "utf8");
    await rename(tmp, FILE);
  } else {
    throw new Error("No storage is set up for menu and event changes.");
  }
}

/** Latest saved content, straight from storage (for the admin page). Throws if storage can't be reached. */
export async function loadContentFresh(): Promise<SiteContent> {
  return (await readStored()) ?? defaults();
}

const cachedRead = unstable_cache(async () => (await readStored()) ?? defaults(), [CONTENT_TAG], {
  tags: [CONTENT_TAG],
  revalidate: 3600,
});

let lastGood: SiteContent | null = null;

/**
 * Menu and events for the public pages. Cached (and refreshed straight away when the owner saves).
 * Never throws: if storage is unreachable it falls back to the last good copy, then the defaults.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    lastGood = await cachedRead();
    return lastGood;
  } catch (err) {
    console.error("[content] Could not load the menu and events:", err);
    return lastGood ?? defaults();
  }
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string };

/**
 * Saves the owner's changes. `baseUpdatedAt` is the version the owner started editing from:
 * if someone saved in between (another phone or tab), nothing is overwritten.
 */
export async function saveSiteContent(content: EditableContent, baseUpdatedAt: string | null): Promise<SaveResult> {
  if (contentBackend() === "none") {
    return { ok: false, error: "Saving isn’t set up yet: connect the Google Sheet or Upstash Redis (see README → Owner admin)." };
  }
  try {
    const current = await readStored();
    if ((current?.updatedAt ?? null) !== baseUpdatedAt) {
      return { ok: false, error: "The menu was changed somewhere else since you opened this page. Reload to get the latest version, then make your changes again." };
    }
    const updatedAt = new Date().toISOString();
    await writeStored({ ...content, updatedAt });
    lastGood = { ...content, updatedAt };
    return { ok: true, updatedAt };
  } catch (err) {
    console.error("[content] Could not save:", err);
    return { ok: false, error: "Couldn’t save right now. Your changes are still here — please try again in a moment." };
  }
}
