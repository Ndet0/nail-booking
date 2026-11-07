import { env } from "cloudflare:workers";
import type {
  ApiErrorBody,
  ApiSuccess,
  AvailabilityDto,
  BookingClosedDatesDto,
  BookingDto,
  CreateBookingInput,
  NotificationListDto,
} from "@nailsbychao/types";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createDb } from "../src/db/client";
import { reservationSlots } from "../src/modules/availability/availability.engine";
import {
  insertAppointmentWithReservations,
  sha256Hex,
} from "../src/modules/bookings/bookings.repository";
import { addDays, localToUtc, studioToday, weekdayOf } from "../src/utils/studio-time";

const TZ = "Africa/Nairobi";
const TODAY = studioToday(new Date(), TZ);

/** A Monday 7–13 days out, far enough that the lead time never matters. */
const MONDAY = (() => {
  let date = addDays(TODAY, 7);
  while (weekdayOf(date) !== 1) date = addDays(date, 1);
  return date;
})();

function at(time: string, date = MONDAY) {
  return localToUtc(date, time, TZ).toISOString();
}

function bookingBody(
  startAt: string,
  overrides: Partial<CreateBookingInput> = {},
): CreateBookingInput {
  return {
    serviceId: "bk_svc",
    startAt,
    location: "studio",
    customerName: "Amina",
    customerPhone: "0712 345 678",
    customerEmail: "Amina@Example.com",
    ...overrides,
  };
}

async function postBooking(body: unknown, idempotencyKey?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const res = await app.request(
    "/api/v1/bookings",
    { method: "POST", headers, body: JSON.stringify(body) },
    env,
  );
  const json = (await res.json()) as ApiSuccess<BookingDto> | ApiErrorBody;
  return { status: res.status, json };
}

async function count(sql: string) {
  const row = await env.DB.prepare(sql).first<{ n: number }>();
  return row?.n ?? 0;
}

async function slotsFor(appointmentId: string) {
  const stored = await env.DB.prepare(
    "SELECT slot_start_at FROM appointment_slot_reservations WHERE appointment_id = ? ORDER BY slot_start_at",
  )
    .bind(appointmentId)
    .all<{ slot_start_at: string }>();
  return stored.results.map((row) => row.slot_start_at);
}

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO services (id, slug, name, category, duration_minutes, price_minor, is_active) VALUES
        ('bk_svc', 'bk-gel', 'Gel Polish', 'nails', 60, 150000, 1),
        ('bk_off', 'bk-retired', 'Retired', 'nails', 60, 150000, 0),
        ('bk_unassigned', 'bk-free', 'Unassigned', 'nails', 60, 150000, 1)`,
    ),
    env.DB.prepare("INSERT INTO staff (id, name) VALUES ('bk_staff', 'Chao')"),
    env.DB.prepare(
      `INSERT INTO staff_services (staff_id, service_id) VALUES
        ('bk_staff', 'bk_svc'), ('bk_staff', 'bk_off')`,
    ),
    env.DB.prepare(
      `INSERT INTO staff_working_hours (id, staff_id, weekday, start_time, end_time, effective_from)
       VALUES ('bk_mon', 'bk_staff', 1, '09:00', '19:00', '2026-01-01')`,
    ),
  ]);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notifications"),
    env.DB.prepare("DELETE FROM booking_lookup_attempts"),
    env.DB.prepare("DELETE FROM appointment_slot_reservations"),
    env.DB.prepare("DELETE FROM appointments"),
  ]);
});

describe("POST /bookings", () => {
  it("saves a pending studio booking and reserves the service plus the turnaround", async () => {
    const startAt = at("10:00");
    const { status, json } = await postBooking(bookingBody(startAt), crypto.randomUUID());
    expect(status).toBe(201);
    if (!("data" in json)) throw new Error("expected a booking");
    expect(json.data).toMatchObject({
      status: "pending",
      serviceId: "bk_svc",
      serviceName: "Gel Polish",
      durationMinutes: 60,
      priceMinor: 150000,
      currency: "KES",
      startAt,
      endAt: at("11:00"),
      location: "studio",
      address: null,
      customerName: "Amina",
      customerPhone: "+254712345678",
      customerEmail: "amina@example.com",
      customerNotes: null,
      travelFeeMinor: null,
    });
    expect(json.data.bookingReference).toMatch(/^NBC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(json.data.managementToken).toMatch(/^[a-f0-9]{64}$/);

    const stored = await env.DB.prepare(
      "SELECT management_token_hash, address FROM appointments WHERE id = ?",
    )
      .bind(json.data.id)
      .first<{ management_token_hash: string; address: string | null }>();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(json.data.managementToken ?? ""),
    );
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(stored?.management_token_hash).toBe(hash);
    expect(stored?.address).toBeNull();
    expect(await slotsFor(json.data.id)).toEqual(reservationSlots(new Date(startAt), 60, "studio"));
  });

  it("drops a studio address instead of storing it", async () => {
    const { status, json } = await postBooking(
      bookingBody(at("10:00"), { address: "Dunamis Apartment, Juja" }),
      crypto.randomUUID(),
    );
    expect(status).toBe(201);
    if (!("data" in json)) throw new Error("expected a booking");
    expect(json.data.address).toBeNull();
  });

  it("saves a house call with the customer's address", async () => {
    const startAt = at("10:00");
    const { status, json } = await postBooking(
      bookingBody(startAt, { location: "house_call", address: "  Kahawa Sukari  " }),
      crypto.randomUUID(),
    );
    expect(status).toBe(201);
    if (!("data" in json)) throw new Error("expected a booking");
    expect(json.data).toMatchObject({
      location: "house_call",
      address: "Kahawa Sukari",
      endAt: at("11:00"),
      travelFeeMinor: null,
    });
    expect(await slotsFor(json.data.id)).toEqual(
      reservationSlots(new Date(startAt), 60, "house_call"),
    );
  });

  it("returns the original booking for the same idempotency key and payload", async () => {
    const key = crypto.randomUUID();
    const body = bookingBody(at("10:00"));
    const first = await postBooking(body, key);
    const second = await postBooking(body, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    if (!("data" in first.json) || !("data" in second.json)) throw new Error("expected bookings");
    expect(second.json.data.bookingReference).toBe(first.json.data.bookingReference);
    expect(second.json.data.managementToken).toBeNull();
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(1);
  });

  it("rejects the same idempotency key with a different payload", async () => {
    const key = crypto.randomUUID();
    const startAt = at("10:00");
    expect((await postBooking(bookingBody(startAt), key)).status).toBe(201);
    const again = await postBooking(bookingBody(startAt, { customerName: "Beatrice" }), key);
    expect(again.status).toBe(409);
    if (!("error" in again.json)) throw new Error("expected an error");
    expect(again.json.error.code).toBe("idempotency_conflict");
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(1);
  });

  it("rejects a second overlapping booking and keeps a single reservation set", async () => {
    const startAt = at("10:00");
    const first = await postBooking(bookingBody(startAt), crypto.randomUUID());
    if (!("data" in first.json)) throw new Error("expected a booking");
    const overlap = await postBooking(
      bookingBody(at("10:30"), { customerName: "Beatrice" }),
      crypto.randomUUID(),
    );
    expect(overlap.status).toBe(409);
    if (!("error" in overlap.json)) throw new Error("expected an error");
    expect(overlap.json.error.code).toBe("slot_taken");
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(1);
    expect(await slotsFor(first.json.data.id)).toEqual(
      reservationSlots(new Date(startAt), 60, "studio"),
    );
  });

  it("allows a booking that starts when the previous buffer ends", async () => {
    expect((await postBooking(bookingBody(at("10:00")), crypto.randomUUID())).status).toBe(201);
    const next = await postBooking(
      bookingBody(at("11:15"), { customerName: "Beatrice" }),
      crypto.randomUUID(),
    );
    expect(next.status).toBe(201);
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(2);
  });

  it("lets only one of two simultaneous requests keep the slot", async () => {
    const startAt = at("10:00");
    const body = bookingBody(startAt);
    const [first, second] = await Promise.all([
      postBooking(body, crypto.randomUUID()),
      postBooking({ ...body, customerName: "Beatrice" }, crypto.randomUUID()),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const conflict = [first, second].find((result) => result.status === 409);
    if (!conflict || !("error" in conflict.json)) throw new Error("expected a conflict");
    expect(conflict.json.error.code).toBe("slot_taken");
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM appointment_slot_reservations")).toBe(
      reservationSlots(new Date(startAt), 60, "studio").length,
    );
  });

  it("rolls the appointment back when a reservation in the batch conflicts", async () => {
    const db = createDb(env.DB);
    const start = new Date(at("10:00"));
    const slots = reservationSlots(start, 60, "studio");
    const base = {
      bookingReference: "NBC-TEST-0001",
      managementTokenHash: "a".repeat(64),
      customerName: "Amina",
      customerEmail: null,
      customerPhone: "+254712345678",
      staffId: "bk_staff",
      serviceId: "bk_svc",
      serviceNameSnapshot: "Gel Polish",
      durationMinutesSnapshot: 60,
      priceMinorSnapshot: 150000,
      currency: "KES",
      startAt: start.toISOString(),
      endAt: at("11:00"),
      location: "studio" as const,
      address: null,
      customerNotes: null,
    };
    await insertAppointmentWithReservations(
      db,
      { ...base, id: "apt_keep", idempotencyKey: "key-keep-00000001" },
      slots,
    );
    await expect(
      insertAppointmentWithReservations(
        db,
        {
          ...base,
          id: "apt_drop",
          bookingReference: "NBC-TEST-0002",
          idempotencyKey: "key-drop-00000001",
        },
        slots,
      ),
    ).rejects.toThrow(/UNIQUE/);
    expect(await count("SELECT COUNT(*) AS n FROM appointments WHERE id = 'apt_drop'")).toBe(0);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM appointment_slot_reservations WHERE appointment_id = 'apt_drop'",
      ),
    ).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(1);
  });

  it.each([
    ["no idempotency key", bookingBody(at("10:00")), undefined],
    ["a short idempotency key", bookingBody(at("10:00")), "short-key"],
    ["a phone number", bookingBody(at("10:00"), { customerPhone: "12345" }), crypto.randomUUID()],
    [
      "a house call without an address",
      bookingBody(at("10:00"), { location: "house_call" }),
      crypto.randomUUID(),
    ],
    [
      "an email address",
      bookingBody(at("10:00"), { customerEmail: "not-an-email" }),
      crypto.randomUUID(),
    ],
    ["a start time", bookingBody("tomorrow"), crypto.randomUUID()],
  ])("rejects %s", async (_label, body, key) => {
    const { status, json } = await postBooking(body, key);
    expect(status).toBe(400);
    if (!("error" in json)) throw new Error("expected an error");
    expect(json.error.code).toBe("validation_error");
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(0);
  });

  it("rejects a date outside the booking window", async () => {
    const { status, json } = await postBooking(
      bookingBody(at("10:00", addDays(TODAY, 61))),
      crypto.randomUUID(),
    );
    expect(status).toBe(400);
    if (!("error" in json)) throw new Error("expected an error");
    expect(json.error.code).toBe("date_out_of_range");
  });

  it.each([
    ["before opening", at("07:00")],
    ["on a closed day", at("10:00", addDays(MONDAY, 6))],
  ])("rejects a slot %s", async (_label, startAt) => {
    const { status, json } = await postBooking(bookingBody(startAt), crypto.randomUUID());
    expect(status).toBe(409);
    if (!("error" in json)) throw new Error("expected an error");
    expect(json.error.code).toBe("slot_taken");
    expect(await count("SELECT COUNT(*) AS n FROM appointments")).toBe(0);
  });

  it.each([
    ["an inactive service", "bk_off"],
    ["an unknown service", "missing"],
  ])("returns 404 for %s", async (_label, serviceId) => {
    const { status, json } = await postBooking(
      bookingBody(at("10:00"), { serviceId }),
      crypto.randomUUID(),
    );
    expect(status).toBe(404);
    if (!("error" in json)) throw new Error("expected an error");
    expect(json.error.code).toBe("service_not_found");
  });

  it("rejects a service nobody can perform", async () => {
    const { status, json } = await postBooking(
      bookingBody(at("10:00"), { serviceId: "bk_unassigned" }),
      crypto.randomUUID(),
    );
    expect(status).toBe(409);
    if (!("error" in json)) throw new Error("expected an error");
    expect(json.error.code).toBe("slot_taken");
  });
});

function bookingPath(reference: string, suffix = "") {
  return `/api/v1/bookings/${encodeURIComponent(reference)}${suffix}`;
}

async function callBooking<T = BookingDto>(path: string, token?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (token) headers.set("X-Booking-Token", token);
  const res = await app.request(path, { ...init, headers }, env);
  const json = (await res.json()) as ApiSuccess<T> | ApiErrorBody;
  return { status: res.status, json };
}

async function booked(startAt = at("10:00"), customerName = "Amina") {
  const result = await postBooking(bookingBody(startAt, { customerName }), crypto.randomUUID());
  if (result.status !== 201 || !("data" in result.json) || !result.json.data.managementToken) {
    throw new Error(`expected a new booking, got ${result.status}`);
  }
  return result.json.data;
}

/** A canonical slot about three hours from now, inside the 24-hour change window. */
function soon() {
  const step = 15 * 60 * 1000;
  return new Date(Math.ceil((Date.now() + 3 * 60 * 60 * 1000) / step) * step).toISOString();
}

async function insertTokenBooking(startAt: string, token: string, status = "pending") {
  const id = `apt_${crypto.randomUUID().replaceAll("-", "")}`;
  const reference = `NBC-SOON-${id.slice(-4).toUpperCase()}`;
  await insertAppointmentWithReservations(
    createDb(env.DB),
    {
      id,
      bookingReference: reference,
      managementTokenHash: await sha256Hex(token),
      idempotencyKey: id,
      customerName: "Amina",
      customerEmail: null,
      customerPhone: "+254712345678",
      staffId: "bk_staff",
      serviceId: "bk_svc",
      serviceNameSnapshot: "Gel Polish",
      durationMinutesSnapshot: 60,
      priceMinorSnapshot: 150000,
      currency: "KES",
      startAt,
      endAt: new Date(Date.parse(startAt) + 60 * 60 * 1000).toISOString(),
      location: "studio",
      address: null,
      customerNotes: null,
    },
    reservationSlots(new Date(startAt), 60, "studio"),
  );
  if (status !== "pending") {
    await env.DB.prepare("UPDATE appointments SET status = ? WHERE id = ?").bind(status, id).run();
  }
  return { id, reference };
}

describe("customer booking management", () => {
  it("gives the same response for a missing booking, a wrong token, and no token", async () => {
    const booking = await booked();
    const missing = await callBooking(bookingPath("NBC-ZZZZ-ZZZZ"), "c".repeat(64));
    const wrong = await callBooking(bookingPath(booking.bookingReference), "d".repeat(64));
    const bare = await callBooking(bookingPath(booking.bookingReference));
    expect(missing.status).toBe(401);
    expect(wrong.json).toEqual(missing.json);
    expect(bare.json).toEqual(missing.json);
    if (!("error" in missing.json)) throw new Error("expected an error");
    expect(missing.json.error).toMatchObject({
      code: "unauthenticated",
      message: "That booking link is not valid.",
    });

    const cancelled = await callBooking(
      bookingPath(booking.bookingReference, "/cancel"),
      "d".repeat(64),
      {
        method: "POST",
      },
    );
    expect(cancelled.status).toBe(401);
    expect(await slotsFor(booking.id)).toEqual(
      reservationSlots(new Date(booking.startAt), 60, "studio"),
    );
  });

  it("returns the booking without the management token", async () => {
    const booking = await booked();
    const found = await callBooking(
      bookingPath(booking.bookingReference),
      booking.managementToken ?? "",
    );
    expect(found.status).toBe(200);
    if (!("data" in found.json)) throw new Error("expected a booking");
    expect(found.json.data).toMatchObject({
      id: booking.id,
      bookingReference: booking.bookingReference,
      managementToken: null,
      rescheduledAt: null,
      status: "pending",
      address: null,
    });
  });

  it("cancels a booking and releases its slots", async () => {
    const booking = await booked();
    const cancelled = await callBooking(
      bookingPath(booking.bookingReference, "/cancel"),
      booking.managementToken ?? "",
      {
        method: "POST",
      },
    );
    expect(cancelled.status).toBe(200);
    if (!("data" in cancelled.json)) throw new Error("expected a booking");
    expect(cancelled.json.data).toMatchObject({ status: "cancelled", managementToken: null });
    expect(await slotsFor(booking.id)).toEqual([]);
  });

  it("refuses a late cancellation and keeps the slots", async () => {
    const token = "e".repeat(64);
    const startAt = soon();
    const { id, reference } = await insertTokenBooking(startAt, token);
    const cancelled = await callBooking(bookingPath(reference, "/cancel"), token, {
      method: "POST",
    });
    expect(cancelled.status).toBe(409);
    if (!("error" in cancelled.json)) throw new Error("expected an error");
    expect(cancelled.json.error.code).toBe("change_window_closed");
    expect(await slotsFor(id)).toEqual(reservationSlots(new Date(startAt), 60, "studio"));
  });

  it("refuses to cancel a completed appointment", async () => {
    const booking = await booked();
    await env.DB.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?")
      .bind(booking.id)
      .run();
    const cancelled = await callBooking(
      bookingPath(booking.bookingReference, "/cancel"),
      booking.managementToken ?? "",
      {
        method: "POST",
      },
    );
    expect(cancelled.status).toBe(409);
    if (!("error" in cancelled.json)) throw new Error("expected an error");
    expect(cancelled.json.error.code).toBe("booking_not_changeable");
    expect(await slotsFor(booking.id)).toEqual(
      reservationSlots(new Date(booking.startAt), 60, "studio"),
    );
  });

  it("moves a booking onto a time its old block overlaps, then refuses a second move", async () => {
    const booking = await booked(at("10:00"));
    const nextStart = at("10:15");
    const moved = await callBooking(
      bookingPath(booking.bookingReference, "/reschedule"),
      booking.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: nextStart }),
      },
    );
    expect(moved.status).toBe(200);
    if (!("data" in moved.json)) throw new Error("expected a booking");
    expect(moved.json.data.startAt).toBe(nextStart);
    expect(moved.json.data.endAt).toBe(at("11:15"));
    expect(moved.json.data.rescheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(moved.json.data.managementToken).toBeNull();
    expect(await slotsFor(booking.id)).toEqual(reservationSlots(new Date(nextStart), 60, "studio"));

    const again = await callBooking(
      bookingPath(booking.bookingReference, "/reschedule"),
      booking.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: at("12:00") }),
      },
    );
    expect(again.status).toBe(409);
    if (!("error" in again.json)) throw new Error("expected an error");
    expect(again.json.error.code).toBe("already_rescheduled");
    expect(await slotsFor(booking.id)).toEqual(reservationSlots(new Date(nextStart), 60, "studio"));

    const closed = await callBooking(
      bookingPath(booking.bookingReference, `/availability?date=${MONDAY}`),
      booking.managementToken ?? "",
    );
    expect(closed.status).toBe(409);
    if (!("error" in closed.json)) throw new Error("expected an error");
    expect(closed.json.error.code).toBe("already_rescheduled");
  });

  it("rolls a conflicting reschedule back and leaves the original slots", async () => {
    const first = await booked(at("10:00"), "Amina");
    const second = await booked(at("14:00"), "Beatrice");
    const moved = await callBooking(
      bookingPath(first.bookingReference, "/reschedule"),
      first.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: second.startAt }),
      },
    );
    expect(moved.status).toBe(409);
    if (!("error" in moved.json)) throw new Error("expected an error");
    expect(moved.json.error.code).toBe("slot_taken");
    const stored = await env.DB.prepare(
      "SELECT start_at, rescheduled_at FROM appointments WHERE id = ?",
    )
      .bind(first.id)
      .first<{ start_at: string; rescheduled_at: string | null }>();
    expect(stored).toEqual({ start_at: first.startAt, rescheduled_at: null });
    expect(await slotsFor(first.id)).toEqual(
      reservationSlots(new Date(first.startAt), 60, "studio"),
    );
    expect(await slotsFor(second.id)).toEqual(
      reservationSlots(new Date(second.startAt), 60, "studio"),
    );
  });

  it("lets only one of two simultaneous reschedules keep the new slot", async () => {
    const first = await booked(at("10:00"), "Amina");
    const second = await booked(at("12:00"), "Beatrice");
    const target = at("16:00");
    const move = (booking: BookingDto) =>
      callBooking(
        bookingPath(booking.bookingReference, "/reschedule"),
        booking.managementToken ?? "",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt: target }),
        },
      );
    const [left, right] = await Promise.all([move(first), move(second)]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);
    const loser = [left, right].find((result) => result.status === 409);
    if (!loser || !("error" in loser.json)) throw new Error("expected a conflict");
    expect(loser.json.error.code).toBe("slot_taken");

    const stored = await env.DB.prepare(
      "SELECT id, start_at, rescheduled_at FROM appointments ORDER BY start_at",
    ).all<{ id: string; start_at: string; rescheduled_at: string | null }>();
    const moved = stored.results.filter((row) => row.rescheduled_at);
    const stayed = stored.results.filter((row) => !row.rescheduled_at);
    expect(moved).toHaveLength(1);
    expect(moved[0]?.start_at).toBe(target);
    expect(stayed).toHaveLength(1);
    expect([first.startAt, second.startAt]).toContain(stayed[0]?.start_at);
    expect(await slotsFor(moved[0]?.id ?? "")).toEqual(
      reservationSlots(new Date(target), 60, "studio"),
    );
    expect(await slotsFor(stayed[0]?.id ?? "")).toEqual(
      reservationSlots(new Date(stayed[0]?.start_at ?? ""), 60, "studio"),
    );
  });

  it("refuses to move a booking inside the 24-hour window", async () => {
    const token = "f".repeat(64);
    const startAt = soon();
    const { id, reference } = await insertTokenBooking(startAt, token);
    const moved = await callBooking(bookingPath(reference, "/reschedule"), token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: at("10:00") }),
    });
    expect(moved.status).toBe(409);
    if (!("error" in moved.json)) throw new Error("expected an error");
    expect(moved.json.error.code).toBe("change_window_closed");
    expect(await slotsFor(id)).toEqual(reservationSlots(new Date(startAt), 60, "studio"));
  });

  it("offers times around the booking without offering the current start", async () => {
    const booking = await booked(at("10:00"));
    const found = await callBooking<AvailabilityDto>(
      bookingPath(booking.bookingReference, `/availability?date=${MONDAY}`),
      booking.managementToken ?? "",
    );
    expect(found.status).toBe(200);
    if (!("data" in found.json)) throw new Error("expected availability");
    const starts = found.json.data.slots.map((slot) => slot.startAt);
    expect(starts).not.toContain(at("10:00"));
    expect(starts).toContain(at("10:15"));
    expect(found.json.data).toMatchObject({
      serviceId: "bk_svc",
      date: MONDAY,
      location: "studio",
      timezone: "Africa/Nairobi",
    });
  });

  it("hides a closed day on the move calendar without changing the booking", async () => {
    const booking = await booked(at("11:00"));
    const sunday = addDays(MONDAY, 6);
    const open = await callBooking<BookingClosedDatesDto>(
      bookingPath(booking.bookingReference, `/closed-dates?from=${MONDAY}&to=${sunday}`),
      booking.managementToken ?? "",
    );
    expect(open.status).toBe(200);
    if (!("data" in open.json)) throw new Error("expected closed dates");
    expect(open.json.data.dates).toContain(sunday);
    expect(open.json.data.dates).not.toContain(MONDAY);

    await env.DB.prepare(
      `INSERT INTO staff_time_off (id, staff_id, start_at, end_at)
       VALUES ('bk_close', 'bk_staff', ?, ?)`,
    )
      .bind(at("00:00"), at("00:00", addDays(MONDAY, 1)))
      .run();
    try {
      const closed = await callBooking<BookingClosedDatesDto>(
        bookingPath(booking.bookingReference, `/closed-dates?from=${MONDAY}&to=${sunday}`),
        booking.managementToken ?? "",
      );
      if (!("data" in closed.json)) throw new Error("expected closed dates");
      expect(closed.json.data.dates).toContain(MONDAY);
      const stored = await env.DB.prepare("SELECT status FROM appointments WHERE id = ?")
        .bind(booking.id)
        .first<{ status: string }>();
      expect(stored?.status).toBe("pending");
    } finally {
      await env.DB.prepare("DELETE FROM staff_time_off WHERE id = 'bk_close'").run();
    }
  });
});

async function postLookup(body: unknown, ip: string) {
  const res = await app.request(
    "/api/v1/bookings/lookup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify(body),
    },
    env,
  );
  const json = (await res.json()) as ApiSuccess<BookingDto> | ApiErrorBody;
  return { status: res.status, json };
}

async function notices(appointmentId: string) {
  const stored = await env.DB.prepare(
    "SELECT audience, kind, title FROM notifications WHERE appointment_id = ? ORDER BY audience, kind",
  )
    .bind(appointmentId)
    .all<{ audience: string; kind: string; title: string }>();
  return stored.results;
}

describe("POST /bookings/lookup", () => {
  it("opens the booking from the reference and phone without replacing the original link", async () => {
    const booking = await booked();
    const looked = await postLookup(
      { bookingReference: booking.bookingReference.toLowerCase(), customerPhone: "0712 345 678" },
      "203.0.113.10",
    );
    expect(looked.status).toBe(200);
    if (!("data" in looked.json) || !looked.json.data.managementToken) {
      throw new Error("expected a device token");
    }
    expect(looked.json.data.managementToken).not.toBe(booking.managementToken);
    expect(looked.json.data.bookingReference).toBe(booking.bookingReference);

    const stored = await env.DB.prepare(
      "SELECT management_token_hash, recovery_token_hash FROM appointments WHERE id = ?",
    )
      .bind(booking.id)
      .first<{ management_token_hash: string; recovery_token_hash: string | null }>();
    expect(stored?.management_token_hash).toBe(await sha256Hex(booking.managementToken ?? ""));
    expect(stored?.recovery_token_hash).toBe(await sha256Hex(looked.json.data.managementToken));

    const original = await callBooking(
      bookingPath(booking.bookingReference),
      booking.managementToken ?? "",
    );
    const recovered = await callBooking(
      bookingPath(booking.bookingReference),
      looked.json.data.managementToken,
    );
    expect(original.status).toBe(200);
    expect(recovered.status).toBe(200);
  });

  it("returns the same error for a wrong phone and a missing reference", async () => {
    const booking = await booked();
    const wrong = await postLookup(
      { bookingReference: booking.bookingReference, customerPhone: "0799 999 999" },
      "203.0.113.11",
    );
    const missing = await postLookup(
      { bookingReference: "NBC-ZZZZ-ZZZZ", customerPhone: "0712 345 678" },
      "203.0.113.12",
    );
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.json).toEqual(missing.json);
  });

  it("ignores expired attempts and blocks the ninth recent lookup", async () => {
    const booking = await booked();
    const ip = "203.0.113.50";
    const ipHash = await sha256Hex(ip);
    const old = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    await env.DB.batch(
      Array.from({ length: 8 }, (_, index) =>
        env.DB.prepare(
          "INSERT INTO booking_lookup_attempts (id, ip_hash, created_at) VALUES (?, ?, ?)",
        ).bind(`old_${index}`, ipHash, old),
      ),
    );

    const first = await postLookup(
      { bookingReference: "NBC-ZZZZ-ZZZZ", customerPhone: "0712 345 678" },
      ip,
    );
    expect(first.status).toBe(401);
    for (let attempt = 0; attempt < 7; attempt++) {
      expect(
        (await postLookup({ bookingReference: "NBC-ZZZZ-ZZZZ", customerPhone: "0712 345 678" }, ip))
          .status,
      ).toBe(401);
    }
    const blocked = await postLookup(
      { bookingReference: booking.bookingReference, customerPhone: "0712 345 678" },
      ip,
    );
    expect(blocked.status).toBe(429);
    if (!("error" in blocked.json)) throw new Error("expected an error");
    expect(blocked.json.error.code).toBe("rate_limited");
    const stored = await env.DB.prepare("SELECT recovery_token_hash FROM appointments WHERE id = ?")
      .bind(booking.id)
      .first<{ recovery_token_hash: string | null }>();
    expect(stored?.recovery_token_hash).toBeNull();
  });
});

describe("booking notifications", () => {
  it("tells the admin when a booking is created", async () => {
    const booking = await booked();
    expect(await notices(booking.id)).toEqual([
      { audience: "admin", kind: "booking_created", title: "New booking" },
    ]);
  });

  it("tells the admin when the customer cancels", async () => {
    const booking = await booked();
    const cancelled = await callBooking(
      bookingPath(booking.bookingReference, "/cancel"),
      booking.managementToken ?? "",
      { method: "POST" },
    );
    expect(cancelled.status).toBe(200);
    expect(await notices(booking.id)).toEqual([
      { audience: "admin", kind: "booking_cancelled", title: "Booking cancelled" },
      { audience: "admin", kind: "booking_created", title: "New booking" },
    ]);
  });

  it("tells both sides when the customer moves the booking", async () => {
    const booking = await booked();
    const moved = await callBooking(
      bookingPath(booking.bookingReference, "/reschedule"),
      booking.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: at("10:15") }),
      },
    );
    expect(moved.status).toBe(200);
    expect(await notices(booking.id)).toEqual([
      { audience: "admin", kind: "booking_created", title: "New booking" },
      { audience: "admin", kind: "booking_rescheduled", title: "Booking moved" },
      { audience: "customer", kind: "booking_rescheduled", title: "Booking moved" },
    ]);
  });

  it("does not record a move that was rolled back", async () => {
    const first = await booked(at("10:00"));
    const second = await booked(at("14:00"), "Beatrice");
    const moved = await callBooking(
      bookingPath(first.bookingReference, "/reschedule"),
      first.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: second.startAt }),
      },
    );
    expect(moved.status).toBe(409);
    expect(await notices(first.id)).toEqual([
      { audience: "admin", kind: "booking_created", title: "New booking" },
    ]);
  });

  it("shows customer updates only with that booking's token", async () => {
    const booking = await booked();
    const other = await booked(at("14:00"), "Beatrice");
    const moved = await callBooking(
      bookingPath(booking.bookingReference, "/reschedule"),
      booking.managementToken ?? "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: at("10:15") }),
      },
    );
    expect(moved.status).toBe(200);

    const anonymous = await callBooking(bookingPath(booking.bookingReference, "/notifications"));
    expect(anonymous.status).toBe(401);
    const foreign = await callBooking(
      bookingPath(booking.bookingReference, "/notifications"),
      other.managementToken ?? "",
    );
    expect(foreign.status).toBe(401);

    const found = await callBooking<NotificationListDto>(
      bookingPath(booking.bookingReference, "/notifications"),
      booking.managementToken ?? "",
    );
    expect(found.status).toBe(200);
    if (!("data" in found.json)) throw new Error("expected notifications");
    expect(found.json.data.items.map((item) => item.audience)).toEqual(["customer"]);
    expect(found.json.data.unreadCount).toBe(1);
  });
});
