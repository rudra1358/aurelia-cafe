import { ArrowUpRight, Star } from "lucide-react";
import Photo from "./Photo";
import { T } from "./Language";
import { site } from "@/data/site";
import cappuccino from "@/public/images/cappuccino.jpg";
import croissants from "@/public/images/croissants.jpg";
import desserts from "@/public/images/desserts.jpg";
import icedCoffee from "@/public/images/iced-coffee.jpg";

/**
 * Guest reviews (data/site.ts → testimonials, googleRating) and an Instagram strip
 * (data/site.ts → online.instagram). Each part renders only once the owner has filled it in —
 * nothing here is invented.
 */
export default function Social() {
  const { testimonials, online } = site;
  const rating = online.googleRating;
  const showReviews = testimonials.length > 0 || rating !== null;
  if (!showReviews && !online.instagram) return null;

  return (
    <section className="sec" id="reviews" aria-labelledby={showReviews ? "rv-title" : "ig-title"}>
      <div className="wrap">
        {showReviews && (
          <div className="rv">
            <p className="eyebrow text-accent-ink reveal">
              <T k="reviews.eyebrow" />
            </p>
            <h2 className="h2 reveal" id="rv-title" style={{ marginTop: 22 }}>
              <T k="reviews.title" />
            </h2>
            {rating && (
              <p className="rv-rating">
                <Star size={16} strokeWidth={1.4} aria-hidden />
                <T k="reviews.rating" v={{ value: rating.value.toFixed(1), count: rating.count }} />
              </p>
            )}
            {testimonials.length > 0 && (
              <ul className="rv-list">
                {testimonials.map((r) => (
                  <li key={r.author + r.quote.slice(0, 20)}>
                    <blockquote>“{r.quote}”</blockquote>
                    <p>
                      — {r.author}
                      {r.source ? `, ${r.source}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {online.googleReviews && (
              <a className="btn btn-line" href={online.googleReviews} target="_blank" rel="noopener noreferrer" style={{ marginTop: 40 }}>
                <T k="reviews.more" />
                <ArrowUpRight size={14} strokeWidth={1.3} aria-hidden />
              </a>
            )}
          </div>
        )}

        {online.instagram && (
          <div className="ig" style={showReviews ? { marginTop: 144 } : undefined}>
            <div className="ig-head">
              <div>
                <p className="eyebrow text-accent-ink">
                  <T k="insta.eyebrow" />
                </p>
                <h2 className="h2" id="ig-title" style={{ marginTop: 22 }}>
                  <T k="insta.title" />
                </h2>
              </div>
              <a className="btn btn-line" href={online.instagram} target="_blank" rel="noopener noreferrer">
                <T k="insta.follow" />
                <ArrowUpRight size={14} strokeWidth={1.3} aria-hidden />
              </a>
            </div>
            <a className="ig-grid" href={online.instagram} target="_blank" rel="noopener noreferrer" aria-label="Aurelia on Instagram (opens in a new tab)">
              {[cappuccino, croissants, icedCoffee, desserts].map((img, i) => (
                <Photo key={i} src={img} alt="" sizes="(max-width: 640px) 50vw, 25vw" />
              ))}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
