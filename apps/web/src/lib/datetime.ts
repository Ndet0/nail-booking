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
const monthYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function dateAtUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function studioToday(): string {
  return todayFormatter.format(new Date());
}

/** Calendar date of a UTC instant, in studio time. `YYYY-MM-DD`. */
export function studioDateOf(instant: string): string {
  return todayFormatter.format(new Date(instant));
}

export function addDays(date: string, days: number): string {
  const next = dateAtUtcMidnight(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** `YYYY-MM-01` for the month that contains `date`. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** First day of the month `months` away from the month containing `date`. */
export function shiftMonth(date: string, months: number): string {
  const value = dateAtUtcMidnight(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1))
    .toISOString()
    .slice(0, 10);
}

/** 0 = Sunday through 6 = Saturday. */
export function weekdayIndex(date: string): number {
  return dateAtUtcMidnight(date).getUTCDay();
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

/** e.g. "November 2026". */
export function formatMonth(date: string): string {
  return monthYearFormatter.format(dateAtUtcMidnight(date));
}

/** e.g. "10:00", in studio time. */
export function formatTime(instant: string): string {
  return timeFormatter.format(new Date(instant));
}

/**
 * UTC instant for a Nairobi wall-clock time. Kenya is UTC+3 and does not observe daylight saving.
 */
export function nairobiToUtc(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new Error("Use a date and a time.");
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute)).toISOString();
}
