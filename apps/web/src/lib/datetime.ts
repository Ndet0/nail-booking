/**
 * Dates and times are always shown in studio time, whatever timezone the customer's phone uses.
 * Calendar dates are `YYYY-MM-DD` strings; instants are UTC ISO strings from the API.
 */
export const STUDIO_TIMEZONE = "Africa/Nairobi";
const LOCALE = "en-KE";

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDIO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: STUDIO_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Calendar dates are anchored at UTC midnight, so format them in UTC to keep the same day.
const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" });

function dateAtUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function studioToday(): string {
  return todayFormatter.format(new Date());
}

export function addDays(date: string, days: number): string {
  const next = dateAtUtcMidnight(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Inclusive list of dates from `first` to `last`. */
export function datesBetween(first: string, last: string): string[] {
  const dates: string[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function dayParts(date: string) {
  const value = dateAtUtcMidnight(date);
  return {
    weekday: weekdayFormatter.format(value),
    day: String(value.getUTCDate()),
    month: monthFormatter.format(value),
  };
}

/** e.g. "Tue 10 Nov". */
export function formatDay(date: string): string {
  const { weekday, day, month } = dayParts(date);
  return `${weekday} ${day} ${month}`;
}

/** e.g. "10:00", in studio time. */
export function formatTime(instant: string): string {
  return timeFormatter.format(new Date(instant));
}
