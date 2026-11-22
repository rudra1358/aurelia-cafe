"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { logout, saveContent } from "@/app/admin/actions";
import type { CafeEvent } from "@/data/events";
import type { Diet, DietTag, MenuItem, MenuSection, Price } from "@/data/menu";
import { formatDate } from "@/lib/format";
import { LIMITS, sanitizeContent, type EditableContent, type SiteContent } from "@/lib/site-content";
import type { ContentBackend } from "@/lib/content-store";

// ───────────── Draft types: the saved shapes plus a stable React key ─────────────

interface DItem extends MenuItem {
  _k: string;
}
interface DCategory {
  _k: string;
  id: string;
  title: string;
  items: DItem[];
}
interface DSection {
  _k: string;
  id: string;
  title: string;
  categories: DCategory[];
}
interface DEvent extends CafeEvent {
  _k: string;
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function toDraft(c: EditableContent): { menu: DSection[]; events: DEvent[] } {
  return {
    menu: c.menu.map((s) => ({
      ...s,
      _k: newKey(),
      categories: s.categories.map((cat) => ({ ...cat, _k: newKey(), items: cat.items.map((i) => ({ ...i, _k: newKey() })) })),
    })),
    events: [...c.events]
      .filter((e) => !e.sample)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((e) => ({ ...e, _k: newKey() })),
  };
}

/** JSON without the React keys — used to tell whether anything changed. */
const snapshot = (menu: DSection[], events: DEvent[]) => JSON.stringify({ menu, events }, (k, v) => (k === "_k" ? undefined : v));

function move<T>(list: T[], i: number, by: -1 | 1) {
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const BACKEND_NOTE: Record<ContentBackend, string> = {
  sheets: "Changes are saved to your Google Sheet (hidden tab “Website content”).",
  redis: "Changes are saved to Upstash Redis.",
  file: "Changes are saved on this computer in .data/site-content.json. On Vercel, connect the Google Sheet or Upstash Redis so changes are kept.",
  none: "Saving isn’t set up: connect the Google Sheet (GOOGLE_SHEETS_WEBHOOK_URL) or Upstash Redis. See README → Owner admin.",
};

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// ───────────── Small building blocks ─────────────

function IconButton({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" className={`adm-icon${danger ? " adm-danger" : ""}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function MoveButtons({ name, index, count, onMove }: { name: string; index: number; count: number; onMove: (by: -1 | 1) => void }) {
  return (
    <>
      <IconButton label={`Move ${name} up`} onClick={() => onMove(-1)} disabled={index === 0}>
        <ArrowUp size={15} strokeWidth={1.6} />
      </IconButton>
      <IconButton label={`Move ${name} down`} onClick={() => onMove(1)} disabled={index === count - 1}>
        <ArrowDown size={15} strokeWidth={1.6} />
      </IconButton>
    </>
  );
}

/** Number input that allows an empty box while typing (stored as NaN until a price is entered). */
function AmountInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="adm-rupee">
      <span aria-hidden>₹</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={LIMITS.maxPrice}
        step="any"
        aria-label={label}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
    </span>
  );
}

/** Comma-separated list (allergens). Keeps the typed text; saves the cleaned list. */
function ListInput({ value, onChange, label, placeholder }: { value: string[]; onChange: (v: string[]) => void; label: string; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <label className="adm-field">
      <span>{label}</span>
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        maxLength={400}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
        }}
      />
    </label>
  );
}

function PriceEditor({ price, onChange, itemName }: { price: Price; onChange: (p: Price) => void; itemName: string }) {
  const setKind = (kind: Price["kind"]) => {
    if (kind === price.kind) return;
    const first = price.kind === "fixed" ? price.amount : price.kind === "options" ? price.amounts[0] : NaN;
    if (kind === "fixed") onChange({ kind: "fixed", amount: first ?? NaN });
    else if (kind === "options") onChange({ kind: "options", amounts: [first ?? NaN, NaN], labels: ["Regular", "Large"] });
    else onChange({ kind: "market" });
  };

  return (
    <div className="adm-price">
      <select value={price.kind} onChange={(e) => setKind(e.target.value as Price["kind"])} aria-label={`Price type for ${itemName || "this item"}`}>
        <option value="fixed">One price</option>
        <option value="options">Sizes / options</option>
        <option value="market">Market price</option>
      </select>
      {price.kind === "fixed" && <AmountInput label={`Price of ${itemName || "this item"}`} value={price.amount} onChange={(amount) => onChange({ kind: "fixed", amount })} />}
      {price.kind === "options" && (
        <div className="adm-options">
          {price.amounts.map((a, i) => (
            <div key={i} className="adm-option">
              <input
                type="text"
                aria-label={`Size ${i + 1} name`}
                placeholder="e.g. Large"
                maxLength={LIMITS.priceLabel}
                value={price.labels?.[i] ?? ""}
                onChange={(e) => {
                  const labels = price.amounts.map((_, j) => price.labels?.[j] ?? "");
                  labels[i] = e.target.value;
                  onChange({ ...price, labels });
                }}
              />
              <AmountInput
                label={`Size ${i + 1} price`}
                value={a}
                onChange={(n) => onChange({ ...price, amounts: price.amounts.map((x, j) => (j === i ? n : x)) })}
              />
              <IconButton
                label={`Remove size ${i + 1}`}
                disabled={price.amounts.length === 1}
                onClick={() =>
                  onChange({ ...price, amounts: price.amounts.filter((_, j) => j !== i), labels: price.labels?.filter((_, j) => j !== i) })
                }
              >
                <Trash2 size={14} strokeWidth={1.6} />
              </IconButton>
            </div>
          ))}
          {price.amounts.length < LIMITS.priceOptions && (
            <button
              type="button"
              className="adm-link"
              onClick={() => onChange({ ...price, amounts: [...price.amounts, NaN], labels: [...price.amounts.map((_, j) => price.labels?.[j] ?? ""), ""] })}
            >
              <Plus size={13} /> Add size
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────── Menu ─────────────

function ItemEditor({
  item,
  index,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  item: DItem;
  index: number;
  count: number;
  onChange: (fn: (i: DItem) => void) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleTag = (tag: DietTag) =>
    onChange((i) => {
      const tags = new Set(i.tags ?? []);
      if (tags.has(tag)) tags.delete(tag);
      else tags.add(tag);
      i.tags = [...tags];
    });

  return (
    <li className="adm-item">
      <div className="adm-item-main">
        <label className="adm-field adm-grow">
          <span>Item name</span>
          <input type="text" value={item.name} maxLength={LIMITS.itemName} placeholder="e.g. Chocolate Brownie" onChange={(e) => onChange((i) => void (i.name = e.target.value))} />
        </label>
        <div className="adm-field">
          <span>Price</span>
          <PriceEditor price={item.price} itemName={item.name} onChange={(p) => onChange((i) => void (i.price = p))} />
        </div>
        <label className="adm-field">
          <span>Food type</span>
          <select value={item.diet ?? ""} onChange={(e) => onChange((i) => void (i.diet = (e.target.value || undefined) as Diet | undefined))}>
            <option value="">Not set</option>
            <option value="veg">Veg</option>
            <option value="egg">Contains egg</option>
            <option value="nonveg">Non-veg</option>
          </select>
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={!!item.bestseller} onChange={(e) => onChange((i) => void (i.bestseller = e.target.checked || undefined))} />
          Bestseller
        </label>
        <div className="adm-actions">
          <button type="button" className="adm-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Less" : "More"}
          </button>
          <MoveButtons name={item.name || "item"} index={index} count={count} onMove={onMove} />
          <IconButton label={`Delete ${item.name || "item"}`} onClick={onDelete} danger>
            <Trash2 size={15} strokeWidth={1.6} />
          </IconButton>
        </div>
      </div>
      {open && (
        <div className="adm-item-more">
          <label className="adm-field adm-grow">
            <span>Description (optional)</span>
            <input
              type="text"
              value={item.description ?? ""}
              maxLength={LIMITS.itemDescription}
              placeholder="Only if you know what's in it"
              onChange={(e) => onChange((i) => void (i.description = e.target.value || undefined))}
            />
          </label>
          <ListInput label="Allergens (comma separated)" placeholder="Milk, Nuts, Gluten" value={item.allergens ?? []} onChange={(a) => onChange((i) => void (i.allergens = a.length ? a : undefined))} />
          <fieldset className="adm-tags">
            <legend>Labels</legend>
            <label className="adm-check">
              <input type="checkbox" checked={!!item.tags?.includes("jain")} onChange={() => toggleTag("jain")} /> Jain
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={!!item.tags?.includes("vegan")} onChange={() => toggleTag("vegan")} /> Vegan
            </label>
          </fieldset>
        </div>
      )}
    </li>
  );
}

function MenuEditor({ menu, edit, starting }: { menu: DSection[]; edit: (fn: (m: DSection[]) => void) => void; starting: MenuSection[] }) {
  const [newSection, setNewSection] = useState("");

  // Sections of the starting menu (data/menu.ts) that are no longer on the menu — e.g. deleted by mistake.
  const removed = starting.filter((d) => !menu.some((s) => s.id === d.id || s.title.trim().toLowerCase() === d.title.toLowerCase()));
  const restore = (section: MenuSection) => {
    const [copy] = toDraft({ menu: [section], events: [] }).menu;
    // Put it back where it was in the starting menu (the first section is the menu's main heading).
    const at = Math.min(starting.indexOf(section), menu.length);
    edit((m) => void m.splice(at, 0, copy));
  };

  const addSection = () => {
    const title = newSection.trim();
    if (!title) return;
    // A section needs at least one category; start with one of the same name.
    edit((m) => void m.push({ _k: newKey(), id: "", title, categories: [{ _k: newKey(), id: "", title, items: [] }] }));
    setNewSection("");
  };

  return (
    <div className="adm-stack">
      {menu.map((section, si) => (
        <section key={section._k} className="adm-card adm-section" aria-label={`Menu section ${section.title}`}>
          <div className="adm-row">
            <label className="adm-field adm-grow">
              <span>Section name {si === 0 && <em className="adm-muted">(also the menu’s main heading)</em>}</span>
              <input
                type="text"
                className="adm-big"
                value={section.title}
                maxLength={LIMITS.title}
                onChange={(e) => edit((m) => void (m[si].title = e.target.value))}
              />
            </label>
            <div className="adm-actions">
              <MoveButtons name={section.title || "section"} index={si} count={menu.length} onMove={(by) => edit((m) => move(m, si, by))} />
              <IconButton
                label={`Delete section ${section.title}`}
                danger
                disabled={menu.length === 1}
                onClick={() => {
                  const n = section.categories.reduce((sum, c) => sum + c.items.length, 0);
                  if (window.confirm(`Delete the whole “${section.title}” section${n ? ` and its ${n} item${n === 1 ? "" : "s"}` : ""}?`)) {
                    edit((m) => void m.splice(si, 1));
                  }
                }}
              >
                <Trash2 size={15} strokeWidth={1.6} />
              </IconButton>
            </div>
          </div>

          {section.categories.map((cat, ci) => (
            <div key={cat._k} className="adm-category">
              <div className="adm-row">
                <label className="adm-field adm-grow">
                  <span>Category</span>
                  <input type="text" value={cat.title} maxLength={LIMITS.title} onChange={(e) => edit((m) => void (m[si].categories[ci].title = e.target.value))} />
                </label>
                <div className="adm-actions">
                  <span className="adm-muted">{cat.items.length} items</span>
                  <MoveButtons
                    name={cat.title || "category"}
                    index={ci}
                    count={section.categories.length}
                    onMove={(by) => edit((m) => move(m[si].categories, ci, by))}
                  />
                  <IconButton
                    label={`Delete category ${cat.title}`}
                    danger
                    disabled={section.categories.length === 1}
                    onClick={() => {
                      if (cat.items.length === 0 || window.confirm(`Delete “${cat.title}” and its ${cat.items.length} item${cat.items.length === 1 ? "" : "s"}?`)) {
                        edit((m) => void m[si].categories.splice(ci, 1));
                      }
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.6} />
                  </IconButton>
                </div>
              </div>

              <ul className="adm-items">
                {cat.items.map((item, ii) => (
                  <ItemEditor
                    key={item._k}
                    item={item}
                    index={ii}
                    count={cat.items.length}
                    onChange={(fn) => edit((m) => fn(m[si].categories[ci].items[ii]))}
                    onMove={(by) => edit((m) => move(m[si].categories[ci].items, ii, by))}
                    onDelete={() => edit((m) => void m[si].categories[ci].items.splice(ii, 1))}
                  />
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-line adm-small-btn"
                disabled={cat.items.length >= LIMITS.itemsPerCategory}
                onClick={() => edit((m) => void m[si].categories[ci].items.push({ _k: newKey(), name: "", price: { kind: "fixed", amount: NaN } }))}
              >
                <Plus size={14} /> Add item to {cat.title || "this category"}
              </button>
            </div>
          ))}

          <button
            type="button"
            className="adm-link adm-add-cat"
            disabled={section.categories.length >= LIMITS.categoriesPerSection}
            onClick={() => edit((m) => void m[si].categories.push({ _k: newKey(), id: "", title: "New category", items: [] }))}
          >
            <Plus size={13} /> Add a category to {section.title || "this section"}
          </button>
        </section>
      ))}

      {menu.length < LIMITS.sections && (
        <form
          className="adm-card adm-new-section"
          onSubmit={(e) => {
            e.preventDefault();
            addSection();
          }}
        >
          <label className="adm-field adm-grow">
            <span>Add a new menu section</span>
            <input type="text" value={newSection} maxLength={LIMITS.title} placeholder="e.g. Desserts, Breakfast, Sandwiches" onChange={(e) => setNewSection(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-dark" disabled={!newSection.trim()}>
            <Plus size={14} /> Add section
          </button>
        </form>
      )}

      {removed.length > 0 && menu.length < LIMITS.sections && (
        <div className="adm-card adm-row adm-wrap-row">
          <p className="adm-muted" style={{ margin: 0, flex: "1 1 260px" }}>
            Removed a section by mistake? Put it back with its original items and prices, then press Save changes.
          </p>
          {removed.map((section) => {
            const n = section.categories.reduce((sum, c) => sum + c.items.length, 0);
            return (
              <button key={section.id} type="button" className="btn btn-line adm-small-btn" onClick={() => restore(section)}>
                <RotateCcw size={14} /> Restore “{section.title}” ({n} items)
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────── Events ─────────────

function EventsEditor({ events, edit, today, demo }: { events: DEvent[]; edit: (fn: (e: DEvent[]) => void) => void; today: string; demo: boolean }) {
  const past = events.filter((e) => e.date < today).length;
  const upcoming = events.length - past;

  return (
    <div className="adm-stack">
      <div className="adm-card adm-row adm-wrap-row">
        <p className="adm-muted" style={{ margin: 0, flex: "1 1 280px" }}>
          Guests book a seat at an event through the normal reservation form. Past events are hidden from guests automatically.
          {demo && upcoming === 0 && " While there are no upcoming events, the demo shows two sample events."}
        </p>
        {past > 0 && (
          <button
            type="button"
            className="btn btn-line adm-small-btn"
            onClick={() => window.confirm(`Remove ${past} past event${past === 1 ? "" : "s"}?`) && edit((list) => void list.splice(0, list.length, ...list.filter((e) => e.date >= today)))}
          >
            <Trash2 size={14} /> Remove past events ({past})
          </button>
        )}
        <button
          type="button"
          className="btn btn-dark adm-small-btn"
          disabled={events.length >= LIMITS.events}
          onClick={() => edit((list) => void list.unshift({ _k: newKey(), id: "", title: "", date: addDays(today, 7), time: "19:00", description: "" }))}
        >
          <CalendarPlus size={14} /> Add event
        </button>
      </div>

      {events.length === 0 && <p className="adm-card adm-muted">No events yet. Use “Add event” to create one.</p>}

      {events.map((ev, i) => {
        const isPast = ev.date < today;
        return (
          <section key={ev._k} className={`adm-card adm-event${isPast ? " adm-past" : ""}`} aria-label={`Event ${ev.title || "untitled"}`}>
            <div className="adm-row">
              <label className="adm-field adm-grow">
                <span>
                  Event title {isPast && <span className="tag">Past — hidden from guests</span>}
                </span>
                <input type="text" className="adm-big" value={ev.title} maxLength={LIMITS.eventTitle} placeholder="e.g. Acoustic Evening" onChange={(e) => edit((l) => void (l[i].title = e.target.value))} />
              </label>
              <div className="adm-actions">
                <IconButton
                  label={`Delete event ${ev.title}`}
                  danger
                  onClick={() => (!ev.title || window.confirm(`Delete “${ev.title}”?`)) && edit((l) => void l.splice(i, 1))}
                >
                  <Trash2 size={15} strokeWidth={1.6} />
                </IconButton>
              </div>
            </div>
            <div className="adm-grid">
              <label className="adm-field">
                <span>Date</span>
                <input type="date" value={ev.date} onChange={(e) => edit((l) => void (l[i].date = e.target.value))} />
              </label>
              <label className="adm-field">
                <span>Starts</span>
                <input type="time" step={300} value={ev.time} onChange={(e) => edit((l) => void (l[i].time = e.target.value))} />
              </label>
              <label className="adm-field">
                <span>Ends (optional)</span>
                <input type="time" step={300} value={ev.endTime ?? ""} onChange={(e) => edit((l) => void (l[i].endTime = e.target.value || undefined))} />
              </label>
              <label className="adm-field">
                <span>Price (optional)</span>
                <input
                  type="text"
                  value={ev.price ?? ""}
                  maxLength={LIMITS.eventPrice}
                  placeholder="₹1,200 per person, includes a drink"
                  onChange={(e) => edit((l) => void (l[i].price = e.target.value || undefined))}
                />
              </label>
            </div>
            <label className="adm-field">
              <span>Description</span>
              <textarea rows={3} value={ev.description} maxLength={LIMITS.eventDescription} onChange={(e) => edit((l) => void (l[i].description = e.target.value))} />
            </label>
            {ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && <p className="adm-muted adm-when">Shown to guests as {formatDate(ev.date)}</p>}
          </section>
        );
      })}
    </div>
  );
}

// ───────────── Page ─────────────

export default function AdminEditor({
  initial,
  starting,
  backend,
  today,
  demo,
}: {
  initial: SiteContent;
  /** The starting menu from data/menu.ts, so deleted sections can be restored. */
  starting: MenuSection[];
  backend: ContentBackend;
  today: string;
  demo: boolean;
}) {
  const [tab, setTab] = useState<"menu" | "events">("menu");
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saved, setSaved] = useState(() => snapshot(draft.menu, draft.events));
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const current = useMemo(() => snapshot(draft.menu, draft.events), [draft]);
  const dirty = current !== saved;
  const itemCount = draft.menu.reduce((n, s) => n + s.categories.reduce((m, c) => m + c.items.length, 0), 0);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = () => status.kind !== "saving" && status.kind !== "idle" && setStatus({ kind: "idle" });
  const editMenu = (fn: (m: DSection[]) => void) => {
    change();
    setDraft((d) => {
      const menu = structuredClone(d.menu);
      fn(menu);
      return { ...d, menu };
    });
  };
  const editEvents = (fn: (e: DEvent[]) => void) => {
    change();
    setDraft((d) => {
      const events = structuredClone(d.events);
      fn(events);
      return { ...d, events };
    });
  };

  const save = async () => {
    const check = sanitizeContent(draft);
    if (!check.ok) {
      setStatus({ kind: "error", message: check.error });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const res = await saveContent(JSON.stringify(check.content), updatedAt);
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      const next = toDraft(res.content);
      setDraft(next);
      setSaved(snapshot(next.menu, next.events));
      setUpdatedAt(res.updatedAt);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Couldn’t reach the server. Check your connection; your changes are still here." });
    }
  };

  const discard = () => {
    if (!window.confirm("Throw away all unsaved changes?")) return;
    const back = JSON.parse(saved) as EditableContent;
    setDraft(toDraft(back));
    setStatus({ kind: "idle" });
  };

  return (
    <>
      <header className="adm-head">
        <div>
          <p className="eyebrow text-accent-ink">Owner admin</p>
          <h1 className="adm-h1">Menu &amp; events</h1>
          <p className="adm-muted adm-note">
            {BACKEND_NOTE[backend]}{" "}
            {updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.` : "Showing the starting menu from the code — your first save takes over."}
          </p>
        </div>
        <div className="adm-head-btns">
          <a className="btn btn-line adm-small-btn" href="/" target="_blank" rel="noopener">
            View site <ExternalLink size={13} />
          </a>
          <form action={logout}>
            <button type="submit" className="btn btn-line adm-small-btn">
              <LogOut size={13} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="adm-tabs" role="tablist" aria-label="What to edit">
        <button type="button" role="tab" aria-selected={tab === "menu"} onClick={() => setTab("menu")}>
          Menu <span className="adm-count">{itemCount}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>
          Events <span className="adm-count">{draft.events.filter((e) => e.date >= today).length}</span>
        </button>
      </div>

      <div role="tabpanel">
        {tab === "menu" ? <MenuEditor menu={draft.menu} edit={editMenu} starting={starting} /> : <EventsEditor events={draft.events} edit={editEvents} today={today} demo={demo} />}
      </div>

      <div className={`adm-bar${dirty || status.kind !== "idle" ? " show" : ""}`} role="region" aria-label="Save changes">
        <div className="adm-bar-in">
          <p className="adm-bar-msg" aria-live="polite">
            {status.kind === "saving" && "Saving…"}
            {status.kind === "saved" && (
              <>
                <Check size={15} aria-hidden /> Saved — guests see the new version now.
              </>
            )}
            {status.kind === "error" && (
              <span className="adm-error">
                <CircleAlert size={15} aria-hidden /> {status.message}
              </span>
            )}
            {status.kind === "idle" && dirty && "You have unsaved changes."}
          </p>
          <div className="adm-head-btns">
            {dirty && (
              <button type="button" className="btn btn-line adm-small-btn" onClick={discard} disabled={status.kind === "saving"}>
                Discard
              </button>
            )}
            <button type="button" className="btn btn-dark adm-small-btn" onClick={save} disabled={!dirty || status.kind === "saving" || backend === "none"}>
              {status.kind === "saving" ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Check size={14} aria-hidden />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
