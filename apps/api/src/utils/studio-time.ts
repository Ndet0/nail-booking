/**
 * Calendar dates are `YYYY-MM-DD` strings in the studio's timezone; instants are `Date`s.
 * Offsets come from `Intl`, so zones with daylight saving are handled too.
 */

const MINUTE_MS = 60_000;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(instant)) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Minutes the zone is ahead of UTC at `instant`, e.g. 180 for Africa/Nairobi. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS;
  return Math.round((asUtc - truncated) / MINUTE_MS);
}

function parseDate(date: string): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

/** Today's calendar date in `timeZone`. */
export function studioToday(now: Date, timeZone: string): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday through 6 = Saturday, matching `staff_working_hours.weekday`. */
export function weekdayOf(date: string): number {
  const [year, month, day] = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** True for a real calendar date in `YYYY-MM-DD` form (rejects e.g. 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

/** The instant at local wall-clock `time` (`HH:MM`) on `date` in `timeZone`. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = parseDate(date);
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const guess = naive - offsetMinutes(new Date(naive), timeZone) * MINUTE_MS;
  // A second pass corrects guesses that land on the other side of a DST change.
  return new Date(naive - offsetMinutes(new Date(guess), timeZone) * MINUTE_MS);
}
