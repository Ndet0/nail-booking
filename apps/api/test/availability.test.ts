import { env } from "cloudflare:workers";
import type { ApiErrorBody, ApiSuccess, AvailabilityDto, ClosedDatesDto } from "@nailsbychao/types";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { reservationSlots } from "../src/modules/availability/availability.engine";
import { addDays, localToUtc, studioToday, weekdayOf } from "../src/utils/studio-time";

const TZ = "Africa/Nairobi";
const TODAY = studioToday(new Date(), TZ);

/** A Monday 7–13 days out, far enough that the lead time never matters. */
const MONDAY = (() => {
  let date = addDays(TODAY, 7);
  while (weekdayOf(date) !== 1) date = addDays(date, 1);
  return date;
})();

function at(time: string) {
  return localToUtc(MONDAY, time, TZ).toISOString();
}

async function availability(query: Record<string, string>) {
  const res = await app.request(`/api/v1/availability?${new URLSearchParams(query)}`, {}, env);
  return { status: res.status, body: (await res.json()) as ApiSuccess<AvailabilityDto> };
}

async function availabilityError(query: Record<string, string>) {
  const res = await app.request(`/api/v1/availability?${new URLSearchParams(query)}`, {}, env);
  return { status: res.status, body: (await res.json()) as ApiErrorBody };
}

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO services (id, slug, name, category, duration_minutes, price_minor, is_active) VALUES
        ('av_svc', 'av-gel', 'Gel Polish', 'nails', 60, 150000, 1),
        ('av_off', 'av-retired', 'Retired', 'nails', 60, 150000, 0)`,
    ),
    env.DB.prepare("INSERT INTO staff (id, name) VALUES ('av_staff', 'Chao')"),
    env.DB.prepare(
      `INSERT INTO staff_services (staff_id, service_id) VALUES
        ('av_staff', 'av_svc'), ('av_staff', 'av_off')`,
    ),
    env.DB.prepare(
      `INSERT INTO staff_working_hours (id, staff_id, weekday, start_time, end_time, effective_from)
       VALUES ('av_mon', 'av_staff', 1, '09:00', '19:00', '2026-01-01')`,
    ),
  ]);
});

describe("GET /availability", () => {
  it("returns studio slots for a working day", async () => {
    const { status, body } = await availability({ serviceId: "av_svc", date: MONDAY });
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      serviceId: "av_svc",
      date: MONDAY,
      location: "studio",
      timezone: TZ,
      lastBookableDate: addDays(TODAY, 60),
    });
    expect(body.data.slots[0]).toEqual({ startAt: at("09:00"), endAt: at("10:00") });
    expect(body.data.slots.at(-1)?.startAt).toBe(at("17:45"));
  });

  it("applies house-call travel buffers", async () => {
    const { body } = await availability({
      serviceId: "av_svc",
      date: MONDAY,
      location: "house_call",
    });
    expect(body.data.slots[0]?.startAt).toBe(at("10:00"));
  });

  it("returns no slots on a day off", async () => {
    const { status, body } = await availability({ serviceId: "av_svc", date: addDays(MONDAY, 6) });
    expect(status).toBe(200);
    expect(body.data.slots).toEqual([]);
  });

  it("removes slots that overlap an existing reservation", async () => {
    const start = new Date(at("10:00"));
    await env.DB.prepare(
      `INSERT INTO appointments (
        id, booking_reference, management_token_hash, customer_name, customer_phone, staff_id,
        service_id, service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot,
        start_at, end_at, location
      ) VALUES ('av_apt', 'av_ref', 'av_hash', 'Amina', '0712345678', 'av_staff', 'av_svc',
        'Gel Polish', 60, 150000, ?, ?, 'studio')`,
    )
      .bind(start.toISOString(), at("11:00"))
      .run();
    await env.DB.batch(
      reservationSlots(start, 60, "studio").map((slot) =>
        env.DB.prepare(
          `INSERT INTO appointment_slot_reservations (staff_id, slot_start_at, appointment_id)
           VALUES ('av_staff', ?, 'av_apt')`,
        ).bind(slot),
      ),
    );

    const starts = (await availability({ serviceId: "av_svc", date: MONDAY })).body.data.slots.map(
      (slot) => slot.startAt,
    );
    expect(starts).not.toContain(at("09:00"));
    expect(starts).not.toContain(at("11:00"));
    expect(starts[0]).toBe(at("11:15"));
  });

  it.each([
    ["a malformed date", { serviceId: "av_svc", date: "tomorrow" }],
    ["an impossible date", { serviceId: "av_svc", date: "2026-02-30" }],
    ["a missing service", { date: MONDAY }],
    ["an unknown location", { serviceId: "av_svc", date: MONDAY, location: "office" }],
  ])("rejects %s", async (_label, query) => {
    const { status, body } = await availabilityError(query);
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it.each([
    ["in the past", addDays(TODAY, -1)],
    ["beyond the booking window", addDays(TODAY, 61)],
  ])("rejects a date %s", async (_label, date) => {
    const { status, body } = await availabilityError({ serviceId: "av_svc", date });
    expect(status).toBe(400);
    expect(body.error.code).toBe("date_out_of_range");
  });

  it("lists regular days off and a closed weekday", async () => {
    await env.DB.prepare("DELETE FROM staff_time_off WHERE staff_id = 'av_staff'").run();
    const sunday = addDays(MONDAY, 6);
    const openRes = await app.request(
      `/api/v1/availability/closed-dates?${new URLSearchParams({
        serviceId: "av_svc",
        from: MONDAY,
        to: sunday,
      })}`,
      {},
      env,
    );
    expect(openRes.status).toBe(200);
    const open = (await openRes.json()) as ApiSuccess<ClosedDatesDto>;
    expect(open.data.dates).not.toContain(MONDAY);
    expect(open.data.dates).toContain(addDays(MONDAY, 1));
    expect(open.data.dates).toContain(sunday);

    await env.DB.prepare(
      `INSERT INTO staff_time_off (id, staff_id, start_at, end_at)
       VALUES ('av_close', 'av_staff', ?, ?)`,
    )
      .bind(
        localToUtc(MONDAY, "00:00", TZ).toISOString(),
        localToUtc(addDays(MONDAY, 1), "00:00", TZ).toISOString(),
      )
      .run();
    const closedRes = await app.request(
      `/api/v1/availability/closed-dates?${new URLSearchParams({
        serviceId: "av_svc",
        from: MONDAY,
        to: sunday,
      })}`,
      {},
      env,
    );
    const closed = (await closedRes.json()) as ApiSuccess<ClosedDatesDto>;
    expect(closed.data.dates).toContain(MONDAY);
    await env.DB.prepare("DELETE FROM staff_time_off WHERE id = 'av_close'").run();
  });

  it("returns 404 for an inactive service", async () => {
    const { status, body } = await availabilityError({ serviceId: "av_off", date: MONDAY });
    expect(status).toBe(404);
    expect(body.error.code).toBe("service_not_found");
  });
});
