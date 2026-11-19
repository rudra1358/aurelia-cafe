import { ArrowUpRight } from "lucide-react";
import Photo from "./Photo";
import barInterior from "@/public/images/bar-interior.jpg";
import { directionsUrl, hasExactLocation, mailtoHref, mapEmbedUrl, site, telHref } from "@/data/site";

export default function Contact() {
  const { location } = site;
  return (
    <section className="sec" id="contact" aria-labelledby="ct-title">
      <div className="wrap">
        <div className="g12">
          <div className="ct-img">
            <Photo
              src={barInterior}
              alt="A bright café counter with an espresso machine, pendant lights and shelves of coffee"
              sizes="(max-width: 900px) 100vw, 45vw"
            />
          </div>
          <div className="ct-text">
            <p className="eyebrow text-accent-ink reveal">Contact</p>
            <h2 className="h2 reveal" id="ct-title" style={{ marginTop: 22 }}>
              Come say hello.
            </h2>
            <dl className="dl reveal">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={mailtoHref}>{site.contact.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={telHref}>{site.contact.phoneDisplay}</a>
                </dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{site.hours.display}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  <address style={{ fontStyle: "normal" }}>
                    {location.exactAddress ? (
                      <>
                        {location.exactAddress}
                        <br />
                      </>
                    ) : null}
                    {location.area}, {location.city},<br />
                    {location.region}, {location.country}
                  </address>
                </dd>
              </div>
            </dl>
            <div className="ct-btns">
              <a className="btn btn-dark" href={directionsUrl()} target="_blank" rel="noopener noreferrer">
                Get directions
                <ArrowUpRight size={14} strokeWidth={1.3} aria-hidden />
                <span className="sr-only">(opens Google Maps in a new tab)</span>
              </a>
              <a className="btn btn-line" href="#reservation">
                Reserve a table
              </a>
            </div>
          </div>
        </div>

        <figure className="reveal" style={{ margin: 0 }}>
          <div className="map">
            <iframe
              src={mapEmbedUrl()}
              title={hasExactLocation ? "Map showing Aurelia’s location" : "Map of the Sindhu Bhavan area, Ahmedabad"}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <figcaption className="map-cap">
            <p>
              {hasExactLocation
                ? `Aurelia, ${location.display}.`
                : "Map shows the approximate Sindhu Bhavan area in Ahmedabad — not the exact storefront."}
            </p>
            <a href={directionsUrl()} target="_blank" rel="noopener noreferrer">
              Open in Google Maps ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
