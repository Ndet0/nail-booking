import type { AdminStaffDto, Page, TimeOffDto, WorkingHoursDto } from "@nailsbychao/types";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { services, staff, staffServices, staffTimeOff, staffWorkingHours } from "../../db/schema";
import { decodeCursor, encodeCursor, pageOf } from "../../utils/cursor";
import { AppError } from "../../utils/errors";
import { auditInsert } from "../auth/audit";
import { runBatch } from "./batch";
import { hoursOverlap } from "./hours";

export type StaffWrite = {
  name: string;
  bio: string | null;
  isActive: boolean;
};

export type HoursWrite = {
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
};

export type TimeOffWrite = {
  staffId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function serviceIdsByStaff(db: Db, staffIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (staffIds.length === 0) return map;
  const rows = await db
    .select()
    .from(staffServices)
    .where(inArray(staffServices.staffId, staffIds));
  for (const row of rows) {
    const list = map.get(row.staffId) ?? [];
    list.push(row.serviceId);
    map.set(row.staffId, list);
  }
  return map;
}

function toStaff(row: typeof staff.$inferSelect, serviceIds: string[]): AdminStaffDto {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    isActive: row.isActive,
    serviceIds: [...serviceIds].sort(),
  };
}

export async function listStaff(
  db: Db,
  filters: { limit: number; cursor?: string },
): Promise<Page<AdminStaffDto>> {
  let cursorName: string | undefined;
  let cursorId: string | undefined;
  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor);
    if (!decoded.name || !decoded.id) {
      throw new AppError(400, "validation_error", "The request is invalid.");
    }
    cursorName = decoded.name;
    cursorId = decoded.id;
  }

  const rows = await db
    .select()
    .from(staff)
    .where(
      cursorName && cursorId
        ? or(
            sql`${staff.name} > ${cursorName}`,
            and(eq(staff.name, cursorName), sql`${staff.id} > ${cursorId}`),
          )
        : undefined,
    )
    .orderBy(asc(staff.name), asc(staff.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) => encodeCursor({ name: row.name, id: row.id }));
  const ids = await serviceIdsByStaff(
    db,
    page.items.map((row) => row.id),
  );
  return {
    items: page.items.map((row) => toStaff(row, ids.get(row.id) ?? [])),
    nextCursor: page.nextCursor,
  };
}

export async function createStaff(
  db: Db,
  actorId: string,
  input: StaffWrite,
): Promise<AdminStaffDto> {
  const id = newId("staff");
  await runBatch(db, [
    db.insert(staff).values({ id, ...input }),
    auditInsert(db, { actorId, action: "staff.created", entityType: "staff", entityId: id }),
  ]);
  return { id, ...input, serviceIds: [] };
}

export async function updateStaff(
  db: Db,
  actorId: string,
  id: string,
  input: Partial<StaffWrite>,
): Promise<AdminStaffDto> {
  const existing = await db.select().from(staff).where(eq(staff.id, id)).get();
  if (!existing) throw new AppError(404, "staff_not_found", "That staff member was not found.");

  await runBatch(db, [
    db
      .update(staff)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(staff.id, id)),
    auditInsert(db, { actorId, action: "staff.updated", entityType: "staff", entityId: id }),
  ]);

  const ids = await serviceIdsByStaff(db, [id]);
  const updated = await db.select().from(staff).where(eq(staff.id, id)).get();
  if (!updated) throw new AppError(404, "staff_not_found", "That staff member was not found.");
  return toStaff(updated, ids.get(id) ?? []);
}

export async function replaceStaffServices(
  db: Db,
  actorId: string,
  staffId: string,
  serviceIds: string[],
): Promise<AdminStaffDto> {
  const existing = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  if (!existing) throw new AppError(404, "staff_not_found", "That staff member was not found.");

  const uniqueIds = [...new Set(serviceIds)];
  if (uniqueIds.length > 0) {
    const found = await db
      .select({ id: services.id })
      .from(services)
      .where(inArray(services.id, uniqueIds));
    if (found.length !== uniqueIds.length) {
      throw new AppError(400, "validation_error", "One or more services do not exist.");
    }
  }

  await runBatch(db, [
    db.delete(staffServices).where(eq(staffServices.staffId, staffId)),
    ...uniqueIds.map((serviceId) => db.insert(staffServices).values({ staffId, serviceId })),
    auditInsert(db, {
      actorId,
      action: "staff.services_replaced",
      entityType: "staff",
      entityId: staffId,
    }),
  ]);
  return toStaff(existing, uniqueIds);
}

export async function listHours(db: Db, staffId: string): Promise<WorkingHoursDto[]> {
  await requireStaff(db, staffId);
  const rows = await db
    .select()
    .from(staffWorkingHours)
    .where(eq(staffWorkingHours.staffId, staffId))
    .orderBy(asc(staffWorkingHours.weekday), asc(staffWorkingHours.startTime));
  return rows.map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    isActive: row.isActive,
  }));
}

export async function replaceHours(
  db: Db,
  actorId: string,
  staffId: string,
  hours: HoursWrite[],
): Promise<WorkingHoursDto[]> {
  await requireStaff(db, staffId);
  if (hoursOverlap(hours)) {
    throw new AppError(400, "validation_error", "Working hours on the same day cannot overlap.");
  }

  const rows = hours.map((hour) => ({ id: newId("wh"), staffId, ...hour }));
  await runBatch(db, [
    db.delete(staffWorkingHours).where(eq(staffWorkingHours.staffId, staffId)),
    ...rows.map((row) => db.insert(staffWorkingHours).values(row)),
    auditInsert(db, {
      actorId,
      action: "working_hours.replaced",
      entityType: "staff",
      entityId: staffId,
    }),
  ]);
  return listHours(db, staffId);
}

export async function listTimeOff(
  db: Db,
  filters: {
    staffId?: string;
    fromInstant?: string;
    toInstant?: string;
    limit: number;
    cursor?: string;
  },
): Promise<Page<TimeOffDto>> {
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
    .select()
    .from(staffTimeOff)
    .where(
      and(
        filters.staffId ? eq(staffTimeOff.staffId, filters.staffId) : undefined,
        filters.fromInstant ? sql`${staffTimeOff.endAt} > ${filters.fromInstant}` : undefined,
        filters.toInstant ? sql`${staffTimeOff.startAt} < ${filters.toInstant}` : undefined,
        cursorStart && cursorId
          ? or(
              sql`${staffTimeOff.startAt} > ${cursorStart}`,
              and(eq(staffTimeOff.startAt, cursorStart), sql`${staffTimeOff.id} > ${cursorId}`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(staffTimeOff.startAt), asc(staffTimeOff.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) =>
    encodeCursor({ startAt: row.startAt, id: row.id }),
  );
  return {
    items: page.items.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      startAt: row.startAt,
      endAt: row.endAt,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
    nextCursor: page.nextCursor,
  };
}

export async function createTimeOff(
  db: Db,
  actorId: string,
  input: TimeOffWrite,
): Promise<TimeOffDto> {
  await requireStaff(db, input.staffId);
  const id = newId("off");
  const createdAt = new Date().toISOString();
  await runBatch(db, [
    db.insert(staffTimeOff).values({ id, ...input, createdAt }),
    auditInsert(db, { actorId, action: "time_off.created", entityType: "time_off", entityId: id }),
  ]);
  return { id, ...input, createdAt };
}

export async function deleteTimeOff(db: Db, actorId: string, id: string): Promise<void> {
  const existing = await db.select().from(staffTimeOff).where(eq(staffTimeOff.id, id)).get();
  if (!existing) throw new AppError(404, "time_off_not_found", "That time off was not found.");
  await runBatch(db, [
    db.delete(staffTimeOff).where(eq(staffTimeOff.id, id)),
    auditInsert(db, { actorId, action: "time_off.deleted", entityType: "time_off", entityId: id }),
  ]);
}

async function requireStaff(db: Db, staffId: string) {
  const existing = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).get();
  if (!existing) throw new AppError(404, "staff_not_found", "That staff member was not found.");
}
