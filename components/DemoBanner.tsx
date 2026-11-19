import { site } from "@/data/site";

/** Thin top strip shown while the site is a portfolio concept (see `site.demo` in data/site.ts). */
export default function DemoBanner() {
  if (!site.demo.enabled) return null;
  return (
    <div className="demo-banner" role="note">
      <span className="demo-long">
        Aurelia is a concept website designed &amp; built by{" "}
        <a href={site.demo.authorUrl} target="_blank" rel="noopener noreferrer">
          {site.demo.author}
        </a>{" "}
        — the reservation form is a working demo.
      </span>
      <span className="demo-short">
        Concept site by{" "}
        <a href={site.demo.authorUrl} target="_blank" rel="noopener noreferrer">
          {site.demo.author}
        </a>{" "}
        · demo reservations
      </span>
    </div>
  );
}
