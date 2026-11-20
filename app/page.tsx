import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import FeaturedItems from "@/components/FeaturedItems";
import Menu from "@/components/Menu";
import Reservation from "@/components/Reservation";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import Events from "@/components/Events";
import Social from "@/components/Social";
import { site } from "@/data/site";

// The events list depends on today's date: re-render at most every hour.
export const revalidate = 3600;

export default function HomePage() {
  // Structured data for search engines. Only facts that have been provided are included.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: site.name,
    url: site.url,
    email: site.contact.email,
    telephone: site.contact.phoneE164,
    image: `${site.url}/images/hero-interior.jpg`,
    servesCuisine: "Coffee",
    priceRange: "₹₹",
    acceptsReservations: true,
    address: {
      "@type": "PostalAddress",
      ...(site.location.exactAddress ? { streetAddress: site.location.exactAddress } : {}),
      addressLocality: `${site.location.area}, ${site.location.city}`,
      addressRegion: site.location.region,
      addressCountry: "IN",
    },
    ...(site.location.coordinates
      ? { geo: { "@type": "GeoCoordinates", latitude: site.location.coordinates.lat, longitude: site.location.coordinates.lng } }
      : {}),
  };

  return (
    <div id="top">
      <Navbar variant="overlay" />
      <Hero />
      <main id="main">
        <About />
        <FeaturedItems />
        <Menu />
        <Events limit={3} />
        <Reservation />
        <Social />
        <Contact />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
