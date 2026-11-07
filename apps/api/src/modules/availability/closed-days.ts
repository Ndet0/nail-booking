import type { BookingClosedDatesDto, ClosedDatesDto } from "@nailsbychao/types";
import { STUDIO } from "../../config/studio";
import type { Db } from "../../db/client";
import { AppError } from "../../utils/errors";
import { addDays, localToUtc } from "../../utils/studio-time";
import { getActiveServiceById } from "../services/services.repository";
import {
  bookingWindow,
  type ClosureState,
  closureState,
  type Interval,
  periodsForDate,
  type WorkingHoursRule,
} from "./availability.engine";
import {
  listEligibleStaffIds,
  listTimeOffSpans,
  listWorkingHourRules,
  type TimeOffSpan,
} from "./availability.repository";

const MAX_CALENDAR_DAYS = 62;

export function datesBetween(from: string, to: string): string[] {
  if (to < from) {
    throw new AppError(400, "validation_error", "The end date must be on or after the start date.");
  }
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
    if (dates.length > MAX_CALENDAR_DAYS) {
      throw new AppError(400, "validation_error", `Choose at most ${MAX_CALENDAR_DAYS} days.`);
    }
  }
  return dates;
}

/** Dates customers may book. `from` and `to` must both sit inside the booking window. */
export function datesInBookingWindow(from: string, to: string, now = new Date()): string[] {
  const { firstDate, lastDate } = bookingWindow(now);
  if (from < firstDate || to > lastDate || to < from) {
    throw new AppError(
      400,
      "date_out_of_range",
      `Choose dates between ${firstDate} and ${lastDate}.`,
    );
  }
  return datesBetween(from, to);
}

export function workingIntervals(date: string, rules: readonly WorkingHoursRule[]): Interval[] {
  return periodsForDate(rules, date).map((period) => ({
    start: localToUtc(date, period.startTime, STUDIO.timezone).getTime(),
    end: localToUtc(date, period.endTime, STUDIO.timezone).getTime(),
  }));
}

export function timeOffOnDay(
  spans: readonly TimeOffSpan[],
  staffId: string,
  date: string,
): Interval[] {
  const start = localToUtc(date, "00:00", STUDIO.timezone).getTime();
  const end = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone).getTime();
  return spans
    .filter((span) => span.staffId === staffId && span.start < end && span.end > start)
    .map(({ start: offStart, end: offEnd }) => ({ start: offStart, end: offEnd }));
}

export function staffClosureState(
  date: string,
  rules: readonly WorkingHoursRule[],
  spans: readonly TimeOffSpan[],
  staffId: string,
): ClosureState {
  return closureState(workingIntervals(date, rules), timeOffOnDay(spans, staffId, date));
}

/** Closed when nobody who performs the service is open that day. No staff means every day is closed. */
export function closedDatesForStaff(
  dates: readonly string[],
  staffIds: readonly string[],
  rules: readonly (WorkingHoursRule & { staffId: string })[],
  spans: readonly TimeOffSpan[],
): string[] {
  return dates.filter((date) =>
    staffIds.every((staffId) => {
      const ownRules = rules.filter((rule) => rule.staffId === staffId);
      return staffClosureState(date, ownRules, spans, staffId) !== "open";
    }),
  );
}

export async function readServiceClosedDates(
  db: Db,
  serviceId: string,
  from: string,
  to: string,
  now = new Date(),
): Promise<ClosedDatesDto> {
  const dates = datesInBookingWindow(from, to, now);
  const service = await getActiveServiceById(db, serviceId);
  if (!service) throw new AppError(404, "service_not_found", "This service is not available.");

  const staffIds = await listEligibleStaffIds(db, serviceId);
  const closed = await closedDatesForIds(db, staffIds, dates);
  return { serviceId, timezone: STUDIO.timezone, from, to, dates: closed };
}

export async function readStaffClosedDates(
  db: Db,
  staffId: string,
  from: string,
  to: string,
  now = new Date(),
): Promise<BookingClosedDatesDto> {
  const dates = datesInBookingWindow(from, to, now);
  return {
    timezone: STUDIO.timezone,
    from,
    to,
    dates: await closedDatesForIds(db, [staffId], dates),
  };
}

async function closedDatesForIds(
  db: Db,
  staffIds: readonly string[],
  dates: readonly string[],
): Promise<string[]> {
  const from = dates[0];
  const to = dates.at(-1);
  if (!from || !to) return [];
  const rangeStart = localToUtc(from, "00:00", STUDIO.timezone);
  const rangeEnd = localToUtc(addDays(to, 1), "00:00", STUDIO.timezone);
  const [rules, spans] = await Promise.all([
    listWorkingHourRules(db, staffIds),
    listTimeOffSpans(db, staffIds, rangeStart, rangeEnd),
  ]);
  return closedDatesForStaff(dates, staffIds, rules, spans);
}
