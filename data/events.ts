/**
 * Events at Aurelia — live music, workshops, tastings. Guests book a seat through the
 * normal reservation form (the event is pre-selected, with its date and time).
 *
 * Add real events to `events` below. Past events are hidden automatically.
 * While the site is in demo mode (data/site.ts → demo.enabled) and there are no real
 * events, two clearly labelled SAMPLE events are shown so the feature can be seen working.
 */
import { site } from "./site";

export interface CafeEvent {
  /** Short, unique, URL-safe id, e.g. "jazz-2026-12-12". */
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour — when guests should arrive; this becomes the booking time. */
  time: string;
  /** HH:MM, optional. */
  endTime?: string;
  description: string;
  /** e.g. "₹1,200 per person, includes a drink" — or omit if free / not decided. */
  price?: string;
  /** True only for the generated demo events. */
  sample?: boolean;
}

export const events: CafeEvent[] = [
  // {
  //   id: "acoustic-2026-12-12",
  //   title: "Acoustic Evening",
  //   date: "2026-12-12",
  //   time: "19:30",
  //   endTime: "21:30",
  //   description: "Two hours of acoustic covers and originals by local artists.",
  //   price: "Free entry — reserve a table",
  // },
];

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Next given weekday (0 = Sunday) strictly after `today`. */
function nextWeekday(today: string, weekday: number): string {
  const current = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, ((weekday - current + 7) % 7) || 7);
}

/** Demo-only events, always a few days in the future. Never shown on a live site. */
function sampleEvents(today: string): CafeEvent[] {
  const friday = nextWeekday(today, 5);
  const sunday = addDays(nextWeekday(today, 0), 7);
  return [
    {
      id: `sample-acoustic-${friday}`,
      title: "Acoustic Friday",
      date: friday,
      time: "19:30",
      endTime: "21:30",
      description: "An unplugged evening of acoustic sets in the café. Sample event for the demo.",
      price: "Free entry — reserve a table",
      sample: true,
    },
    {
      id: `sample-latte-art-${sunday}`,
      title: "Latte Art Workshop",
      date: sunday,
      time: "11:00",
      endTime: "12:30",
      description: "Learn to steam milk and pour a heart and a rosetta with our baristas. Sample event for the demo.",
      price: "₹1,500 per person, includes two drinks",
      sample: true,
    },
  ];
}

/** Events from `today` (YYYY-MM-DD, café time) onwards, soonest first. */
export function upcomingEvents(today: string): CafeEvent[] {
  const real = events.filter((e) => e.date >= today);
  const list = real.length === 0 && site.demo.enabled ? sampleEvents(today) : real;
  return [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function findUpcomingEvent(id: string, today: string): CafeEvent | null {
  return upcomingEvents(today).find((e) => e.id === id) ?? null;
}
