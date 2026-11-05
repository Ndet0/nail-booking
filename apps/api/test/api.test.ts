import { env } from "cloudflare:workers";
import type { ApiErrorBody, ApiSuccess, HealthDto, ServiceDto } from "@nailsbychao/types";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

const ALLOWED_ORIGIN = "http://localhost:5173";

function request(path: string, init?: RequestInit) {
  return app.request(`/api/v1${path}`, init, env);
}

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM appointment_slot_reservations"),
    env.DB.prepare("DELETE FROM appointments"),
    env.DB.prepare("DELETE FROM staff_services"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare(
      `INSERT INTO services (id, slug, name, category, duration_minutes, price_minor, currency, is_active, display_order) VALUES
        ('svc_b', 'acrylic', 'Acrylic Full Set', 'nails',  120, 350000, 'KES', 1, 20),
        ('svc_a', 'gel',     'Gel Polish',       'nails',   60, 150000, 'KES', 1, 10),
        ('svc_m', 'glam',    'Soft Glam',        'makeup',  60, 250000, 'KES', 1, 30),
        ('svc_x', 'retired', 'Retired',          'nails',   30,  10000, 'KES', 0,  5)`,
    ),
  ]);
});

describe("GET /health", () => {
  it("reports the API and D1 as healthy", async () => {
    const res = await request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { status: "ok", db: "ok" },
    } satisfies ApiSuccess<HealthDto>);
  });
});

describe("GET /services", () => {
  it("returns only active services in display order", async () => {
    const res = await request("/services");
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as ApiSuccess<ServiceDto[]>;
    expect(data.map((s) => s.id)).toEqual(["svc_a", "svc_b", "svc_m"]);
  });

  it("returns prices as integer minor units with an explicit currency", async () => {
    const { data } = (await (await request("/services")).json()) as ApiSuccess<ServiceDto[]>;
    expect(data[0]).toEqual({
      id: "svc_a",
      slug: "gel",
      name: "Gel Polish",
      description: null,
      category: "nails",
      durationMinutes: 60,
      priceMinor: 150000,
      currency: "KES",
    });
  });

  it("filters by category", async () => {
    const { data } = (await (await request("/services?category=makeup")).json()) as ApiSuccess<
      ServiceDto[]
    >;
    expect(data.map((s) => s.id)).toEqual(["svc_m"]);
  });

  it("rejects an invalid category with a validation error", async () => {
    const res = await request("/services?category=bogus");
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("validation_error");
  });
});

describe("GET /services/:id", () => {
  it("returns an active service", async () => {
    const res = await request("/services/svc_m");
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as ApiSuccess<ServiceDto>;
    expect(data).toMatchObject({ id: "svc_m", name: "Soft Glam", priceMinor: 250000 });
  });

  it.each([
    ["an inactive", "svc_x"],
    ["an unknown", "svc_missing"],
  ])("returns 404 for %s service", async (_label, id) => {
    const res = await request(`/services/${id}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("service_not_found");
  });
});

describe("database constraints", () => {
  it("rejects a second reservation for the same staff member and slot", async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM appointment_slot_reservations"),
      env.DB.prepare("DELETE FROM appointments"),
      env.DB.prepare("DELETE FROM staff WHERE id = 'staff_t'"),
      env.DB.prepare("INSERT INTO staff (id, name) VALUES ('staff_t', 'Test')"),
      env.DB.prepare(
        `INSERT INTO appointments (
          id, booking_reference, management_token_hash, customer_name, customer_phone, staff_id,
          service_id, service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot,
          start_at, end_at, location
        ) VALUES
          (
            'apt_1', 'ref_1', 'hash_1', 'Amina', '0712345678', 'staff_t', 'svc_a', 'Gel Polish',
            60, 150000, '2026-10-28T06:00:00.000Z', '2026-10-28T07:00:00.000Z', 'studio'
          ),
          (
            'apt_2', 'ref_2', 'hash_2', 'Bella', '0722345678', 'staff_t', 'svc_a', 'Gel Polish',
            60, 150000, '2026-10-28T08:00:00.000Z', '2026-10-28T09:00:00.000Z', 'studio'
          )`,
      ),
      env.DB.prepare(
        `INSERT INTO appointment_slot_reservations (staff_id, slot_start_at, appointment_id)
         VALUES ('staff_t', '2026-10-28T06:00:00.000Z', 'apt_1')`,
      ),
    ]);

    await expect(
      env.DB.prepare(
        `INSERT INTO appointment_slot_reservations (staff_id, slot_start_at, appointment_id)
         VALUES ('staff_t', '2026-10-28T06:00:00.000Z', 'apt_2')`,
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    await env.DB.prepare(
      `INSERT INTO appointment_slot_reservations (staff_id, slot_start_at, appointment_id)
       VALUES ('staff_t', '2026-10-28T06:15:00.000Z', 'apt_2')`,
    ).run();
  });

  it.each([
    ["a non-canonical instant", "2026-10-28T06:00:00Z"],
    ["an offset instant", "2026-10-28T09:00:00.000+03:00"],
    ["a slot off the 15-minute grid", "2026-10-28T06:10:00.000Z"],
    ["a slot with seconds", "2026-10-28T06:15:30.000Z"],
    ["an impossible date", "2026-02-30T06:00:00.000Z"],
    ["a non-date", "not-a-date"],
  ])("rejects a reservation at %s", async (_label, slotStartAt) => {
    await expect(
      env.DB.prepare(
        `INSERT INTO appointment_slot_reservations (staff_id, slot_start_at, appointment_id)
         VALUES ('staff_t', ?, 'apt_2')`,
      )
        .bind(slotStartAt)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it("requires an address for house calls", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO appointments (
          id, booking_reference, management_token_hash, customer_name, customer_phone, staff_id,
          service_id, service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot,
          start_at, end_at, location, address
        ) VALUES (
          'apt_hc', 'ref_hc', 'hash_hc', 'Cleo', '0732345678', 'staff_t', 'svc_a', 'Gel Polish',
          60, 150000, '2026-10-29T06:00:00.000Z', '2026-10-29T07:00:00.000Z', 'house_call', '  '
        )`,
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it("rejects a reused idempotency key", async () => {
    const insert = (id: string) =>
      env.DB.prepare(
        `INSERT INTO appointments (
          id, booking_reference, management_token_hash, idempotency_key, customer_name,
          customer_phone, staff_id, service_id, service_name_snapshot, duration_minutes_snapshot,
          price_minor_snapshot, start_at, end_at, location
        ) VALUES (
          ?1, ?1, ?1, 'idem_1', 'Dana', '0742345678', 'staff_t', 'svc_a', 'Gel Polish', 60, 150000,
          '2026-10-30T06:00:00.000Z', '2026-10-30T07:00:00.000Z', 'studio'
        )`,
      )
        .bind(id)
        .run();

    await insert("apt_idem_1");
    await expect(insert("apt_idem_2")).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it("rejects a non-positive duration", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO services (id, slug, name, category, duration_minutes, price_minor) VALUES ('bad', 'bad', 'Bad', 'nails', 0, 100)",
      ).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe("conventions", () => {
  it("returns the error envelope for unknown routes", async () => {
    const res = await request("/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "The requested resource was not found." },
    } satisfies ApiErrorBody);
  });

  it("allows CORS only for configured origins", async () => {
    const allowed = await request("/health", { headers: { Origin: ALLOWED_ORIGIN } });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);

    const blocked = await request("/health", { headers: { Origin: "https://evil.example" } });
    expect(blocked.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
