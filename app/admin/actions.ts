"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, endAdminSession, isAdmin, startAdminSession } from "@/lib/admin-auth";
import { CONTENT_TAG, saveSiteContent, type SaveResult } from "@/lib/content-store";
import { isRateLimited } from "@/lib/rate-limit";
import { sanitizeContent, type EditableContent } from "@/lib/site-content";

/** Server Actions for /admin. Each one checks the owner's session itself — never trust the page. */

const LOGIN_LIMIT = { name: "admin-login", max: 8, windowSeconds: 15 * 60 };
const MAX_BODY = 500_000;

async function ip(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function login(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  if (await isRateLimited(LOGIN_LIMIT, await ip())) {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }
  if (!checkPassword(form.get("password"))) {
    return { error: "That password isn’t right." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endAdminSession();
  redirect("/admin");
}

export type SaveContentResult = (SaveResult & { ok: false }) | { ok: true; updatedAt: string; content: EditableContent };

export async function saveContent(json: string, baseUpdatedAt: string | null): Promise<SaveContentResult> {
  if (!(await isAdmin())) return { ok: false, error: "You’ve been signed out. Copy anything important, reload and sign in again." };
  if (typeof json !== "string" || json.length > MAX_BODY) return { ok: false, error: "The menu is too large to save." };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "The changes could not be read. Please reload and try again." };
  }
  const check = sanitizeContent(raw);
  if (!check.ok) return check;

  const result = await saveSiteContent(check.content, typeof baseUpdatedAt === "string" ? baseUpdatedAt : null);
  if (result.ok) {
    // Show the new menu and events to guests straight away.
    updateTag(CONTENT_TAG);
    revalidatePath("/");
    revalidatePath("/events");
    return { ok: true, updatedAt: result.updatedAt, content: check.content };
  }
  return result;
}
