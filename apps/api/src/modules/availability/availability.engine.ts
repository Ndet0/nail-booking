import type { AppointmentLocation, AvailabilitySlotDto } from "@nailsbychao/types";
import { STUDIO } from "../../config/studio";
import { addDays, localToUtc, studioToday, weekdayOf } from "../../utils/studio-time";

const MINUTE_MS = 60_000;
const SLOT_MS = STUDIO.slotMinutes * MINUTE_MS;

/** Epoch milliseconds, end exclusive. */
export type Interval = { start: number; end: number };

export type WorkingHoursRule = {
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
};

export type WorkingPeriod = Pick<WorkingHoursRule, "startTime" | "endTime">;

function buffersFor(location: AppointmentLocation) {
  return location === "house_call"
    ? { before: STUDIO.houseCallTravelBufferMinutes, after: STUDIO.houseCallTravelBufferMinutes }
    : { before: 0, after: STUDIO.turnaroundBufferMinutes };
}

/** The time a booking takes out of the schedule: the service plus its buffers. */
export function blockFor(
  serviceStart: Date,
  durationMinutes: number,
  location: AppointmentLocation,
): Interval {
  const { before, after } = buffersFor(location);
  const start = serviceStart.getTime();
  return {
    start: start - before * MINUTE_MS,
    end: start + (durationMinutes + after) * MINUTE_MS,
  };
}

/**
 * Canonical slot starts (`appointment_slot_reservations.slot_start_at`) covering a booking's block.
 * Availability and booking creation must both use this so they agree on what is taken.
 */
export function reservationSlots(
  serviceStart: Date,
  durationMinutes: number,
  location: AppointmentLocation,
): string[] {
  const { start, end } = blockFor(serviceStart, durationMinutes, location);
  const slots: string[] = [];
  for (let t = Math.floor(start / SLOT_MS) * SLOT_MS; t < end; t += SLOT_MS) {
    slots.push(new Date(t).toISOString());
  }
  return slots;
}

/** First and last dates customers may book, in the studio timezone. */
export function bookingWindow(now: Date) {
  const firstDate = studioToday(now, STUDIO.timezone);
  return { firstDate, lastDate: addDays(firstDate, STUDIO.maxAdvanceDays) };
}

/** Working periods that apply on `date`: active, matching weekday, within the effective range. */
export function periodsForDate(rules: readonly WorkingHoursRule[], date: string): WorkingPeriod[] {
  const weekday = weekdayOf(date);
  return rules
    .filter(
      (rule) =>
        rule.isActive &&
        rule.weekday === weekday &&
        rule.effectiveFrom <= date &&
        (rule.effectiveUntil === null || rule.effectiveUntil >= date),
    )
    .map(({ startTime, endTime }) => ({ startTime, endTime }));
}

export type ComputeSlotsInput = {
  date: string;
  durationMinutes: number;
  location: AppointmentLocation;
  workingPeriods: WorkingPeriod[];
  timeOff: Interval[];
  reservedSlots: ReadonlySet<string>;
  now: Date;
  /** Defaults to the public booking lead time. Rescheduling passes the 24-hour cutoff. */
  minLeadTimeMinutes?: number;
};

/**
 * Service start times for one staff member on `date`. A start is offered only if its whole block
 * (buffers included) fits in one working period and touches no time off or reserved slot.
 */
export function computeSlots(input: ComputeSlotsInput): AvailabilitySlotDto[] {
  const { before } = buffersFor(input.location);
  const leadMinutes = input.minLeadTimeMinutes ?? STUDIO.minLeadTimeMinutes;
  const earliestStart = input.now.getTime() + leadMinutes * MINUTE_MS;
  const slots: AvailabilitySlotDto[] = [];

  for (const period of input.workingPeriods) {
    const periodStart = localToUtc(input.date, period.startTime, STUDIO.timezone).getTime();
    const periodEnd = localToUtc(input.date, period.endTime, STUDIO.timezone).getTime();

    for (
      let blockStart = Math.ceil(periodStart / SLOT_MS) * SLOT_MS;
      blockStart < periodEnd;
      blockStart += SLOT_MS
    ) {
      const serviceStart = new Date(blockStart + before * MINUTE_MS);
      const block = blockFor(serviceStart, input.durationMinutes, input.location);
      if (block.end > periodEnd) break;
      if (serviceStart.getTime() < earliestStart) continue;
      if (input.timeOff.some((off) => block.start < off.end && block.end > off.start)) continue;
      const taken = reservationSlots(serviceStart, input.durationMinutes, input.location).some(
        (slot) => input.reservedSlots.has(slot),
      );
      if (taken) continue;

      slots.push({
        startAt: serviceStart.toISOString(),
        endAt: new Date(serviceStart.getTime() + input.durationMinutes * MINUTE_MS).toISOString(),
      });
    }
  }
  return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export type ClosureState = "open" | "closed" | "weekly_closed";

/** True when `covers` together include every instant of `target`. Touching an edge does not count. */
export function intervalCovered(target: Interval, covers: readonly Interval[]): boolean {
  if (target.end <= target.start) return true;
  const pieces = covers
    .filter((item) => item.start < target.end && item.end > target.start)
    .map((item) => ({
      start: Math.max(item.start, target.start),
      end: Math.min(item.end, target.end),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cursor = target.start;
  for (const piece of pieces) {
    if (piece.start > cursor) return false;
    if (piece.end > cursor) cursor = piece.end;
    if (cursor >= target.end) return true;
  }
  return false;
}

/** A day with no working hours is weekly-closed. Time off must cover every period to close it. */
export function closureState(
  periods: readonly Interval[],
  timeOff: readonly Interval[],
): ClosureState {
  if (periods.length === 0) return "weekly_closed";
  return periods.every((period) => intervalCovered(period, timeOff)) ? "closed" : "open";
}

/** Merges per-staff results: a time is available if any staff member is free. */
export function unionSlots(perStaff: AvailabilitySlotDto[][]): AvailabilitySlotDto[] {
  const byStart = new Map<string, AvailabilitySlotDto>();
  for (const slot of perStaff.flat()) byStart.set(slot.startAt, slot);
  return [...byStart.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
}
