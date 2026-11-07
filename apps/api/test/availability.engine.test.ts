import { describe, expect, it } from "vitest";
import {
  bookingWindow,
  type ComputeSlotsInput,
  closureState,
  computeSlots,
  periodsForDate,
  reservationSlots,
  type WorkingHoursRule,
} from "../src/modules/availability/availability.engine";
import { isCalendarDate, localToUtc, studioToday, weekdayOf } from "../src/utils/studio-time";

const TZ = "Africa/Nairobi";
const MONDAY = "2026-11-09";
const FULL_DAY = [{ startTime: "09:00", endTime: "19:00" }];

/** UTC ISO string for a Nairobi wall-clock time on MONDAY. */
function at(time: string): string {
  return localToUtc(MONDAY, time, TZ).toISOString();
}

function slotsFor(overrides: Partial<ComputeSlotsInput> = {}) {
  return computeSlots({
    date: MONDAY,
    durationMinutes: 60,
    location: "studio",
    workingPeriods: FULL_DAY,
    timeOff: [],
    reservedSlots: new Set(),
    now: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
  }).map((slot) => slot.startAt);
}

describe("studio time", () => {
  it("converts Nairobi wall-clock time to UTC", () => {
    expect(at("09:00")).toBe("2026-11-09T06:00:00.000Z");
  });

  it("follows daylight saving in other zones", () => {
    expect(localToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe(
      "2026-07-01T08:00:00.000Z",
    );
    expect(localToUtc("2026-01-15", "09:00", "Europe/London").toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    );
  });

  it("uses the studio date, not the UTC date, for today", () => {
    expect(studioToday(new Date("2026-11-08T22:30:00.000Z"), TZ)).toBe(MONDAY);
  });

  it("numbers weekdays from Sunday", () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf("2026-11-08")).toBe(0);
  });

  it("rejects impossible calendar dates", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-2-3")).toBe(false);
  });
});

describe("reservationSlots", () => {
  it("covers a studio service plus the turnaround buffer", () => {
    expect(reservationSlots(new Date(at("10:00")), 60, "studio")).toEqual([
      at("10:00"),
      at("10:15"),
      at("10:30"),
      at("10:45"),
      at("11:00"),
    ]);
  });

  it("covers travel before and after a house call", () => {
    const slots = reservationSlots(new Date(at("10:00")), 60, "house_call");
    expect(slots).toHaveLength(12);
    expect(slots[0]).toBe(at("09:00"));
    expect(slots.at(-1)).toBe(at("11:45"));
  });

  it("rounds a partial increment up to a whole slot", () => {
    expect(reservationSlots(new Date(at("10:00")), 50, "studio")).toHaveLength(5);
  });
});

describe("computeSlots", () => {
  it("fits studio slots between opening and closing, buffer included", () => {
    const slots = slotsFor();
    expect(slots[0]).toBe(at("09:00"));
    expect(slots.at(-1)).toBe(at("17:45"));
    expect(slots).toHaveLength(36);
  });

  it("keeps house-call travel inside working hours", () => {
    const slots = slotsFor({ location: "house_call" });
    expect(slots[0]).toBe(at("10:00"));
    expect(slots.at(-1)).toBe(at("17:00"));
  });

  it("blocks every start a long service would overlap", () => {
    const reserved = new Set(reservationSlots(new Date(at("12:00")), 60, "studio"));
    const slots = slotsFor({ durationMinutes: 120, reservedSlots: reserved });
    expect(slots).toContain(at("09:45"));
    for (const blocked of ["10:00", "11:00", "12:00", "13:00"]) {
      expect(slots).not.toContain(at(blocked));
    }
    expect(slots).toContain(at("13:15"));
  });

  it("excludes starts that overlap time off", () => {
    const slots = slotsFor({
      timeOff: [{ start: Date.parse(at("14:00")), end: Date.parse(at("15:00")) }],
    });
    expect(slots).toContain(at("12:45"));
    expect(slots).not.toContain(at("13:00"));
    expect(slots).not.toContain(at("14:45"));
    expect(slots).toContain(at("15:00"));
  });

  it("applies the minimum lead time to the service start", () => {
    const slots = slotsFor({ now: new Date(at("10:05")) });
    expect(slots[0]).toBe(at("12:15"));
  });

  it("does not let a block straddle a split shift", () => {
    const slots = slotsFor({
      workingPeriods: [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "13:00", endTime: "19:00" },
      ],
    });
    expect(slots).toContain(at("10:45"));
    for (const gap of ["11:00", "11:45", "12:00", "12:45"]) {
      expect(slots).not.toContain(at(gap));
    }
    expect(slots).toContain(at("13:00"));
  });

  it("rounds a working period that starts off the grid", () => {
    expect(slotsFor({ workingPeriods: [{ startTime: "09:10", endTime: "19:00" }] })[0]).toBe(
      at("09:15"),
    );
  });
});

describe("periodsForDate", () => {
  const rule = (overrides: Partial<WorkingHoursRule>): WorkingHoursRule => ({
    weekday: 1,
    startTime: "09:00",
    endTime: "19:00",
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
    ...overrides,
  });

  it("keeps only active rules for the weekday and effective range", () => {
    const rules = [
      rule({ startTime: "09:00" }),
      rule({ startTime: "10:00", effectiveFrom: "2026-12-01" }),
      rule({ startTime: "11:00", effectiveUntil: "2026-11-08" }),
      rule({ startTime: "12:00", isActive: false }),
      rule({ startTime: "13:00", weekday: 2 }),
      rule({ startTime: "14:00", effectiveUntil: MONDAY }),
    ];
    expect(periodsForDate(rules, MONDAY).map((p) => p.startTime)).toEqual(["09:00", "14:00"]);
  });
});

describe("closureState", () => {
  const period = { start: Date.parse(at("09:00")), end: Date.parse(at("19:00")) };

  it("treats a day with no hours as closed every week", () => {
    expect(closureState([], [])).toBe("weekly_closed");
  });

  it("stays open when time off covers only part of the shift", () => {
    expect(
      closureState([period], [{ start: Date.parse(at("13:00")), end: Date.parse(at("16:00")) }]),
    ).toBe("open");
  });

  it("closes the day when every working period is covered", () => {
    const morning = { start: Date.parse(at("09:00")), end: Date.parse(at("12:00")) };
    const afternoon = { start: Date.parse(at("13:00")), end: Date.parse(at("19:00")) };
    expect(closureState([morning, afternoon], [morning])).toBe("open");
    expect(
      closureState(
        [period],
        [
          { start: period.start, end: Date.parse(at("12:00")) },
          { start: Date.parse(at("12:00")), end: period.end },
        ],
      ),
    ).toBe("closed");
    expect(closureState([morning, afternoon], [morning, afternoon])).toBe("closed");
  });
});

describe("bookingWindow", () => {
  it("runs from the studio's today for the configured number of days", () => {
    expect(bookingWindow(new Date("2026-11-08T22:30:00.000Z"))).toEqual({
      firstDate: MONDAY,
      lastDate: "2027-01-08",
    });
  });
});
