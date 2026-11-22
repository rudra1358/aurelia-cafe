import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from "next/font/google";
import { site } from "@/data/site";
import DemoBanner from "@/components/DemoBanner";
import { LanguageProvider } from "@/components/Language";
import SiteAnalytics from "@/components/SiteAnalytics";
import "./globals.css";

// Gujarati and Hindi text (language toggle). Not preloaded: the browser only downloads
// them when Gujarati or Devanagari characters are on the page.
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["300", "400", "500"],
  variable: "--font-gujarati",
  display: "swap",
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["300", "400", "500"],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Aurelia — Café in Sindhu Bhavan, Ahmedabad",
    template: "%s — Aurelia",
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["Aurelia", "café", "coffee", "Sindhu Bhavan", "Ahmedabad", "specialty coffee", "table reservation"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    url: "/",
    siteName: site.name,
    title: "Aurelia — Café in Sindhu Bhavan, Ahmedabad",
    description: site.description,
    // The preview image comes from app/opengraph-image.tsx and app/twitter-image.tsx.
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurelia — Café in Sindhu Bhavan, Ahmedabad",
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#28251F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${cormorant.variable} ${dmSans.variable} ${notoGujarati.variable} ${notoDevanagari.variable}${site.demo.enabled ? " has-demo" : ""}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <DemoBanner />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-cream focus:px-4 focus:py-3 focus:text-sm">
          Skip to content
        </a>
        <LanguageProvider>{children}</LanguageProvider>
        {/* Vercel serves the analytics script itself; on other hosts it would 404. */}
        {process.env.VERCEL === "1" && <SiteAnalytics />}
      </body>
    </html>
  );
}
