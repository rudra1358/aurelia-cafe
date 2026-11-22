import Link from "next/link";
import { mailtoHref, site, telHref } from "@/data/site";
import { T } from "./Language";

export default function Footer() {
  return (
    <footer className="ft">
      <div className="wrap">
        <p className="ft-mark" aria-hidden>
          {site.wordmark}
        </p>
        <p className="ft-tag">{site.tagline}</p>
        <div className="ft-grid">
          <div>
            <p className="ft-blurb">
              <T k="footer.blurb" v={{ area: site.location.area, city: site.location.city }} />
            </p>
          </div>
          <nav aria-labelledby="ft-explore">
            <h2 id="ft-explore">
              <T k="footer.explore" />
            </h2>
            <ul>
              <li><Link href="/#home"><T k="nav.home" /></Link></li>
              <li><Link href="/#about"><T k="nav.about" /></Link></li>
              <li><Link href="/#menu"><T k="nav.menu" /></Link></li>
              <li><Link href="/events"><T k="nav.events" /></Link></li>
              <li><Link href="/#reservation"><T k="footer.reservations" /></Link></li>
              <li><Link href="/#contact"><T k="nav.contact" /></Link></li>
            </ul>
          </nav>
          <div>
            <h2>
              <T k="footer.contact" />
            </h2>
            <ul>
              <li><a href={mailtoHref}>{site.contact.email}</a></li>
              <li><a href={telHref}>{site.contact.phoneDisplay}</a></li>
              <li style={{ color: "rgba(250,249,246,.72)" }}>{site.location.display}</li>
              <li style={{ color: "rgba(250,249,246,.72)" }}>{site.hours.display}</li>
              {site.online.instagram && (
                <li><a href={site.online.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a></li>
              )}
            </ul>
          </div>
          <nav aria-labelledby="ft-legal">
            <h2 id="ft-legal">
              <T k="footer.legal" />
            </h2>
            <ul>
              <li><Link href="/privacy-policy"><T k="footer.privacy" /></Link></li>
              <li><Link href="/terms-and-conditions"><T k="footer.terms" /></Link></li>
            </ul>
          </nav>
        </div>
        <div className="ft-bot">
          <p>
            <T k="footer.rights" />
          </p>
          <a href="#top">
            <T k="footer.top" />
          </a>
        </div>
      </div>
    </footer>
  );
}
