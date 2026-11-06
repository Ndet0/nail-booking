import { and, eq, gt, gte, lt, ne } from "drizzle-orm";
import type { Db } from "../../db/client";
import {
  appointmentSlotReservations,
  staff,
  staffServices,
  staffTimeOff,
  staffWorkingHours,
} from "../../db/schema";
import { weekdayOf } from "../../utils/studio-time";
import { type Interval, periodsForDate, type WorkingPeriod } from "./availability.engine";

export async function listEligibleStaffIds(db: Db, serviceId: string): Promise<string[]> {
  const rows = await db
    .select({ id: staff.id })
    .from(staffServices)
    .innerJoin(staff, eq(staff.id, staffServices.staffId))
    .where(and(eq(staffServices.serviceId, serviceId), eq(staff.isActive, true)));
  return rows.map((row) => row.id);
}

export async function getWorkingPeriods(
  db: Db,
  staffId: string,
  date: string,
): Promise<WorkingPeriod[]> {
  const rules = await db
    .select()
    .from(staffWorkingHours)
    .where(
      and(eq(staffWorkingHours.staffId, staffId), eq(staffWorkingHours.weekday, weekdayOf(date))),
    );
  return periodsForDate(rules, date);
}

/** Time off overlapping [from, to). Instants are canonical ISO strings, so text order is time order. */
export async function getTimeOff(
  db: Db,
  staffId: string,
  from: Date,
  to: Date,
): Promise<Interval[]> {
  const rows = await db
    .select({ startAt: staffTimeOff.startAt, endAt: staffTimeOff.endAt })
    .from(staffTimeOff)
    .where(
      and(
        eq(staffTimeOff.staffId, staffId),
        lt(staffTimeOff.startAt, to.toISOString()),
        gt(staffTimeOff.endAt, from.toISOString()),
      ),
    );
  return rows.map((row) => ({ start: Date.parse(row.startAt), end: Date.parse(row.endAt) }));
}

export async function getReservedSlots(
  db: Db,
  staffId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ slotStartAt: appointmentSlotReservations.slotStartAt })
    .from(appointmentSlotReservations)
    .where(
      and(
        eq(appointmentSlotReservations.staffId, staffId),
        gte(appointmentSlotReservations.slotStartAt, from.toISOString()),
        lt(appointmentSlotReservations.slotStartAt, to.toISOString()),
        excludeAppointmentId
          ? ne(appointmentSlotReservations.appointmentId, excludeAppointmentId)
          : undefined,
      ),
    );
  return new Set(rows.map((row) => row.slotStartAt));
}
