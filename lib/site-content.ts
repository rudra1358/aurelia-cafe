/**
 * The parts of the site the owner edits from /admin: the menu and the events.
 *
 * `sanitizeContent` checks everything that comes from the admin page before it is saved,
 * so a typo can never break the public site. It is pure (no I/O) and shared by the admin
 * page (to show problems before saving) and the server (which always re-checks).
 */
import type { CafeEvent } from "@/data/events";
import type { Diet, DietTag, MenuItem, MenuSection, Price } from "@/data/menu";

export interface EditableContent {
  menu: MenuSection[];
  events: CafeEvent[];
}

export interface SiteContent extends EditableContent {
  /** ISO time of the last save from /admin, or null while the built-in defaults are used. */
  updatedAt: string | null;
}

export type ContentCheck = { ok: true; content: EditableContent } | { ok: false; error: string };

export const LIMITS = {
  sections: 20,
  categoriesPerSection: 30,
  itemsPerCategory: 150,
  events: 100,
  title: 60,
  itemName: 80,
  itemDescription: 300,
  allergens: 12,
  allergen: 30,
  priceOptions: 6,
  priceLabel: 20,
  maxPrice: 1_000_000,
  eventTitle: 80,
  eventDescription: 600,
  eventPrice: 120,
} as const;

const DIETS: Diet[] = ["veg", "nonveg", "egg"];
const TAGS: DietTag[] = ["jain", "vegan"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

class ContentError extends Error {}

function text(v: unknown, { max, where, required = true, multiline = false }: { max: number; where: string; required?: boolean; multiline?: boolean }): string {
  let s = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  s = s.replace(CONTROL_RE, "");
  s = multiline ? s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : s.replace(/\s+/g, " ").trim();
  if (required && !s) throw new ContentError(`${where} is empty.`);
  if (s.length > max) throw new ContentError(`${where} is too long (${s.length} characters, the limit is ${max}).`);
  return s;
}

/** "Cakes & Pastries" → "cakes-pastries". */
export function slugify(s: string): string {
  const slug = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Keeps a valid existing id (so links keep working), otherwise makes one; always unique in `taken`. */
function uniqueId(existing: unknown, fallback: string, taken: Set<string>): string {
  const base = typeof existing === "string" && ID_RE.test(existing) ? existing : slugify(fallback);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function amount(v: unknown, where: string): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new ContentError(`${where} needs a price.`);
  if (n < 0) throw new ContentError(`${where} can't have a negative price.`);
  if (n > LIMITS.maxPrice) throw new ContentError(`${where}: the price looks too high.`);
  return Math.round(n * 100) / 100;
}

function price(v: unknown, where: string): Price {
  const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (p.kind === "market") return { kind: "market" };
  if (p.kind === "options") {
    const amounts = Array.isArray(p.amounts) ? p.amounts : [];
    if (amounts.length === 0) throw new ContentError(`${where} needs at least one price.`);
    if (amounts.length > LIMITS.priceOptions) throw new ContentError(`${where} has more than ${LIMITS.priceOptions} prices.`);
    const labelsIn = Array.isArray(p.labels) ? p.labels : [];
    const labels = amounts.map((_, i) => text(labelsIn[i], { max: LIMITS.priceLabel, where: `${where}, size ${i + 1} label`, required: false }));
    return {
      kind: "options",
      amounts: amounts.map((a, i) => amount(a, `${where}, size ${i + 1}`)),
      ...(labels.some(Boolean) ? { labels } : {}),
    };
  }
  return { kind: "fixed", amount: amount(p.amount, where) };
}

function item(v: unknown, where: string): MenuItem {
  const raw = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = text(raw.name, { max: LIMITS.itemName, where: `${where}: the name` });
  const at = `${where} “${name}”`;
  const out: MenuItem = { name, price: price(raw.price, at) };
  if (raw.bestseller === true) out.bestseller = true;
  const description = text(raw.description, { max: LIMITS.itemDescription, where: `${at}: the description`, required: false });
  if (description) out.description = description;
  if (DIETS.includes(raw.diet as Diet)) out.diet = raw.diet as Diet;
  const tags = Array.isArray(raw.tags) ? TAGS.filter((t) => (raw.tags as unknown[]).includes(t)) : [];
  if (tags.length) out.tags = tags;
  const allergensIn = Array.isArray(raw.allergens) ? raw.allergens : [];
  if (allergensIn.length > LIMITS.allergens) throw new ContentError(`${at} has more than ${LIMITS.allergens} allergens.`);
  const allergens = [...new Set(allergensIn.map((a) => text(a, { max: LIMITS.allergen, where: `${at}: an allergen`, required: false })).filter(Boolean))];
  if (allergens.length) out.allergens = allergens;
  return out;
}

function menu(v: unknown): MenuSection[] {
  if (!Array.isArray(v)) throw new ContentError("The menu is missing.");
  if (v.length === 0) throw new ContentError("The menu needs at least one section.");
  if (v.length > LIMITS.sections) throw new ContentError(`The menu can have up to ${LIMITS.sections} sections.`);
  const sectionIds = new Set<string>();
  const categoryIds = new Set<string>();
  return v.map((s, si) => {
    const raw = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const title = text(raw.title, { max: LIMITS.title, where: `Menu section ${si + 1}: the name` });
    const cats = Array.isArray(raw.categories) ? raw.categories : [];
    if (cats.length === 0) throw new ContentError(`Menu section “${title}” needs at least one category.`);
    if (cats.length > LIMITS.categoriesPerSection) throw new ContentError(`Menu section “${title}” has more than ${LIMITS.categoriesPerSection} categories.`);
    return {
      id: uniqueId(raw.id, title, sectionIds),
      title,
      categories: cats.map((c, ci) => {
        const rc = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
        const catTitle = text(rc.title, { max: LIMITS.title, where: `${title} → category ${ci + 1}: the name` });
        const where = `${title} → ${catTitle}`;
        const items = Array.isArray(rc.items) ? rc.items : [];
        if (items.length > LIMITS.itemsPerCategory) throw new ContentError(`${where} has more than ${LIMITS.itemsPerCategory} items.`);
        const parsed = items.map((it, ii) => item(it, `${where}, item ${ii + 1}`));
        const seen = new Set<string>();
        for (const it of parsed) {
          const key = it.name.toLowerCase();
          if (seen.has(key)) throw new ContentError(`${where} lists “${it.name}” twice.`);
          seen.add(key);
        }
        return { id: uniqueId(rc.id, catTitle, categoryIds), title: catTitle, items: parsed };
      }),
    };
  });
}

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function events(v: unknown): CafeEvent[] {
  if (!Array.isArray(v)) throw new ContentError("The events list is missing.");
  if (v.length > LIMITS.events) throw new ContentError(`Up to ${LIMITS.events} events can be listed. Remove some past events first.`);
  const ids = new Set<string>();
  return v.map((e, i) => {
    const raw = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    const title = text(raw.title, { max: LIMITS.eventTitle, where: `Event ${i + 1}: the title` });
    const at = `Event “${title}”`;
    const date = text(raw.date, { max: 10, where: `${at}: the date` });
    if (!validDate(date)) throw new ContentError(`${at}: please choose a valid date.`);
    const time = text(raw.time, { max: 5, where: `${at}: the start time` });
    if (!TIME_RE.test(time)) throw new ContentError(`${at}: please choose a valid start time.`);
    const endTime = text(raw.endTime, { max: 5, where: `${at}: the end time`, required: false });
    if (endTime && !TIME_RE.test(endTime)) throw new ContentError(`${at}: please choose a valid end time.`);
    if (endTime && endTime <= time) throw new ContentError(`${at}: the end time must be after the start time.`);
    const description = text(raw.description, { max: LIMITS.eventDescription, where: `${at}: the description`, multiline: true });
    const priceText = text(raw.price, { max: LIMITS.eventPrice, where: `${at}: the price`, required: false });
    return {
      id: uniqueId(raw.id, `${title}-${date}`, ids),
      title,
      date,
      time,
      ...(endTime ? { endTime } : {}),
      description,
      ...(priceText ? { price: priceText } : {}),
    };
  });
}

/** Checks and cleans menu + events from the admin page. Never throws. */
export function sanitizeContent(raw: unknown): ContentCheck {
  try {
    const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return { ok: true, content: { menu: menu(src.menu), events: events(src.events) } };
  } catch (err) {
    if (err instanceof ContentError) return { ok: false, error: err.message };
    return { ok: false, error: "The changes could not be read. Please reload the page and try again." };
  }
}
