import Photo from "./Photo";
import { T } from "./Language";
import pourOver from "@/public/images/pour-over.jpg";
import latteCups from "@/public/images/latte-cups.jpg";

export default function About() {
  return (
    <section className="sec" id="about" aria-labelledby="about-title">
      <div className="wrap g12">
        <div className="ab-img">
          <Photo
            src={pourOver}
            alt="A barista slowly pouring water from a gooseneck kettle into a pour-over coffee brewer"
            sizes="(max-width: 900px) 100vw, 45vw"
          />
        </div>
        <div className="ab-text">
          <p className="eyebrow text-accent-ink reveal">
            <T k="about.eyebrow" />
          </p>
          <h2 className="h2 reveal" id="about-title" style={{ marginTop: 22 }}>
            <T k="about.title" />
          </h2>
          <p className="ab-lede reveal">
            <T k="about.lede" />
          </p>
          <div className="ab-body reveal">
            <p>
              <T k="about.p1" />
            </p>
            <p>
              <T k="about.p2" />
            </p>
          </div>
          <div className="ab-small">
            <Photo
              src={latteCups}
              alt="Two cappuccinos with leaf latte art on a wooden table surrounded by green plants"
              sizes="(max-width: 900px) 70vw, 28vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
