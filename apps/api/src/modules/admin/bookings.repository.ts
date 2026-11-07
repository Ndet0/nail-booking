import type { AdminBookingDto, BookingStatus, Page } from "@nailsbychao/types";
import { and, asc, eq, gte, lt, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { appointmentSlotReservations, appointments, staff } from "../../db/schema";
import { decodeCursor, encodeCursor, pageOf } from "../../utils/cursor";
import { AppError } from "../../utils/errors";
import { auditInsertIfChanged } from "../auth/audit";
import {
  customerStatusNotification,
  notificationInsertIfChanged,
} from "../notifications/notifications";
import { runBatch } from "./batch";
import { canTransition } from "./booking-status";

type ListFilters = {
  status?: BookingStatus;
  fromInstant?: string;
  toInstant?: string;
  cursor?: string;
  limit: number;
};

function toAdminBooking(row: typeof appointments.$inferSelect, staffName: string): AdminBookingDto {
  return {
    id: row.id,
    bookingReference: row.bookingReference,
    status: row.status,
    serviceId: row.serviceId,
    serviceName: row.serviceNameSnapshot,
    durationMinutes: row.durationMinutesSnapshot,
    priceMinor: row.priceMinorSnapshot,
    currency: row.currency,
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    address: row.address,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerNotes: row.customerNotes,
    travelFeeMinor: row.travelFeeMinor,
    staffId: row.staffId,
    staffName,
    createdAt: row.createdAt,
    rescheduledAt: row.rescheduledAt,
  };
}

export async function listAdminBookings(
  db: Db,
  filters: ListFilters,
): Promise<Page<AdminBookingDto>> {
  let cursorStart: string | undefined;
  let cursorId: string | undefined;
  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (!decoded.startAt || !decoded.id) {
      throw new AppError(400, "validation_error", "The request is invalid.");
    }
    cursorStart = decoded.startAt;
    cursorId = decoded.id;
  }

  const rows = await db
    .select({ appointment: appointments, staffName: staff.name })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(
      and(
        filters.status ? eq(appointments.status, filters.status) : undefined,
        filters.fromInstant ? gte(appointments.startAt, filters.fromInstant) : undefined,
        filters.toInstant ? lt(appointments.startAt, filters.toInstant) : undefined,
        cursorStart && cursorId
          ? or(
              sql`${appointments.startAt} > ${cursorStart}`,
              and(eq(appointments.startAt, cursorStart), sql`${appointments.id} > ${cursorId}`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(appointments.startAt), asc(appointments.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) =>
    encodeCursor({ startAt: row.appointment.startAt, id: row.appointment.id }),
  );
  return {
    items: page.items.map((row) => toAdminBooking(row.appointment, row.staffName)),
    nextCursor: page.nextCursor,
  };
}

export async function getAdminBooking(db: Db, id: string): Promise<AdminBookingDto | null> {
  const row = await db
    .select({ appointment: appointments, staffName: staff.name })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(eq(appointments.id, id))
    .get();
  return row ? toAdminBooking(row.appointment, row.staffName) : null;
}

export async function changeBookingStatus(
  db: Db,
  actorId: string,
  id: string,
  next: BookingStatus,
): Promise<AdminBookingDto> {
  const current = await db.select().from(appointments).where(eq(appointments.id, id)).get();
  if (!current) {
    throw new AppError(404, "booking_not_found", "That booking was not found.");
  }
  if (!canTransition(current.status, next)) {
    throw new AppError(
      409,
      "invalid_status_transition",
      `A ${current.status} booking cannot become ${next}.`,
    );
  }

  const notice = customerStatusNotification(current, next);
  const [changed] = await runBatch(db, [
    db
      .update(appointments)
      .set({ status: next, updatedAt: new Date().toISOString() })
      .where(and(eq(appointments.id, id), eq(appointments.status, current.status)))
      .returning({ id: appointments.id }),
    ...(notice ? [notificationInsertIfChanged(db, notice)] : []),
    auditInsertIfChanged(db, {
      actorId,
      action: "booking.status_changed",
      entityType: "appointment",
      entityId: id,
    }),
    ...(next === "cancelled"
      ? [
          db
            .delete(appointmentSlotReservations)
            .where(
              and(
                eq(appointmentSlotReservations.appointmentId, id),
                sql`EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.id} = ${id} AND ${appointments.status} = 'cancelled')`,
              ),
            ),
        ]
      : []),
  ]);
  if ((changed as { id: string }[]).length === 0) {
    throw new AppError(
      409,
      "booking_status_changed",
      "This booking was just updated. Reload and try again.",
    );
  }

  const updated = await getAdminBooking(db, id);
  if (!updated) throw new AppError(404, "booking_not_found", "That booking was not found.");
  return updated;
}
