import type { StaticImageData } from "next/image";
import Photo from "./Photo";
import { T } from "./Language";
import croissants from "@/public/images/croissants.jpg";
import cappuccino from "@/public/images/cappuccino.jpg";
import pancakes from "@/public/images/pancakes.jpg";
import desserts from "@/public/images/desserts.jpg";
import sandwich from "@/public/images/sandwich.jpg";
import icedCoffee from "@/public/images/iced-coffee.jpg";

/**
 * Illustrative photography concepts — NOT confirmed menu items and never priced.
 * The confirmed menu lives in data/menu.ts.
 */
interface Experience {
  title: string;
  text: string;
  img: StaticImageData;
  alt: string;
  sizes: string;
  objectPosition?: string;
}

const experiences: Experience[] = [
  { title: "Croissants", text: "Golden and flaky — the quiet start to a slow morning.", img: croissants, alt: "Two golden croissants dusted with flour on a dark slate board", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 55vw" },
  { title: "Cappuccino", text: "Velvety milk over rich espresso, poured with care.", img: cappuccino, alt: "A cappuccino with rosetta latte art in a white cup and saucer, seen from above", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 30vw" },
  { title: "Pancakes", text: "Soft, stacked and made for unhurried weekends.", img: pancakes, alt: "A tall stack of pancakes with syrup being poured over the top", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 30vw" },
  { title: "Desserts", text: "Small indulgences for the sweeter side of the afternoon.", img: desserts, alt: "Rows of small fruit tarts topped with berries, kiwi and edible flowers", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 45vw", objectPosition: "50% 40%" },
  { title: "Artisan sandwiches", text: "Thoughtfully layered and generously made — best shared over conversation.", img: sandwich, alt: "A toasted sandwich cut into triangles, served with small bowls of dips", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 38vw" },
  { title: "Iced coffee", text: "Cool, bold and made for Ahmedabad afternoons.", img: icedCoffee, alt: "A glass of iced coffee with swirls of milk on a wooden table", sizes: "(max-width: 640px) 100vw, (max-width: 900px) 50vw, 30vw" },
];

export default function FeaturedItems() {
  return (
    <section className="sec" id="experiences" aria-labelledby="sg-title" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <div className="sg-head">
          <div className="l">
            <p className="eyebrow text-accent-ink reveal">
              <T k="exp.eyebrow" />
            </p>
            <h2 className="h2 reveal" id="sg-title" style={{ marginTop: 22 }}>
              <T k="exp.title" />
            </h2>
          </div>
          <p className="r reveal">
            <T k="exp.intro" />
          </p>
        </div>

        <div className="g12 sg">
          {experiences.map((e, i) => (
            <article key={e.title} className={`it s${i + 1}`}>
              <Photo src={e.img} alt={e.alt} sizes={e.sizes} objectPosition={e.objectPosition} />
              <div className="cap reveal">
                <span className="num" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="sg-note">
          <T k="exp.note" />
        </p>
      </div>
    </section>
  );
}
