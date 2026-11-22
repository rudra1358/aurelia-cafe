/**
 * Link-preview image (WhatsApp, Instagram DMs, iMessage, X, Slack …), generated at build time
 * from the café's details in data/site.ts, so it never goes stale when they change.
 * Used by app/opengraph-image.tsx and app/twitter-image.tsx.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { site } from "@/data/site";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/jpeg";
export const ogAlt = `${site.name} — café in ${site.location.area}, ${site.location.city}`;

/**
 * For pages that set their own `openGraph` metadata: Next.js replaces the parent's openGraph
 * object rather than merging it, so without this those pages lose the preview image.
 */
export const ogImages = [{ url: "/opengraph-image", ...ogSize, alt: ogAlt, type: ogContentType }];

const COLORS = { ink: "#28251F", cream: "#F4EEE4", muted: "#B9AE9C", gold: "#C9A46A" };

/**
 * Fetches just the glyphs needed from Google Fonts as TTF (the image renderer can't read WOFF2).
 * Returns null if Google Fonts can't be reached, so the build falls back to the default font
 * instead of failing.
 */
async function googleFont(family: string, weight: number, text: string, italic = false): Promise<ArrayBuffer | null> {
  try {
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Renders the image as a JPEG. The photo makes a PNG about 1 MB, and WhatsApp skips preview
 * images much over 300 KB, so the PNG from ImageResponse is re-encoded with sharp.
 */
export async function renderOgImage(): Promise<Response> {
  const png = Buffer.from(await (await renderPng()).arrayBuffer());
  const jpeg = await sharp(png).flatten({ background: COLORS.ink }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": ogContentType } });
}

async function renderPng(): Promise<ImageResponse> {
  const photo = await readFile(join(process.cwd(), "public/images/hero-interior.jpg"));
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  const kicker = `${site.location.area} · ${site.location.city}`.toUpperCase();
  const footer = `Open daily · ${site.hours.display}`;

  const [serif, serifItalic, sans] = await Promise.all([
    googleFont("Cormorant Garamond", 500, site.wordmark),
    googleFont("Cormorant Garamond", 400, site.tagline, true),
    googleFont("DM Sans", 500, `${kicker}${footer}Reserve a table online`),
  ]);
  const fonts = [
    serif && { name: "Serif", data: serif, weight: 500 as const, style: "normal" as const },
    serifItalic && { name: "Serif", data: serifItalic, weight: 400 as const, style: "italic" as const },
    sans && { name: "Sans", data: sans, weight: 500 as const, style: "normal" as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: COLORS.ink }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 620,
            padding: "64px 56px 56px 72px",
            color: COLORS.cream,
          }}
        >
          <div style={{ display: "flex", fontFamily: "Sans", fontSize: 22, letterSpacing: 4, color: COLORS.gold }}>{kicker}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Serif", fontWeight: 500, fontSize: 96, letterSpacing: 12, lineHeight: 1 }}>
              {site.wordmark}
            </div>
            <div style={{ display: "flex", width: 72, height: 2, background: COLORS.gold, margin: "32px 0 28px" }} />
            <div style={{ display: "flex", maxWidth: 400, fontFamily: "Serif", fontWeight: 400, fontStyle: "italic", fontSize: 40, lineHeight: 1.2 }}>
              {site.tagline}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Sans", fontSize: 22, color: COLORS.muted }}>
            <div style={{ display: "flex", color: COLORS.cream }}>Reserve a table online</div>
            <div style={{ display: "flex", marginTop: 6 }}>{footer}</div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a web page */}
        <img src={photoSrc} alt="" width={580} height={630} style={{ width: 580, height: 630, objectFit: "cover" }} />
      </div>
    ),
    { ...ogSize, fonts },
  );
}
