import type {
  AdminCalendarDto,
  CalendarBlockDto,
  CalendarBookingDto,
  CalendarDayDto,
} from "@nailsbychao/types";
import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { STUDIO } from "../../config/studio";
import type { Db } from "../../db/client";
import { appointments, staff, staffTimeOff } from "../../db/schema";
import { AppError } from "../../utils/errors";
import { addDays, localToUtc, studioToday } from "../../utils/studio-time";
import { auditInsert } from "../auth/audit";
import { bookingWindow } from "../availability/availability.engine";
import { listTimeOffSpans, listWorkingHourRules } from "../availability/availability.repository";
import { datesBetween, staffClosureState, timeOffOnDay } from "../availability/closed-days";
import { runBatch } from "./batch";

const WEEKLY_CLOSED =
  "This day is closed every week. Change weekly hours on the staff page to open it.";

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function requireStaff(db: Db, staffId: string) {
  const existing = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).get();
  if (!existing) throw new AppError(404, "staff_not_found", "That staff member was not found.");
}

function assertBookable(date: string, now: Date) {
  const { firstDate, lastDate } = bookingWindow(now);
  if (date < firstDate || date > lastDate) {
    throw new AppError(
      400,
      "date_out_of_range",
      `Choose a date between ${firstDate} and ${lastDate}.`,
    );
  }
}

async function dayRecords(db: Db, staffId: string, from: string, to: string) {
  const start = localToUtc(from, "00:00", STUDIO.timezone);
  const end = localToUtc(addDays(to, 1), "00:00", STUDIO.timezone);
  const [blocks, bookings] = await Promise.all([
    db
      .select({
        id: staffTimeOff.id,
        startAt: staffTimeOff.startAt,
        endAt: staffTimeOff.endAt,
        reason: staffTimeOff.reason,
      })
      .from(staffTimeOff)
      .where(
        and(
          eq(staffTimeOff.staffId, staffId),
          lt(staffTimeOff.startAt, end.toISOString()),
          gt(staffTimeOff.endAt, start.toISOString()),
        ),
      ),
    db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.staffId, staffId),
          inArray(appointments.status, ["pending", "confirmed"]),
          gte(appointments.startAt, start.toISOString()),
          lt(appointments.startAt, end.toISOString()),
        ),
      ),
  ]);
  return { blocks, bookings };
}

function blocksOnDate(date: string, blocks: readonly CalendarBlockDto[]): CalendarBlockDto[] {
  const start = localToUtc(date, "00:00", STUDIO.timezone).getTime();
  const end = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone).getTime();
  return blocks
    .filter((block) => Date.parse(block.startAt) < end && Date.parse(block.endAt) > start)
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));
}

function bookingsOnDate(
  date: string,
  bookings: readonly CalendarBookingDto[],
): CalendarBookingDto[] {
  return bookings
    .filter((booking) => studioToday(new Date(booking.startAt), STUDIO.timezone) === date)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

async function calendarDays(
  db: Db,
  staffId: string,
  dates: readonly string[],
): Promise<CalendarDayDto[]> {
  const from = dates[0];
  const to = dates.at(-1);
  if (!from || !to) return [];
  const [rules, records] = await Promise.all([
    listWorkingHourRules(db, [staffId]),
    dayRecords(db, staffId, from, to),
  ]);
  const spans = records.blocks.map((block) => ({
    id: block.id,
    staffId,
    start: Date.parse(block.startAt),
    end: Date.parse(block.endAt),
  }));
  return dates.map((date) => {
    const bookings = bookingsOnDate(date, records.bookings);
    return {
      date,
      state: staffClosureState(date, rules, spans, staffId),
      bookingCount: bookings.length,
      blocks: blocksOnDate(date, records.blocks),
      bookings,
    };
  });
}

export async function readAdminCalendar(
  db: Db,
  staffId: string,
  from: string,
  to: string,
  now = new Date(),
): Promise<AdminCalendarDto> {
  await requireStaff(db, staffId);
  const dates = datesBetween(from, to);
  const { firstDate, lastDate } = bookingWindow(now);
  return {
    staffId,
    timezone: STUDIO.timezone,
    firstBookableDate: firstDate,
    lastBookableDate: lastDate,
    days: await calendarDays(db, staffId, dates),
  };
}

export async function closeCalendarDay(
  db: Db,
  actorId: string,
  staffId: string,
  date: string,
  now = new Date(),
): Promise<CalendarDayDto> {
  assertBookable(date, now);
  await requireStaff(db, staffId);
  const [current] = await calendarDays(db, staffId, [date]);
  if (!current) throw new AppError(400, "validation_error", "The request is invalid.");
  if (current.state === "weekly_closed") throw new AppError(409, "weekly_closed", WEEKLY_CLOSED);
  if (current.state === "closed") return current;

  const id = newId("off");
  const startAt = localToUtc(date, "00:00", STUDIO.timezone).toISOString();
  const endAt = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone).toISOString();
  await runBatch(db, [
    db.insert(staffTimeOff).values({
      id,
      staffId,
      startAt,
      endAt,
      reason: null,
      createdAt: now.toISOString(),
    }),
    auditInsert(db, { actorId, action: "time_off.created", entityType: "time_off", entityId: id }),
  ]);
  const [closed] = await calendarDays(db, staffId, [date]);
  if (!closed) throw new AppError(400, "validation_error", "The request is invalid.");
  return closed;
}

export async function reopenCalendarDay(
  db: Db,
  actorId: string,
  staffId: string,
  date: string,
  now = new Date(),
): Promise<CalendarDayDto> {
  assertBookable(date, now);
  await requireStaff(db, staffId);
  const [current] = await calendarDays(db, staffId, [date]);
  if (!current) throw new AppError(400, "validation_error", "The request is invalid.");
  if (current.state === "weekly_closed") throw new AppError(409, "weekly_closed", WEEKLY_CLOSED);
  if (current.state === "open") return current;

  const rangeStart = localToUtc(date, "00:00", STUDIO.timezone);
  const rangeEnd = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone);
  const spans = await listTimeOffSpans(db, [staffId], rangeStart, rangeEnd);
  const ids = spans
    .filter((span) => timeOffOnDay([span], staffId, date).length > 0)
    .map((span) => span.id);
  if (ids.length > 0) {
    await runBatch(db, [
      db.delete(staffTimeOff).where(inArray(staffTimeOff.id, ids)),
      ...ids.map((id) =>
        auditInsert(db, {
          actorId,
          action: "time_off.deleted",
          entityType: "time_off",
          entityId: id,
        }),
      ),
    ]);
  }
  const [reopened] = await calendarDays(db, staffId, [date]);
  if (!reopened) throw new AppError(400, "validation_error", "The request is invalid.");
  return reopened;
}
