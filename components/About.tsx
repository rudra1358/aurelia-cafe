import Photo from "./Photo";
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
          <p className="eyebrow text-accent-ink reveal">About Aurelia</p>
          <h2 className="h2 reveal" id="about-title" style={{ marginTop: 22 }}>
            A little more than just coffee.
          </h2>
          <p className="ab-lede reveal">
            At Aurelia, we believe the best moments are often the simplest ones. A freshly brewed cup of coffee,
            conversations that last a little longer, and food made to be enjoyed.
          </p>
          <div className="ab-body reveal">
            <p>We created Aurelia as a welcoming space where quality, comfort, and thoughtful experiences come together.</p>
            <p>
              Whether you’re stopping by for your morning coffee, meeting friends, or taking a moment for yourself,
              there’s always a place for you here.
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
