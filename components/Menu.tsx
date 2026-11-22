"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatPrice, type Diet, type DietTag, type MenuItem, type MenuSection } from "@/data/menu";
import { site } from "@/data/site";
import type { TranslationKey } from "@/data/translations";
import { useT } from "./Language";

type Filter = Diet | DietTag;

const FILTER_LABEL: Record<Filter, TranslationKey> = {
  veg: "menu.veg",
  nonveg: "menu.nonveg",
  egg: "menu.egg",
  jain: "menu.jain",
  vegan: "menu.vegan",
};
const FILTER_ORDER: Filter[] = ["veg", "jain", "vegan", "egg", "nonveg"];

function matchesFilter(item: MenuItem, f: Filter): boolean {
  if (f === "veg" || f === "nonveg" || f === "egg") return item.diet === f || (f === "veg" && !!item.tags?.length);
  return item.tags?.includes(f) ?? false;
}

/** Ignore case and accents ("cafe" finds "Café"). */
function normalise(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Indian food marking: a square with a dot (green veg, red non-veg) or triangle (egg). */
function DietMark({ diet, label }: { diet: Diet; label: string }) {
  return (
    <span
      className={`diet diet-${diet}`}
      {...(label ? { role: "img", "aria-label": label, title: label } : { "aria-hidden": true })}
    >
      <span />
    </span>
  );
}

/** `menu` comes from the owner's saved menu (/admin), see lib/content-store.ts. */
export default function Menu({ menu }: { menu: MenuSection[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter | null>(null);

  const allItems = useMemo(() => menu.flatMap((s) => s.categories.flatMap((c) => c.items)), [menu]);
  // Only offer filters for labels the owner has actually entered.
  const filters = FILTER_ORDER.filter((f) => allItems.some((i) => matchesFilter(i, f)));

  const q = normalise(query.trim());
  const visible = (item: MenuItem) =>
    (!q || normalise(`${item.name} ${item.description ?? ""} ${(item.allergens ?? []).join(" ")}`).includes(q)) &&
    (!filter || matchesFilter(item, filter));
  const shownCount = allItems.filter(visible).length;
  const filtering = q !== "" || filter !== null;

  const pricesNote =
    site.legal.pricesIncludeTax === false ? "menu.pricesExcl" : site.legal.pricesIncludeTax === true ? "menu.pricesIncl" : "menu.prices";

  return (
    <section className="sec bg-sand" id="menu" aria-labelledby="menu-title">
      <div className="wrap">
        <div className="mn-head">
          <p className="eyebrow text-accent-ink reveal">{t("menu.eyebrow")}</p>
          <h2 className="h2 reveal" id="menu-title" style={{ marginTop: 22 }}>
            {menu[0]?.title}
          </h2>
          <p className="sub reveal">{t("menu.sub")}</p>
        </div>

        <div className="mn-tools" role="search">
          <label className="mn-search">
            <span className="sr-only">{t("menu.search")}</span>
            <Search size={16} strokeWidth={1.4} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("menu.searchPlaceholder")}
              autoComplete="off"
              maxLength={60}
            />
          </label>
          {filters.length > 0 && (
            <div className="mn-filters" role="group" aria-label="Dietary filters">
              <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
                {t("menu.all")}
              </button>
              {filters.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(filter === f ? null : f)}>
                  {(f === "veg" || f === "nonveg" || f === "egg") && <DietMark diet={f} label="" />}
                  {t(FILTER_LABEL[f])}
                </button>
              ))}
            </div>
          )}
          <p className="sr-only-live" aria-live="polite">
            {filtering ? t("menu.results", { count: shownCount }) : ""}
          </p>
        </div>

        {filtering && shownCount === 0 ? (
          <div className="mn-empty">
            <p>{t("menu.noResults")}</p>
            <button
              type="button"
              className="btn btn-line"
              onClick={() => {
                setQuery("");
                setFilter(null);
              }}
            >
              <X size={14} strokeWidth={1.4} aria-hidden />
              {t("menu.clear")}
            </button>
          </div>
        ) : (
          menu.map((section, si) => (
            <div key={section.id} style={si > 0 ? { marginTop: 144 } : undefined}>
              {si > 0 && (
                <div className="mn-head">
                  <h2 className="h2">{section.title}</h2>
                </div>
              )}
              <div className="mcols">
                {section.categories.map((cat) => {
                  const items = cat.items.filter(visible);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <div className="mcat-head">
                        <h3>{cat.title}</h3>
                        <span className="mcount" aria-label={`${items.length} items`}>
                          {String(items.length).padStart(2, "0")}
                        </span>
                      </div>
                      <ul className="mlist">
                        {items.map((item) => (
                          <li key={item.name} className="mrow">
                            <span className="mitem">
                              <span className="mname">
                                {item.diet && <DietMark diet={item.diet} label={t(FILTER_LABEL[item.diet])} />}
                                {item.name}
                                {item.bestseller && <span className="tag">{t("menu.bestseller")}</span>}
                                {item.tags?.map((tag) => (
                                  <span key={tag} className="tag tag-soft">
                                    {t(FILTER_LABEL[tag])}
                                  </span>
                                ))}
                              </span>
                              {item.description && <span className="mdesc">{item.description}</span>}
                              {item.allergens && item.allergens.length > 0 && (
                                <span className="mallergens">
                                  {t("menu.allergens")}: {item.allergens.join(", ")}
                                </span>
                              )}
                            </span>
                            <span className={item.price.kind === "market" ? "price-mp" : "price"}>{formatPrice(item.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div className="mn-foot">
          <p>
            {t(pricesNote)} <span className="tag" style={{ marginLeft: 10 }}>{t("menu.bestseller")}</span>{" "}
            {t("menu.bestsellerNote")} {t("menu.dietNote")}
          </p>
          <a className="btn btn-line" href="#reservation">
            {t("menu.reserve")}
          </a>
        </div>
      </div>
    </section>
  );
}
