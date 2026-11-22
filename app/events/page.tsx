import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Events from "@/components/Events";
import Footer from "@/components/Footer";
import { ogImages } from "@/lib/og-image";
import { getSiteContent } from "@/lib/content-store";

export const metadata: Metadata = {
  title: "Events",
  description: "Live music, workshops and tastings at Aurelia, Sindhu Bhavan, Ahmedabad. Book a seat online.",
  alternates: { canonical: "/events" },
  openGraph: { title: "Events — Aurelia", url: "/events", images: ogImages },
};

// Past events drop off on their own: re-render at most every hour.
export const revalidate = 3600;

export default async function EventsPage() {
  const { events } = await getSiteContent();
  return (
    <div id="top">
      <Navbar variant="solid" />
      <main id="main">
        <Events events={events} headingLevel={1} />
      </main>
      <Footer />
    </div>
  );
}
