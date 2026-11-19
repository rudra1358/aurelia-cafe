import Link from "next/link";
import { mailtoHref, site, telHref } from "@/data/site";

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
              A welcoming café in {site.location.area}, {site.location.city} — for morning coffee, long conversations and
              moments worth slowing down for.
            </p>
          </div>
          <nav aria-labelledby="ft-explore">
            <h2 id="ft-explore">Explore</h2>
            <ul>
              <li><a href="/#home">Home</a></li>
              <li><a href="/#about">About Us</a></li>
              <li><a href="/#menu">Menu</a></li>
              <li><a href="/#reservation">Reservations</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </nav>
          <div>
            <h2>Contact</h2>
            <ul>
              <li><a href={mailtoHref}>{site.contact.email}</a></li>
              <li><a href={telHref}>{site.contact.phoneDisplay}</a></li>
              <li style={{ color: "rgba(250,249,246,.72)" }}>{site.location.display}</li>
              <li style={{ color: "rgba(250,249,246,.72)" }}>Open {site.hours.display}</li>
            </ul>
          </div>
          <nav aria-labelledby="ft-legal">
            <h2 id="ft-legal">Legal</h2>
            <ul>
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions">Terms &amp; Conditions</Link></li>
            </ul>
          </nav>
        </div>
        <div className="ft-bot">
          <p>© 2026 Aurelia. All rights reserved.</p>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
