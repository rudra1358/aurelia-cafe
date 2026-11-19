import Image from "next/image";
import { ArrowRight } from "lucide-react";
import heroImg from "@/public/images/hero-interior.jpg";
import { site } from "@/data/site";

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
          Specialty coffee · {site.location.area}, {site.location.city}
        </p>
        <h1 className="hero-mark r2">{site.wordmark}</h1>
        <div className="hero-row r3">
          <p className="hero-quote">“Where every cup tells a story.”</p>
          <div className="r4">
            <p className="hero-copy">
              Discover thoughtfully crafted coffee, delightful flavors, and moments worth slowing down for.
            </p>
            <div className="hero-btns">
              <a className="btn btn-light" href="#menu">
                Explore our menu
                <ArrowRight className="nudge" size={16} strokeWidth={1.3} aria-hidden />
              </a>
              <a className="btn btn-ghost" href="#reservation">
                Reserve a table
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
