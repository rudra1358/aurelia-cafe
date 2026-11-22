import { describe, expect, it } from "vitest";
import { events } from "@/data/events";
import { menu } from "@/data/menu";
import { sanitizeContent, slugify } from "@/lib/site-content";

const base = () => structuredClone({ menu, events });

function errorFor(content: unknown): string {
  const r = sanitizeContent(content);
  if (r.ok) throw new Error("expected an error");
  return r.error;
}

describe("sanitizeContent", () => {
  it("accepts the built-in menu and events unchanged", () => {
    const r = sanitizeContent(base());
    expect(r).toEqual({ ok: true, content: { menu, events } });
  });

  it("adds a new section (e.g. Desserts) with generated ids and cleaned values", () => {
    const c = base();
    (c.menu as unknown[]).push({
      title: "  Desserts ",
      categories: [{ title: "Cakes", items: [{ name: " Brownie  ", price: { kind: "fixed", amount: "250" }, diet: "egg", bestseller: true, junk: 1 }] }],
    });
    const r = sanitizeContent(c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const desserts = r.content.menu.at(-1)!;
    expect(desserts).toEqual({
      id: "desserts",
      title: "Desserts",
      categories: [{ id: "cakes", title: "Cakes", items: [{ name: "Brownie", price: { kind: "fixed", amount: 250 }, diet: "egg", bestseller: true }] }],
    });
  });

  it("keeps ids unique", () => {
    const c = base();
    (c.menu as unknown[]).push({ title: "Drinks", categories: [{ title: "Coffee", items: [] }] });
    const r = sanitizeContent(c);
    expect(r.ok && r.content.menu.map((s) => s.id)).toEqual(["drinks", "drinks-2"]);
    expect(r.ok && r.content.menu[1].categories[0].id).toBe("coffee-2");
  });

  it("explains what is wrong, and where", () => {
    const c = base();
    c.menu[0].categories[0].items[1] = { name: "Espresso", price: { kind: "fixed", amount: NaN } };
    expect(errorFor(c)).toBe("Drinks → Coffee, item 2 “Espresso” needs a price.");

    const d = base();
    d.menu[0].categories[0].items.push({ name: "latte", price: { kind: "fixed", amount: 1 } });
    expect(errorFor(d)).toMatch(/lists “latte” twice/);

    expect(errorFor({ menu: [], events: [] })).toMatch(/at least one section/);
    expect(errorFor({ menu: [{ title: "Food", categories: [] }], events: [] })).toMatch(/at least one category/);
    expect(errorFor({ ...base(), menu: [{ title: "", categories: [{ title: "x", items: [] }] }] })).toMatch(/name is empty/);
  });

  it("rejects negative and absurd prices, and checks size options", () => {
    const item = (price: unknown) => ({ menu: [{ title: "A", categories: [{ title: "B", items: [{ name: "C", price }] }] }], events: [] });
    expect(errorFor(item({ kind: "fixed", amount: -5 }))).toMatch(/negative/);
    expect(errorFor(item({ kind: "fixed", amount: 5_000_000 }))).toMatch(/too high/);
    expect(errorFor(item({ kind: "options", amounts: [] }))).toMatch(/at least one price/);
    const r = sanitizeContent(item({ kind: "options", amounts: [300, "400"], labels: ["Regular", "Large"] }));
    expect(r.ok && r.content.menu[0].categories[0].items[0].price).toEqual({ kind: "options", amounts: [300, 400], labels: ["Regular", "Large"] });
    const m = sanitizeContent(item({ kind: "market", amount: 5 }));
    expect(m.ok && m.content.menu[0].categories[0].items[0].price).toEqual({ kind: "market" });
  });

  it("validates events and makes ids for new ones", () => {
    const ev = (e: object) => ({ menu, events: [{ title: "Jazz Night", date: "2026-12-12", time: "19:30", description: "Live jazz.", ...e }] });
    const r = sanitizeContent(ev({ endTime: "", price: "", sample: true }));
    expect(r.ok && r.content.events).toEqual([{ id: "jazz-night-2026-12-12", title: "Jazz Night", date: "2026-12-12", time: "19:30", description: "Live jazz." }]);
    expect(sanitizeContent(ev({ id: "keep-me" })).ok && (sanitizeContent(ev({ id: "keep-me" })) as { content: { events: { id: string }[] } }).content.events[0].id).toBe("keep-me");
    expect(errorFor(ev({ date: "2026-02-30" }))).toMatch(/valid date/);
    expect(errorFor(ev({ time: "25:00" }))).toMatch(/valid start time/);
    expect(errorFor(ev({ endTime: "19:00" }))).toMatch(/after the start time/);
    expect(errorFor(ev({ description: "" }))).toMatch(/description is empty/);
  });

  it("strips control characters and never throws on junk", () => {
    expect(sanitizeContent(null).ok).toBe(false);
    expect(sanitizeContent("nope").ok).toBe(false);
    const r = sanitizeContent({ menu: [{ title: "Fo\u0007od", categories: [{ title: "X", items: [] }] }], events: [] });
    expect(r.ok && r.content.menu[0].title).toBe("Food");
  });
});

describe("slugify", () => {
  it("makes URL-safe ids", () => {
    expect(slugify("Cakes & Pastries")).toBe("cakes-pastries");
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("!!!")).toBe("item");
  });
});
