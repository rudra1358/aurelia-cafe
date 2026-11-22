import { afterEach, describe, expect, it } from "vitest";
import { site } from "@/data/site";
import { events, upcomingEvents } from "@/data/events";
import {
  addDays,
  closedDateMessage,
  closedWeekdaysText,
  toMinutes,
  validateReservation,
  type ReservationInput,
} from "@/lib/validation";

// A fixed "now" in café time: Monday 23 November 2026, midday.
const NOW = { date: "2026-11-23", time: "12:00" };

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: ReservationInput = {
    name: "Asha Mehta",
    email: "asha@example.com",
    phone: "+91 98765 43210",
    date: "2026-11-28", // a Saturday
    time: "19:30",
    guests: "2",
    notes: "",
    whatsapp: "",
    event: "",
  };
  return { ...base, ...overrides };
}

function errorsFor(overrides: Record<string, unknown>, now = NOW) {
  const result = validateReservation(input(overrides), now);
  return result.ok ? {} : result.errors;
}

// Some tests change closed days / blackouts; put the real config back after each one.
const original = {
  closedWeekdays: [...site.reservations.closedWeekdays],
  blackoutDates: [...site.reservations.blackoutDates],
};
afterEach(() => {
  site.reservations.closedWeekdays = [...original.closedWeekdays];
  site.reservations.blackoutDates = [...original.blackoutDates];
});

describe("validateReservation: a valid request", () => {
  it("accepts a normal booking and normalises the fields", () => {
    const result = validateReservation(
      input({ name: "  Asha   Mehta ", email: " asha@example.com ", phone: "+91  98765 43210", notes: "  Window seat  " }),
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Asha Mehta",
        email: "asha@example.com",
        phone: "+91 98765 43210",
        date: "2026-11-28",
        time: "19:30",
        guests: 2,
        notes: "Window seat",
        whatsapp: false,
        event: "",
      },
    });
  });

  it("accepts guests as a number as well as a string", () => {
    expect(validateReservation(input({ guests: 4 }), NOW).ok).toBe(true);
  });

  it.each(["yes", "true", "on", "1", "YES", true])("reads whatsapp=%j as consent", (whatsapp) => {
    const result = validateReservation(input({ whatsapp }), NOW);
    expect(result.ok && result.data.whatsapp).toBe(true);
  });

  it.each([null, undefined, "hello", 42])("treats body %j as all fields empty", (raw) => {
    const result = validateReservation(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["date", "email", "guests", "name", "phone", "time"]);
  });
});

describe("validateReservation: name, email, phone", () => {
  it.each([
    ["", "Please enter your full name."],
    ["A", "Please enter at least 2 characters."],
    ["x".repeat(101), "Please keep your name under 100 characters."],
    ["<script>", "Please remove special characters from your name."],
  ])("rejects name %j", (name, message) => {
    expect(errorsFor({ name }).name).toBe(message);
  });

  it("collapses a newline in the name instead of keeping it (no header injection)", () => {
    const result = validateReservation(input({ name: "Asha\nBcc: x@y.com" }), NOW);
    expect(result.ok && result.data.name).toBe("Asha Bcc: x@y.com");
  });

  it.each(["", "asha", "asha@", "asha@example", "asha@example.c", "a b@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects email %j",
    (email) => {
      expect(errorsFor({ email }).email).toBeDefined();
    },
  );

  it("rejects an email with a control character inside it", () => {
    expect(errorsFor({ email: "as\u0007ha@example.com" }).email).toBe("Please enter a valid email address.");
  });

  it.each(["9876543210", "+919876543210", "(98765) 432-10", "98765.43210"])("accepts phone %j", (phone) => {
    expect(errorsFor({ phone }).phone).toBeUndefined();
  });

  it.each(["", "12345", "+91 98765 abcde", "1".repeat(16)])("rejects phone %j", (phone) => {
    expect(errorsFor({ phone }).phone).toBeDefined();
  });
});

describe("validateReservation: dates", () => {
  it("requires a date", () => {
    expect(errorsFor({ date: "" }).date).toBe("Please choose a date.");
  });

  it.each(["28-11-2026", "2026/11/28", "2026-13-01", "2026-11-28x", "tomorrow"])("rejects malformed date %j", (date) => {
    expect(errorsFor({ date }).date).toBe("Please choose a valid date.");
  });

  it("rejects yesterday but accepts today", () => {
    expect(errorsFor({ date: "2026-11-22" }).date).toBe("Please choose today or a future date.");
    expect(errorsFor({ date: "2026-11-23", time: "19:00" })).toEqual({});
  });

  it("accepts exactly maxDaysAhead and rejects one day more", () => {
    const { maxDaysAhead } = site.reservations;
    expect(errorsFor({ date: addDays(NOW.date, maxDaysAhead) }).date).toBeUndefined();
    expect(errorsFor({ date: addDays(NOW.date, maxDaysAhead + 1) }).date).toBe("Please choose a date within the next year.");
  });

  it("works across the year boundary and on a leap day", () => {
    const newYearsEve = { date: "2027-12-31", time: "12:00" };
    expect(errorsFor({ date: "2028-01-01" }, newYearsEve).date).toBeUndefined();
    expect(errorsFor({ date: "2028-02-29" }, newYearsEve).date).toBeUndefined();
  });

  it("rejects a closed weekday", () => {
    site.reservations.closedWeekdays = [6];
    expect(errorsFor({}).date).toBe("We’re closed on Saturdays. Please choose another day.");
    expect(errorsFor({ date: "2026-11-27" }).date).toBeUndefined();
  });

  it("rejects a blackout date and every day of a blackout range", () => {
    site.reservations.blackoutDates = [
      { date: "2026-11-28", reason: "a private event" },
      { date: "2026-12-24", until: "2026-12-26" },
    ];
    expect(errorsFor({}).date).toBe("We’re closed on this date (a private event). Please choose another day.");
    for (const date of ["2026-12-24", "2026-12-25", "2026-12-26"]) {
      expect(errorsFor({ date }).date).toBe("We’re closed on this date. Please choose another day.");
    }
    expect(errorsFor({ date: "2026-12-23" }).date).toBeUndefined();
    expect(errorsFor({ date: "2026-12-27" }).date).toBeUndefined();
  });
});

describe("validateReservation: times", () => {
  it("requires a time", () => {
    expect(errorsFor({ time: "" }).time).toBe("Please choose a preferred time.");
  });

  it.each(["7:30", "19.30", "24:00", "19:60", "7:30 pm"])("rejects malformed time %j", (time) => {
    expect(errorsFor({ time }).time).toBe("Please choose a valid time.");
  });

  it("accepts the opening time and the last reservation time, and nothing outside them", () => {
    expect(errorsFor({ time: site.hours.open }).time).toBeUndefined();
    expect(errorsFor({ time: site.hours.lastReservation }).time).toBeUndefined();
    expect(errorsFor({ time: "09:45" }).time).toMatch(/^Please choose a time between/);
    expect(errorsFor({ time: "23:45" }).time).toMatch(/^Please choose a time between/);
  });

  it("only accepts times on the slot grid", () => {
    expect(errorsFor({ time: "19:15" }).time).toBeUndefined();
    expect(errorsFor({ time: "19:10" }).time).toBe("Please choose a time in 15-minute steps (for example 7:00 pm, 7:15 pm).");
  });

  it("rejects a time that has already passed today, including the current minute", () => {
    expect(errorsFor({ date: NOW.date, time: "11:45" }).time).toBe("Please choose a time later today.");
    expect(errorsFor({ date: NOW.date, time: "12:00" }).time).toBe("Please choose a time later today.");
    expect(errorsFor({ date: NOW.date, time: "12:15" }).time).toBeUndefined();
  });

  it("allows the last slot late at night until it starts", () => {
    expect(errorsFor({ date: NOW.date, time: "23:30" }, { date: NOW.date, time: "23:20" }).time).toBeUndefined();
    expect(errorsFor({ date: NOW.date, time: "23:30" }, { date: NOW.date, time: "23:30" }).time).toBe(
      "Please choose a time later today.",
    );
  });

  it("doesn't add a 'later today' error on top of a date error", () => {
    site.reservations.closedWeekdays = [1]; // NOW is a Monday
    const errors = errorsFor({ date: NOW.date, time: "11:00" });
    expect(errors.date).toBeDefined();
    expect(errors.time).toBeUndefined();
  });
});

describe("validateReservation: guests and notes", () => {
  it.each(["", "0", "-1", "1.5", "abc", String(site.reservations.maxGuests + 1)])("rejects guests %j", (guests) => {
    expect(errorsFor({ guests }).guests).toBeDefined();
  });

  it("accepts 1 guest and maxGuests", () => {
    expect(errorsFor({ guests: "1" }).guests).toBeUndefined();
    expect(errorsFor({ guests: String(site.reservations.maxGuests) }).guests).toBeUndefined();
  });

  it("limits the length of notes", () => {
    const { maxNotesLength } = site.reservations;
    expect(errorsFor({ notes: "x".repeat(maxNotesLength) }).notes).toBeUndefined();
    expect(errorsFor({ notes: "x".repeat(maxNotesLength + 1) }).notes).toBeDefined();
  });
});

describe("validateReservation: events", () => {
  // In demo mode with no real events, sample events a few days ahead are always available.
  const [event] = upcomingEvents(NOW.date);

  it("has an upcoming event to test with", () => {
    expect(event).toBeDefined();
  });

  it("takes the date and time from the event, ignoring what was sent", () => {
    const result = validateReservation(input({ event: event.id, date: "", time: "03:07" }), NOW);
    expect(result).toMatchObject({ ok: true, data: { date: event.date, time: event.time, event: event.title } });
  });

  it("rejects an unknown or past event", () => {
    expect(errorsFor({ event: "no-such-event" }).event).toMatch(/no longer available/);
    expect(errorsFor({ event: event.id }, { date: addDays(event.date, 1), time: "12:00" }).event).toMatch(/no longer available/);
  });

  it("accepts a real event on its day until it starts", () => {
    // Sample events move to next week on their own day, so use a real one here.
    const real = { id: "jazz-test", title: "Jazz Night", date: "2026-12-04", time: "19:30", description: "" };
    events.push(real);
    try {
      expect(errorsFor({ event: real.id }, { date: real.date, time: "19:15" })).toEqual({});
      expect(errorsFor({ event: real.id }, { date: real.date, time: "19:30" }).event).toBe("This event has already started.");
    } finally {
      events.pop();
    }
  });
});

describe("date and time helpers", () => {
  it("addDays crosses months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("toMinutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("19:30")).toBe(1170);
  });

  it("closedDateMessage is null on an open day", () => {
    expect(closedDateMessage("2026-11-28")).toBeNull();
  });

  it("closedWeekdaysText lists closed days in weekday order", () => {
    expect(closedWeekdaysText()).toBe("");
    site.reservations.closedWeekdays = [2];
    expect(closedWeekdaysText()).toBe("Closed on Tuesdays.");
    site.reservations.closedWeekdays = [2, 1, 3];
    expect(closedWeekdaysText()).toBe("Closed on Mondays, Tuesdays and Wednesdays.");
  });
});
