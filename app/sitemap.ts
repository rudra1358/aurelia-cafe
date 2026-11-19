import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
