import Image from "next/image";
import { ArrowRight } from "lucide-react";
import heroImg from "@/public/images/hero-interior.jpg";
import { site } from "@/data/site";
import { T } from "./Language";

export default function Hero() {
  return (
    <header className="hero" id="home">
      <Image
        className="hero-img"
        src={heroImg}
        alt="A sunlit café corner with a round wooden table, French press and cups beside tall windows and plants"
        fill
        sizes="100vw"
        placeholder="blur"
        loading="eager"
        fetchPriority="high"
      />
      <div className="hero-shade" aria-hidden />
      <div className="wrap hero-in">
        <p className="eyebrow r1" style={{ color: "rgba(250,249,246,.86)", marginBottom: 28 }}>
          <T k="hero.eyebrow" v={{ area: site.location.area, city: site.location.city }} />
        </p>
        <h1 className="hero-mark r2">{site.wordmark}</h1>
        <div className="hero-row r3">
          <p className="hero-quote">
            <T k="hero.quote" />
          </p>
          <div className="r4">
            <p className="hero-copy">
              <T k="hero.copy" />
            </p>
            <div className="hero-btns">
              <a className="btn btn-light" href="#menu">
                <T k="hero.menu" />
                <ArrowRight className="nudge" size={16} strokeWidth={1.3} aria-hidden />
              </a>
              <a className="btn btn-ghost" href="#reservation">
                <T k="hero.reserve" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
