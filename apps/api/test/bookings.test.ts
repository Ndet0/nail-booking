import { env } from "cloudflare:workers";
import type { ApiErrorBody, ApiSuccess, BookingDto, CreateBookingInput } from "@nailsbychao/types";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createDb } from "../src/db/client";
import { reservationSlots } from "../src/modules/availability/availability.engine";
import { insertAppointmentWithReservations } from "../src/modules/bookings/bookings.repository";
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
