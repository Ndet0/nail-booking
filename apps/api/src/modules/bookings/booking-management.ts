import type { AvailabilityDto, BookingDto } from "@nailsbychao/types";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { STUDIO } from "../../config/studio";
import type { Db } from "../../db/client";
import { type AppointmentRow, appointmentSlotReservations, appointments } from "../../db/schema";
import { AppError } from "../../utils/errors";
import { addDays, localToUtc, studioToday } from "../../utils/studio-time";
import { runBatch } from "../admin/batch";
import { bookingWindow, computeSlots, reservationSlots } from "../availability/availability.engine";
import {
  getReservedSlots,
  getTimeOff,
  getWorkingPeriods,
} from "../availability/availability.repository";
import { sha256Hex, toBookingDto, uniqueConstraintTarget } from "./bookings.repository";

const LINK_INVALID = "That booking link is not valid.";
const WINDOW_CLOSED =
  "Changes close 24 hours before the appointment. Contact Chao to cancel or move it.";
const ALREADY_MOVED = "This booking has already been moved once. Contact Chao to change it again.";
const CHOOSE_LATER = "Choose a time at least 24 hours from now.";
const SLOT_TAKEN = "That time was just taken. Please choose another.";
const JUST_UPDATED = "This booking was just updated. Reload and try again.";

const DUMMY_HASH = "0".repeat(64);

/** Same answer for a missing booking, a missing token, and a wrong token. */
export async function requireBooking(
  db: Db,
  reference: string,
  token: string | undefined,
): Promise<AppointmentRow> {
  const presentedHash = await sha256Hex(token?.trim() ?? "");
  const row =
    (await db
      .select()
      .from(appointments)
      .where(eq(appointments.bookingReference, reference))
      .get()) ?? null;
  const stored = row?.managementTokenHash ?? DUMMY_HASH;
  if (!row || !hashesMatch(stored, presentedHash)) {
    throw new AppError(401, "unauthenticated", LINK_INVALID);
  }
  return row;
}

export function getCustomerBooking(row: AppointmentRow): BookingDto {
  return toBookingDto(row, null);
}

export async function bookingAvailability(
  db: Db,
  row: AppointmentRow,
  date: string,
  now = new Date(),
): Promise<AvailabilityDto> {
  assertCustomerCanChange(row, now, "reschedule");
  const { firstDate, lastDate } = bookingWindow(now);
  if (date < firstDate || date > lastDate) {
    throw new AppError(
      400,
      "date_out_of_range",
      `Choose a date between ${firstDate} and ${lastDate}.`,
    );
  }

  return {
    serviceId: row.serviceId,
    date,
    location: row.location,
    timezone: STUDIO.timezone,
    lastBookableDate: lastDate,
    slots: await offeredStarts(db, row, date, now),
  };
}

export async function cancelBooking(
  db: Db,
  row: AppointmentRow,
  now = new Date(),
): Promise<BookingDto> {
  assertCustomerCanChange(row, now, "cancel");

  const [changed] = await runBatch(db, [
    db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: now.toISOString() })
      .where(
        and(
          eq(appointments.id, row.id),
          inArray(appointments.status, ["pending", "confirmed"]),
          eq(appointments.startAt, row.startAt),
        ),
      )
      .returning({ id: appointments.id }),
    db
      .delete(appointmentSlotReservations)
      .where(
        and(
          eq(appointmentSlotReservations.appointmentId, row.id),
          sql`EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.id} = ${row.id} AND ${appointments.status} = 'cancelled')`,
        ),
      ),
  ]);
  if ((changed as { id: string }[]).length === 0) {
    throw new AppError(409, "booking_not_changeable", JUST_UPDATED);
  }

  return toBookingDto(await reload(db, row.id), null);
}

export async function rescheduleBooking(
  db: Db,
  row: AppointmentRow,
  startAt: string,
  now = new Date(),
): Promise<BookingDto> {
  assertCustomerCanChange(row, now, "reschedule");
  if (startAt === row.startAt) {
    throw new AppError(400, "validation_error", "That is already your time.");
  }
  if (!isOutsideCutoff(startAt, now)) {
    throw new AppError(409, "change_window_closed", CHOOSE_LATER);
  }

  const start = new Date(startAt);
  const date = studioToday(start, STUDIO.timezone);
  const { firstDate, lastDate } = bookingWindow(now);
  if (date < firstDate || date > lastDate) {
    throw new AppError(
      400,
      "date_out_of_range",
      `Choose a date between ${firstDate} and ${lastDate}.`,
    );
  }

  const offered = await offeredStarts(db, row, date, now);
  if (!offered.some((slot) => slot.startAt === startAt)) {
    throw new AppError(409, "slot_taken", SLOT_TAKEN);
  }

  const endAt = new Date(start.getTime() + row.durationMinutesSnapshot * 60_000).toISOString();
  const rescheduledAt = now.toISOString();
  const slots = reservationSlots(start, row.durationMinutesSnapshot, row.location);
  if (slots.length === 0) throw new Error("A booking must reserve at least one slot.");

  try {
    const [changed] = await runBatch(db, [
      db
        .update(appointments)
        .set({ startAt, endAt, rescheduledAt, updatedAt: rescheduledAt })
        .where(
          and(
            eq(appointments.id, row.id),
            inArray(appointments.status, ["pending", "confirmed"]),
            isNull(appointments.rescheduledAt),
            eq(appointments.startAt, row.startAt),
          ),
        )
        .returning({ id: appointments.id }),
      db.delete(appointmentSlotReservations).where(
        and(
          eq(appointmentSlotReservations.appointmentId, row.id),
          sql`EXISTS (
            SELECT 1 FROM ${appointments}
            WHERE ${appointments.id} = ${row.id}
              AND ${appointments.rescheduledAt} = ${rescheduledAt}
              AND ${appointments.startAt} = ${startAt}
          )`,
        ),
      ),
      ...slots.map((slot) =>
        db.insert(appointmentSlotReservations).select(
          sql`SELECT ${row.staffId}, ${slot}, ${row.id}
              WHERE EXISTS (
                SELECT 1 FROM ${appointments}
                WHERE ${appointments.id} = ${row.id}
                  AND ${appointments.rescheduledAt} = ${rescheduledAt}
                  AND ${appointments.startAt} = ${startAt}
              )`,
        ),
      ),
    ]);
    if ((changed as { id: string }[]).length === 0) {
      const fresh = await reload(db, row.id);
      if (fresh.rescheduledAt) throw new AppError(409, "already_rescheduled", ALREADY_MOVED);
      throw new AppError(409, "booking_not_changeable", JUST_UPDATED);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (uniqueConstraintTarget(error)?.includes("appointment_slot_reservations")) {
      throw new AppError(409, "slot_taken", SLOT_TAKEN);
    }
    throw error;
  }

  return toBookingDto(await reload(db, row.id), null);
}

function assertCustomerCanChange(
  row: AppointmentRow,
  now: Date,
  action: "cancel" | "reschedule",
): void {
  if (row.status !== "pending" && row.status !== "confirmed") {
    throw new AppError(409, "booking_not_changeable", blockedStatusMessage(row.status));
  }
  if (!isOutsideCutoff(row.startAt, now)) {
    throw new AppError(409, "change_window_closed", WINDOW_CLOSED);
  }
  if (action === "reschedule" && row.rescheduledAt) {
    throw new AppError(409, "already_rescheduled", ALREADY_MOVED);
  }
}

function blockedStatusMessage(status: AppointmentRow["status"]): string {
  switch (status) {
    case "cancelled":
      return "This booking is already cancelled.";
    case "completed":
      return "This appointment is already complete.";
    case "no_show":
      return "This appointment can no longer be changed.";
    default:
      return "This booking can no longer be changed.";
  }
}

/** True when `startAt` is still at least the customer change cutoff away. */
function isOutsideCutoff(startAt: string, now: Date): boolean {
  return Date.parse(startAt) - now.getTime() >= STUDIO.customerChangeCutoffMinutes * 60_000;
}

/** Times this booking can move to. Its own slots are ignored, and the current start is omitted. */
async function offeredStarts(db: Db, row: AppointmentRow, date: string, now: Date) {
  const dayStart = localToUtc(date, "00:00", STUDIO.timezone);
  const dayEnd = localToUtc(addDays(date, 1), "00:00", STUDIO.timezone);
  const [workingPeriods, timeOff, reservedSlots] = await Promise.all([
    getWorkingPeriods(db, row.staffId, date),
    getTimeOff(db, row.staffId, dayStart, dayEnd),
    getReservedSlots(db, row.staffId, dayStart, dayEnd, row.id),
  ]);
  return computeSlots({
    date,
    durationMinutes: row.durationMinutesSnapshot,
    location: row.location,
    workingPeriods,
    timeOff,
    reservedSlots,
    now,
    minLeadTimeMinutes: STUDIO.customerChangeCutoffMinutes,
  }).filter((slot) => slot.startAt !== row.startAt);
}

async function reload(db: Db, id: string): Promise<AppointmentRow> {
  const row = await db.select().from(appointments).where(eq(appointments.id, id)).get();
  if (!row) throw new Error("Booking update did not persist.");
  return row;
}

/** Compares equal-length hashes without returning early on the first differing character. */
function hashesMatch(stored: string, presented: string): boolean {
  const length = Math.max(stored.length, presented.length);
  let diff = stored.length ^ presented.length;
  for (let index = 0; index < length; index++) {
    diff |= (stored.charCodeAt(index) || 0) ^ (presented.charCodeAt(index) || 0);
  }
  return diff === 0;
}
