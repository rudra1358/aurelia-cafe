/**
 * Aurelia menu — single source of truth.
 *
 * Prices are ALREADY in Indian Rupees (₹). They were converted once by
 * multiplying the original displayed values by 100 — do NOT convert again.
 *
 * To add food later, append a new section (e.g. { id: "food", title: "Food", categories: [...] }).
 * Only add a `description` when the item's composition is actually known.
 */

export type Price =
  | { kind: "fixed"; amount: number }
  | { kind: "options"; amounts: number[]; labels?: string[] }
  | { kind: "market" };

export interface MenuItem {
  name: string;
  price: Price;
  bestseller?: boolean;
  description?: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
}

export interface MenuSection {
  id: string;
  title: string;
  categories: MenuCategory[];
}

export const currency = { code: "INR", symbol: "₹", locale: "en-IN" } as const;

const fixed = (amount: number): Price => ({ kind: "fixed", amount });

export const menu: MenuSection[] = [
  {
    id: "drinks",
    title: "Drinks",
    categories: [
      {
        id: "coffee",
        title: "Coffee",
        items: [
          { name: "Filter Coffee", price: fixed(425) },
          { name: "Espresso", price: fixed(375) },
          { name: "Cappuccino", price: fixed(450), bestseller: true },
          { name: "Latte", price: fixed(525) },
          { name: "Almond Macadamia Latte", price: fixed(700), bestseller: true },
          { name: "Mocha", price: fixed(650), bestseller: true },
          { name: "Iced Coffee", price: fixed(450) },
        ],
      },
      {
        id: "tea-warm",
        title: "Tea & Warm Drinks",
        items: [
          { name: "House Made Chai", price: fixed(500), bestseller: true },
          { name: "Fizzy Hoppy Tea", price: fixed(500) },
          { name: "Iced Tea", price: { kind: "market" } },
          { name: "Hot Chocolate", price: fixed(500) },
          { name: "Turmeric Almond Macadamia", price: fixed(556) },
        ],
      },
      {
        id: "more",
        title: "Shakes, Juice & More",
        items: [
          { name: "Business & Pleasure", price: fixed(625) },
          { name: "Full Nelson", price: fixed(1100) },
          { name: "G&B Shake", price: fixed(1050) },
          { name: "Orange Juice", price: fixed(400) },
        ],
      },
    ],
  },
];

export function formatInr(amount: number): string {
  return `${currency.symbol}${amount.toLocaleString(currency.locale)}`;
}

export function formatPrice(price: Price): string {
  switch (price.kind) {
    case "fixed":
      return formatInr(price.amount);
    case "options":
      return price.amounts
        .map((a, i) => (price.labels?.[i] ? `${price.labels[i]} ${formatInr(a)}` : formatInr(a)))
        .join(" / ");
    case "market":
      return "Market price";
  }
}
