import { describe, expect, it } from "vitest";
import { menu as starting, type MenuSection } from "@/data/menu";
import { applyRestore, restoreLabel, restoreOptions } from "@/lib/menu-restore";

const copy = () => structuredClone(starting) as MenuSection[];
const same = <T>(v: T) => v;
const desserts: MenuSection = { id: "desserts", title: "Desserts", categories: [{ id: "cakes", title: "Cakes", items: [{ name: "Brownie", price: { kind: "fixed", amount: 250 } }] }] };

describe("restoreOptions / applyRestore", () => {
  it("offers nothing when the starting menu is all there (extra sections are fine)", () => {
    expect(restoreOptions([...copy(), desserts], starting)).toEqual([]);
  });

  it("brings back a deleted section, first, with every item", () => {
    const menu = [structuredClone(desserts)];
    const [opt, ...rest] = restoreOptions(menu, starting);
    expect(rest).toEqual([]);
    expect(restoreLabel(opt)).toBe("“Drinks” section (16 items)");
    applyRestore(menu, opt, same);
    expect(menu.map((s) => s.title)).toEqual(["Drinks", "Desserts"]);
    expect(menu[0]).toEqual(starting[0]);
    expect(restoreOptions(menu, starting)).toEqual([]);
  });

  it("brings back a deleted category in its old place", () => {
    const menu = copy();
    menu[0].categories.splice(2, 1); // Shakes, Juice & More
    const [opt] = restoreOptions(menu, starting);
    expect(restoreLabel(opt)).toBe("“Shakes, Juice & More” in Drinks (4 items)");
    applyRestore(menu, opt, same);
    expect(menu).toEqual(starting);
  });

  it("brings back deleted items, even if the section was renamed", () => {
    const menu = copy();
    menu[0].title = "Beverages";
    menu[0].categories[0].items = menu[0].categories[0].items.filter((i) => i.name !== "Latte" && i.name !== "Mocha");
    const [opt] = restoreOptions(menu, starting);
    expect(restoreLabel(opt)).toBe("Latte, Mocha in Coffee");
    applyRestore(menu, opt, same);
    expect(menu[0].categories[0].items.map((i) => i.name)).toEqual(starting[0].categories[0].items.map((i) => i.name));
  });

  it("doesn't offer items or categories that were only moved", () => {
    const menu = copy();
    const [moved] = menu[0].categories.splice(1, 1);
    menu.push({ id: "hot", title: "Hot", categories: [moved] });
    const latte = menu[0].categories[0].items.splice(3, 1)[0];
    menu[1].categories[0].items.push(latte);
    expect(restoreOptions(menu, starting)).toEqual([]);
  });
});
