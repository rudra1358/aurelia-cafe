import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { upcomingEvents } from "@/data/events";
import { formatDate, formatTime } from "@/lib/format";
import { nowInCafeTimeZone } from "@/lib/validation";
import { T } from "./Language";

/**
 * Upcoming events. On the home page (`limit` set) it shows the next few and hides itself when
 * there are none; on /events it lists all of them. "Book a seat" opens the reservation form
 * with the event selected.
 */
export default function Events({ limit, headingLevel = 2 }: { limit?: number; headingLevel?: 1 | 2 }) {
  const all = upcomingEvents(nowInCafeTimeZone().date);
  const list = limit ? all.slice(0, limit) : all;
  if (limit && list.length === 0) return null;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section className={`sec ev${headingLevel === 1 ? " ev-page" : ""}`} id="events" aria-labelledby="ev-title">
      <div className="wrap">
        <div className="ev-head">
          <div>
            <p className="eyebrow text-accent-ink">
              <T k="events.eyebrow" />
            </p>
            <Heading className="h2" id="ev-title" style={{ marginTop: 22 }}>
              <T k="events.title" />
            </Heading>
          </div>
          <p className="ev-intro">
            <T k="events.intro" />
          </p>
        </div>

        {list.length === 0 ? (
          <p className="ev-none">
            <T k="events.none" />
          </p>
        ) : (
          <ul className="ev-list">
            {list.map((e) => (
              <li key={e.id} className="ev-item">
                <div className="ev-when">
                  <CalendarDays size={18} strokeWidth={1.3} aria-hidden />
                  <span>
                    {formatDate(e.date)}
                    <br />
                    {formatTime(e.time)}
                    {e.endTime ? ` – ${formatTime(e.endTime)}` : ""}
                  </span>
                </div>
                <div className="ev-body">
                  <h3>
                    {e.title}
                    {e.sample && (
                      <span className="tag" style={{ marginLeft: 12 }}>
                        <T k="events.sample" />
                      </span>
                    )}
                  </h3>
                  <p>{e.description}</p>
                  {e.price && <p className="ev-price">{e.price}</p>}
                </div>
                <a className="btn btn-line ev-btn" href={`/?event=${encodeURIComponent(e.id)}#reservation`}>
                  <T k="events.book" />
                  <ArrowRight className="nudge" size={14} strokeWidth={1.3} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}

        {limit && all.length > list.length && (
          <Link className="ev-all" href="/events">
            <T k="events.all" /> →
          </Link>
        )}
      </div>
    </section>
  );
}
