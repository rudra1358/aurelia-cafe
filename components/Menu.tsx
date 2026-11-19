import { formatPrice, menu } from "@/data/menu";
import { site } from "@/data/site";

export default function Menu() {
  return (
    <section className="sec bg-sand" id="menu" aria-labelledby="menu-title">
      <div className="wrap">
        {menu.map((section, si) => (
          <div key={section.id} style={si > 0 ? { marginTop: 144 } : undefined}>
            <div className="mn-head">
              {si === 0 && <p className="eyebrow text-accent-ink reveal">The menu</p>}
              <h2 className="h2 reveal" id={si === 0 ? "menu-title" : undefined} style={{ marginTop: 22 }}>
                {section.title}
              </h2>
              {si === 0 && (
                <p className="sub reveal">Coffee brewed with intention, teas and house favorites — best enjoyed slowly.</p>
              )}
            </div>

            <div className="mcols">
              {section.categories.map((cat) => (
                <div key={cat.id} className="reveal">
                  <div className="mcat-head">
                    <h3>{cat.title}</h3>
                    <span className="mcount" aria-label={`${cat.items.length} items`}>
                      {String(cat.items.length).padStart(2, "0")}
                    </span>
                  </div>
                  <ul className="mlist">
                    {cat.items.map((item) => (
                      <li key={item.name} className="mrow">
                        <span className="mname">
                          {item.name}
                          {item.bestseller && <span className="tag">Bestseller</span>}
                        </span>
                        <span className={item.price.kind === "market" ? "price-mp" : "price"}>{formatPrice(item.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mn-foot">
          <p>
            All prices are in Indian Rupees (₹)
            {site.legal.pricesIncludeTax === false && " and exclude applicable taxes"}
            {site.legal.pricesIncludeTax === true && " and include applicable taxes"}. <span className="tag" style={{ marginLeft: 10 }}>Bestseller</span> marks our
            guests’ favorites.
          </p>
          <a className="btn btn-line" href="#reservation">
            Reserve a table
          </a>
        </div>
      </div>
    </section>
  );
}
