import type { BookingDto } from "@nailsbychao/types";
import { eq } from "drizzle-orm";
import { STUDIO } from "../../config/studio";
import type { Db } from "../../db/client";
import { type AppointmentRow, appointmentSlotReservations, appointments } from "../../db/schema";
import { AppError } from "../../utils/errors";
import { addDays, localToUtc, studioToday } from "../../utils/studio-time";
import { bookingWindow, computeSlots, reservationSlots } from "../availability/availability.engine";
import {
  getReservedSlots,
  getTimeOff,
  getWorkingPeriods,
  listEligibleStaffIds,
} from "../availability/availability.repository";
import { getActiveServiceById } from "../services/services.repository";
import type { NewBooking } from "./booking-request";

const SLOT_TAKEN = "That time was just taken. Please choose another.";
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type AppointmentInsert = {
  id: string;
  bookingReference: string;
  managementTokenHash: string;
  idempotencyKey: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  staffId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  durationMinutesSnapshot: number;
  priceMinorSnapshot: number;
  currency: string;
  startAt: string;
  endAt: string;
  location: NewBooking["location"];
  address: string | null;
  customerNotes: string | null;
};

export type CreateBookingResult = {
  created: boolean;
  booking: BookingDto;
};

/**
 * Inserts the appointment and every slot it occupies in one D1 batch.
 * The batch is atomic: a conflict on `(staff_id, slot_start_at)` rolls the appointment back too.
 */
export async function insertAppointmentWithReservations(
  db: Db,
  row: AppointmentInsert,
  slots: readonly string[],
): Promise<void> {
  if (slots.length === 0) {
    throw new Error("A booking must reserve at least one slot.");
  }
  const statements = [
    db.insert(appointments).values({
      id: row.id,
      bookingReference: row.bookingReference,
      managementTokenHash: row.managementTokenHash,
      idempotencyKey: row.idempotencyKey,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      staffId: row.staffId,
      serviceId: row.serviceId,
      serviceNameSnapshot: row.serviceNameSnapshot,
      durationMinutesSnapshot: row.durationMinutesSnapshot,
      priceMinorSnapshot: row.priceMinorSnapshot,
      currency: row.currency,
      startAt: row.startAt,
      endAt: row.endAt,
      status: "pending",
      location: row.location,
      address: row.address,
      customerNotes: row.customerNotes,
    }),
    ...slots.map((slot) =>
      db.insert(appointmentSlotReservations).values({
        staffId: row.staffId,
        slotStartAt: slot,
        appointmentId: row.id,
      }),
    ),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

export async function createBooking(db: Db, input: NewBooking): Promise<CreateBookingResult> {
  const existing = await findByIdempotencyKey(db, input.idempotencyKey);
  if (existing) return replay(existing, input);

  const service = await getActiveServiceById(db, input.serviceId);
  if (!service) {
    throw new AppError(404, "service_not_found", "This service is not available.");
  }

  const start = new Date(input.startAt);
  const now = new Date();
  const date = studioToday(start, STUDIO.timezone);
  const { firstDate, lastDate } = bookingWindow(now);
  if (date < firstDate || date > lastDate) {
    throw new AppError(
      400,
      "date_out_of_range",
      `Choose a date between ${firstDate} and ${lastDate}.`,
    );
  }

  const staffId = await assignStaff(db, {
    serviceId: service.id,
    durationMinutes: service.durationMinutes,
    date,
    location: input.location,
    startAt: input.startAt,
    now,
  });
  if (!staffId) throw new AppError(409, "slot_taken", SLOT_TAKEN);

  const token = newManagementToken();
  const row: AppointmentInsert = {
    id: newId("apt"),
    bookingReference: newBookingReference(),
    managementTokenHash: await sha256Hex(token),
    idempotencyKey: input.idempotencyKey,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    staffId,
    serviceId: service.id,
    serviceNameSnapshot: service.name,
    durationMinutesSnapshot: service.durationMinutes,
    priceMinorSnapshot: service.priceMinor,
    currency: service.currency,
    startAt: input.startAt,
    endAt: new Date(start.getTime() + service.durationMinutes * 60_000).toISOString(),
    location: input.location,
    address: input.address,
    customerNotes: input.customerNotes,
  };
  const slots = reservationSlots(start, service.durationMinutes, input.location);

  try {
    await writeBooking(db, row, slots);
  } catch (error) {
    const conflict = uniqueConstraintTarget(error);
    if (conflict?.includes("idempotency_key")) {
      const raced = await findByIdempotencyKey(db, input.idempotencyKey);
      if (raced) return replay(raced, input);
    }
    // The appointment insert is first, so a slot conflict means that statement never committed.
    if (conflict?.includes("appointment_slot_reservations")) {
      throw new AppError(409, "slot_taken", SLOT_TAKEN);
    }
    throw error;
  }

  const saved = await findById(db, row.id);
  if (!saved) throw new Error("Booking insert did not persist.");
  return { created: true, booking: toBookingDto(saved, token) };
}

async function assignStaff(
  db: Db,
  input: {
    serviceId: string;
    durationMinutes: number;
    date: string;
    location: NewBooking["location"];
    startAt: string;
    now: Date;
  },
): Promise<string | null> {
  const staffIds = (await listEligibleStaffIds(db, input.serviceId)).sort();
  const dayStart = localToUtc(input.date, "00:00", STUDIO.timezone);
  const dayEnd = localToUtc(addDays(input.date, 1), "00:00", STUDIO.timezone);

  for (const staffId of staffIds) {
    const [workingPeriods, timeOff, reservedSlots] = await Promise.all([
      getWorkingPeriods(db, staffId, input.date),
      getTimeOff(db, staffId, dayStart, dayEnd),
      getReservedSlots(db, staffId, dayStart, dayEnd),
    ]);
    const offered = computeSlots({
      date: input.date,
      durationMinutes: input.durationMinutes,
      location: input.location,
      workingPeriods,
      timeOff,
      reservedSlots,
      now: input.now,
    });
    if (offered.some((slot) => slot.startAt === input.startAt)) return staffId;
  }
  return null;
}

async function writeBooking(db: Db, row: AppointmentInsert, slots: readonly string[]) {
  try {
    await insertAppointmentWithReservations(db, row, slots);
  } catch (error) {
    // Match the SQLite constraint, not the SQL text. The insert lists every column, including
    // booking_reference, so a slot conflict would otherwise look like a reference collision.
    if (!uniqueConstraintTarget(error)?.includes("booking_reference")) throw error;
    await insertAppointmentWithReservations(
      db,
      { ...row, bookingReference: newBookingReference() },
      slots,
    );
  }
}

function replay(row: AppointmentRow, input: NewBooking): CreateBookingResult {
  if (!samePayload(row, input)) {
    throw new AppError(
      409,
      "idempotency_conflict",
      "This submission was already used for a different booking.",
    );
  }
  return { created: false, booking: toBookingDto(row, null) };
}

function samePayload(row: AppointmentRow, input: NewBooking): boolean {
  return (
    row.serviceId === input.serviceId &&
    row.startAt === input.startAt &&
    row.location === input.location &&
    row.customerName === input.customerName &&
    row.customerPhone === input.customerPhone &&
    row.customerEmail === input.customerEmail &&
    row.address === input.address &&
    row.customerNotes === input.customerNotes
  );
}

function toBookingDto(row: AppointmentRow, managementToken: string | null): BookingDto {
  return {
    id: row.id,
    bookingReference: row.bookingReference,
    managementToken,
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
  };
}

async function findByIdempotencyKey(db: Db, key: string): Promise<AppointmentRow | null> {
  return (
    (await db.select().from(appointments).where(eq(appointments.idempotencyKey, key)).get()) ?? null
  );
}

async function findById(db: Db, id: string): Promise<AppointmentRow | null> {
  return (await db.select().from(appointments).where(eq(appointments.id, id)).get()) ?? null;
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function newBookingReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let body = "";
  for (const byte of bytes) body += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `NBC-${body.slice(0, 4)}-${body.slice(4)}`;
}

function newManagementToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Columns named by SQLite's `UNIQUE constraint failed:` message, or null when it isn't one. */
function uniqueConstraintTarget(error: unknown): string | null {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return /UNIQUE constraint failed: ([^\n]+)/.exec(parts.join("\n"))?.[1] ?? null;
}
