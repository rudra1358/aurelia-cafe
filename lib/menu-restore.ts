/**
 * "Restore" in the admin page: finds what of the starting menu (data/menu.ts) is no longer on
 * the owner's menu — a whole section, a category inside a section, or single items — so
 * something deleted by mistake can be put back with its original prices.
 * Matching is by id or by name (ignoring case), so renamed-back or moved things aren't offered.
 */
import type { MenuCategory, MenuItem, MenuSection } from "@/data/menu";

const norm = (s: string) => s.trim().toLowerCase();

interface Ref {
  id: string;
  title: string;
}

export type RestoreOption =
  | { kind: "section"; key: string; count: number; section: MenuSection; at: number }
  | { kind: "category"; key: string; count: number; target: Ref; category: MenuCategory; at: number }
  | { kind: "items"; key: string; count: number; target: Ref; categoryRef: Ref; items: { item: MenuItem; at: number }[] };

/** Same thing if the ids match (when both have one) or the names match. */
function same(a: Ref, b: Ref): boolean {
  return (!!a.id && a.id === b.id) || norm(a.title) === norm(b.title);
}

export function restoreOptions(menu: MenuSection[], starting: MenuSection[]): RestoreOption[] {
  const allCategories = menu.flatMap((s) => s.categories);
  const allItems = new Set(allCategories.flatMap((c) => c.items.map((i) => norm(i.name))));
  const out: RestoreOption[] = [];

  starting.forEach((ds, si) => {
    const section = menu.find((s) => same(s, ds));
    if (!section) {
      // Skip if its categories were moved into another section.
      if (ds.categories.some((dc) => allCategories.some((c) => same(c, dc)))) return;
      const count = ds.categories.reduce((n, c) => n + c.items.length, 0);
      out.push({ kind: "section", key: `s:${ds.id}`, count, section: ds, at: si });
      return;
    }
    const target = { id: section.id, title: section.title };
    ds.categories.forEach((dc, ci) => {
      const category = section.categories.find((c) => same(c, dc));
      if (!category) {
        if (allCategories.some((c) => same(c, dc))) return; // moved to another section
        out.push({ kind: "category", key: `c:${ds.id}/${dc.id}`, count: dc.items.length, target, category: dc, at: ci });
        return;
      }
      const missing = dc.items.map((item, at) => ({ item, at })).filter(({ item }) => !allItems.has(norm(item.name)));
      if (missing.length > 0) {
        out.push({
          kind: "items",
          key: `i:${ds.id}/${dc.id}`,
          count: missing.length,
          target,
          categoryRef: { id: category.id, title: category.title },
          items: missing,
        });
      }
    });
  });
  return out;
}

/**
 * Puts it back into `menu` (mutated), at its original position where possible.
 * `make` turns a copy of starting data into whatever the caller stores (e.g. adds React keys).
 */
export function applyRestore(menu: MenuSection[], opt: RestoreOption, make: <T>(value: T) => T): void {
  const copy = <T>(v: T) => make(structuredClone(v));
  if (opt.kind === "section") {
    menu.splice(Math.min(opt.at, menu.length), 0, copy(opt.section));
    return;
  }
  const section = menu.find((s) => same(s, opt.target));
  if (!section) return;
  if (opt.kind === "category") {
    section.categories.splice(Math.min(opt.at, section.categories.length), 0, copy(opt.category));
    return;
  }
  const category = section.categories.find((c) => same(c, opt.categoryRef));
  if (!category) return;
  for (const { item, at } of opt.items) category.items.splice(Math.min(at, category.items.length), 0, copy(item));
}

export function restoreLabel(opt: RestoreOption): string {
  const items = `${opt.count} item${opt.count === 1 ? "" : "s"}`;
  if (opt.kind === "section") return `“${opt.section.title}” section (${items})`;
  if (opt.kind === "category") return `“${opt.category.title}” in ${opt.target.title} (${items})`;
  const names = opt.items.map((i) => i.item.name);
  return `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""} in ${opt.categoryRef.title}`;
}
