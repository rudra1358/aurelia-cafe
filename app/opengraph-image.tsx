import { ogAlt, ogSize, renderOgImage } from "@/lib/og-image";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = "image/jpeg";

export default function OpengraphImage() {
  return renderOgImage();
}
