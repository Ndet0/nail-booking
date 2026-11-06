import { env } from "cloudflare:workers";
import type {
  AdminBookingDto,
  ApiErrorBody,
  ApiSuccess,
  AvailabilityDto,
  Page,
  ServiceDto,
} from "@nailsbychao/types";
import { hashPassword } from "better-auth/crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { createDb } from "../src/db/client";
import { reservationSlots } from "../src/modules/availability/availability.engine";
import { insertAppointmentWithReservations } from "../src/modules/bookings/bookings.repository";
import { addDays, localToUtc, studioToday, weekdayOf } from "../src/utils/studio-time";

const TZ = "Africa/Nairobi";
const ORIGIN = "http://localhost:5173";
const PASSWORD = "studio-admin-1";
const TODAY = studioToday(new Date(), TZ);
const MONDAY = (() => {
  let date = addDays(TODAY, 7);
  while (weekdayOf(date) !== 1) date = addDays(date, 1);
  return date;
})();

function at(time: string) {
  return localToUtc(MONDAY, time, TZ).toISOString();
}

const PROTECTED: { method: string; path: string; body?: string }[] = [
  { method: "GET", path: "/api/v1/admin/me" },
  { method: "GET", path: "/api/v1/admin/bookings" },
  { method: "GET", path: "/api/v1/admin/bookings/missing" },
  {
    method: "PATCH",
    path: "/api/v1/admin/bookings/missing",
    body: JSON.stringify({ status: "confirmed" }),
  },
  { method: "GET", path: "/api/v1/admin/services" },
  { method: "POST", path: "/api/v1/admin/services", body: "{}" },
  { method: "PATCH", path: "/api/v1/admin/services/missing", body: "{}" },
  { method: "GET", path: "/api/v1/admin/staff" },
  { method: "POST", path: "/api/v1/admin/staff", body: "{}" },
  { method: "PATCH", path: "/api/v1/admin/staff/missing", body: "{}" },
  {
    method: "PUT",
    path: "/api/v1/admin/staff/missing/services",
    body: JSON.stringify({ serviceIds: [] }),
  },
  { method: "GET", path: "/api/v1/admin/staff/missing/hours" },
  { method: "PUT", path: "/api/v1/admin/staff/missing/hours", body: JSON.stringify({ hours: [] }) },
  { method: "GET", path: "/api/v1/admin/time-off" },
  { method: "POST", path: "/api/v1/admin/time-off", body: "{}" },
  { method: "DELETE", path: "/api/v1/admin/time-off/missing" },
  { method: "GET", path: "/api/v1/admin/gallery" },
  { method: "POST", path: "/api/v1/admin/gallery" },
  { method: "GET", path: "/api/v1/admin/gallery/missing/image" },
  { method: "PATCH", path: "/api/v1/admin/gallery/missing", body: "{}" },
  { method: "DELETE", path: "/api/v1/admin/gallery/missing" },
];

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function call(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return app.request(path, { ...init, headers }, env);
}

async function authRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Origin", ORIGIN);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return app.request(`${ORIGIN}${path}`, { ...init, headers }, env);
}

async function createAccount(email: string, admin: boolean) {
  const id = crypto.randomUUID();
  const hash = await hashPassword(PASSWORD);
  const now = Date.now();
  const statements = [
    env.DB.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, 'Chao', ?, 1, ?, ?)",
    ).bind(id, email, now, now),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), id, id, hash, now, now),
  ];
  if (admin) {
    statements.push(
      env.DB.prepare("INSERT INTO admins (id, user_id, role) VALUES (?, ?, 'admin')").bind(
        crypto.randomUUID(),
        id,
      ),
    );
  }
  await env.DB.batch(statements);
  return id;
}

async function signIn(email: string) {
  const response = await authRequest("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await response.text();
  return { status: response.status, cookie: cookieHeader(response), body };
}

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM appointment_slot_reservations WHERE staff_id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM appointments WHERE staff_id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM staff_time_off WHERE staff_id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM staff_working_hours WHERE staff_id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM staff_services WHERE staff_id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM staff WHERE id = 'ad_staff'"),
    env.DB.prepare("DELETE FROM services WHERE id IN ('ad_svc', 'ad_new')"),
    env.DB.prepare(
      `INSERT INTO services (id, slug, name, category, duration_minutes, price_minor, is_active)
       VALUES ('ad_svc', 'ad-gel', 'Admin Gel', 'nails', 60, 150000, 1)`,
    ),
    env.DB.prepare("INSERT INTO staff (id, name, is_active) VALUES ('ad_staff', 'Chao', 1)"),
    env.DB.prepare(
      "INSERT INTO staff_services (staff_id, service_id) VALUES ('ad_staff', 'ad_svc')",
    ),
    env.DB.prepare(
      `INSERT INTO staff_working_hours (id, staff_id, weekday, start_time, end_time, effective_from)
       VALUES ('ad_mon', 'ad_staff', 1, '09:00', '19:00', '2026-01-01')`,
    ),
  ]);
});

describe("admin authorization", () => {
  it("rejects every admin route without a session", async () => {
    for (const route of PROTECTED) {
      const response = await call(route.path, { method: route.method, body: route.body });
      expect(response.status, route.path).toBe(401);
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error.code).toBe("unauthenticated");
    }
  });

  it("rejects every admin route when the session is expired", async () => {
    const userId = await createAccount("expired-admin@example.com", true);
    const signedIn = await signIn("expired-admin@example.com");
    expect(signedIn.status, signedIn.body).toBe(200);
    expect(signedIn.cookie).toContain("=");
    await env.DB.prepare("UPDATE session SET expires_at = ? WHERE user_id = ?")
      .bind(Date.now() - 60_000, userId)
      .run();

    for (const route of PROTECTED) {
      const response = await call(
        route.path,
        { method: route.method, body: route.body },
        signedIn.cookie,
      );
      expect(response.status, route.path).toBe(401);
    }
  });

  it("rejects a signed-in user who is not an administrator", async () => {
    await createAccount("guest@example.com", false);
    const signedIn = await signIn("guest@example.com");
    expect(signedIn.status, signedIn.body).toBe(200);
    const response = await call("/api/v1/admin/me", {}, signedIn.cookie);
    expect(response.status).toBe(403);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("forbidden");
  });

  it("does not create an account from the public sign-up route", async () => {
    const response = await authRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "public-signup@example.com",
        password: PASSWORD,
        name: "Public",
      }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const row = await env.DB.prepare("SELECT id FROM user WHERE email = ?")
      .bind("public-signup@example.com")
      .first();
    expect(row).toBeNull();
  });

  it("deletes the session row on sign-out", async () => {
    const userId = await createAccount("logout-admin@example.com", true);
    const signedIn = await signIn("logout-admin@example.com");
    expect(signedIn.status, signedIn.body).toBe(200);
    const response = await authRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Cookie: signedIn.cookie },
    });
    expect(response.status).toBeLessThan(400);
    const remaining = await env.DB.prepare("SELECT COUNT(*) AS n FROM session WHERE user_id = ?")
      .bind(userId)
      .first<{ n: number }>();
    expect(remaining?.n).toBe(0);
    const after = await call("/api/v1/admin/me", {}, signedIn.cookie);
    expect(after.status).toBe(401);
  });
});

describe("admin studio management", () => {
  let cookie = "";

  beforeAll(async () => {
    await createAccount("chao-admin@example.com", true);
    const signedIn = await signIn("chao-admin@example.com");
    expect(signedIn.status, signedIn.body).toBe(200);
    cookie = signedIn.cookie;
  });

  it("rejects a status that the booking cannot move to", async () => {
    const startAt = at("11:00");
    const id = "apt_admin_pending";
    await insertAppointmentWithReservations(
      createDb(env.DB),
      {
        id,
        bookingReference: "ADMPEND",
        managementTokenHash: "hash",
        idempotencyKey: "admin-pending",
        customerName: "Amina",
        customerEmail: null,
        customerPhone: "+254712345678",
        staffId: "ad_staff",
        serviceId: "ad_svc",
        serviceNameSnapshot: "Admin Gel",
        durationMinutesSnapshot: 60,
        priceMinorSnapshot: 150000,
        currency: "KES",
        startAt,
        endAt: at("12:00"),
        location: "studio",
        address: null,
        customerNotes: null,
      },
      reservationSlots(new Date(startAt), 60, "studio"),
    );

    const response = await call(
      `/api/v1/admin/bookings/${id}`,
      { method: "PATCH", body: JSON.stringify({ status: "completed" }) },
      cookie,
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("invalid_status_transition");
  });

  it("releases the slot when an administrator cancels", async () => {
    const startAt = at("17:00");
    const before = await call(
      `/api/v1/availability?serviceId=ad_svc&date=${MONDAY}&location=studio`,
    );
    const open = ((await before.json()) as ApiSuccess<AvailabilityDto>).data.slots.map(
      (slot) => slot.startAt,
    );
    expect(open).toContain(startAt);

    const id = "apt_admin_cancel";
    await insertAppointmentWithReservations(
      createDb(env.DB),
      {
        id,
        bookingReference: "ADMCAN",
        managementTokenHash: "hash-2",
        idempotencyKey: "admin-cancel",
        customerName: "Amina",
        customerEmail: null,
        customerPhone: "+254712345678",
        staffId: "ad_staff",
        serviceId: "ad_svc",
        serviceNameSnapshot: "Admin Gel",
        durationMinutesSnapshot: 60,
        priceMinorSnapshot: 150000,
        currency: "KES",
        startAt,
        endAt: at("18:00"),
        location: "studio",
        address: null,
        customerNotes: null,
      },
      reservationSlots(new Date(startAt), 60, "studio"),
    );

    const taken = await call(
      `/api/v1/availability?serviceId=ad_svc&date=${MONDAY}&location=studio`,
    );
    const blocked = ((await taken.json()) as ApiSuccess<AvailabilityDto>).data.slots.map(
      (slot) => slot.startAt,
    );
    expect(blocked).not.toContain(startAt);

    const cancelled = await call(
      `/api/v1/admin/bookings/${id}`,
      { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) },
      cookie,
    );
    expect(cancelled.status).toBe(200);
    const booking = (await cancelled.json()) as ApiSuccess<AdminBookingDto>;
    expect(booking.data.status).toBe("cancelled");

    const after = await call(
      `/api/v1/availability?serviceId=ad_svc&date=${MONDAY}&location=studio`,
    );
    const freed = ((await after.json()) as ApiSuccess<AvailabilityDto>).data.slots.map(
      (slot) => slot.startAt,
    );
    expect(freed).toContain(startAt);

    const held = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM appointment_slot_reservations WHERE appointment_id = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(held?.n).toBe(0);

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_events WHERE entity_id = ? AND action = 'booking.status_changed'",
    )
      .bind(id)
      .first();
    expect(audit).not.toBeNull();
  });

  it("lets only one of two simultaneous status changes succeed", async () => {
    const startAt = at("09:00");
    const id = "apt_admin_race";
    await insertAppointmentWithReservations(
      createDb(env.DB),
      {
        id,
        bookingReference: "ADMRACE",
        managementTokenHash: "hash-3",
        idempotencyKey: "admin-race",
        customerName: "Amina",
        customerEmail: null,
        customerPhone: "+254712345678",
        staffId: "ad_staff",
        serviceId: "ad_svc",
        serviceNameSnapshot: "Admin Gel",
        durationMinutesSnapshot: 60,
        priceMinorSnapshot: 150000,
        currency: "KES",
        startAt,
        endAt: at("10:00"),
        location: "studio",
        address: null,
        customerNotes: null,
      },
      reservationSlots(new Date(startAt), 60, "studio"),
    );
    const confirmed = await call(
      `/api/v1/admin/bookings/${id}`,
      { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) },
      cookie,
    );
    expect(confirmed.status).toBe(200);

    const responses = await Promise.all(
      ["completed", "cancelled"].map((status) =>
        call(
          `/api/v1/admin/bookings/${id}`,
          { method: "PATCH", body: JSON.stringify({ status }) },
          cookie,
        ),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const audits = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_events WHERE entity_id = ? AND action = 'booking.status_changed'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(audits?.n).toBe(2);

    const final = await env.DB.prepare("SELECT status FROM appointments WHERE id = ?")
      .bind(id)
      .first<{ status: string }>();
    const held = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM appointment_slot_reservations WHERE appointment_id = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(held?.n === 0).toBe(final?.status === "cancelled");
  });

  it("hides a deactivated service from the public catalog", async () => {
    const created = await call(
      "/api/v1/admin/services",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Admin Trial",
          slug: "admin-trial",
          description: null,
          category: "nails",
          durationMinutes: 45,
          priceMinor: 100000,
          currency: "KES",
          isActive: true,
          displayOrder: 5,
        }),
      },
      cookie,
    );
    expect(created.status).toBe(201);
    const service = (await created.json()) as ApiSuccess<{ id: string }>;

    const listed = await call("/api/v1/services");
    const publicIds = ((await listed.json()) as ApiSuccess<ServiceDto[]>).data.map(
      (item) => item.id,
    );
    expect(publicIds).toContain(service.data.id);

    const hidden = await call(
      `/api/v1/admin/services/${service.data.id}`,
      { method: "PATCH", body: JSON.stringify({ isActive: false }) },
      cookie,
    );
    expect(hidden.status).toBe(200);

    const after = await call(`/api/v1/services/${service.data.id}`);
    expect(after.status).toBe(404);
    const catalog = (
      (await (await call("/api/v1/services")).json()) as ApiSuccess<ServiceDto[]>
    ).data.map((item) => item.id);
    expect(catalog).not.toContain(service.data.id);
  });

  it("removes a slot when time off covers it", async () => {
    const startAt = at("14:00");
    const open = await call(`/api/v1/availability?serviceId=ad_svc&date=${MONDAY}&location=studio`);
    expect(
      ((await open.json()) as ApiSuccess<AvailabilityDto>).data.slots.map((slot) => slot.startAt),
    ).toContain(startAt);

    const created = await call(
      "/api/v1/admin/time-off",
      {
        method: "POST",
        body: JSON.stringify({
          staffId: "ad_staff",
          startDate: MONDAY,
          startTime: "13:00",
          endDate: MONDAY,
          endTime: "16:00",
          reason: "Appointment elsewhere",
        }),
      },
      cookie,
    );
    expect(created.status).toBe(201);

    const after = await call(
      `/api/v1/availability?serviceId=ad_svc&date=${MONDAY}&location=studio`,
    );
    expect(
      ((await after.json()) as ApiSuccess<AvailabilityDto>).data.slots.map((slot) => slot.startAt),
    ).not.toContain(startAt);
  });

  it("rejects a non-image upload and hides unpublished images", async () => {
    const text = new FormData();
    text.set("altText", "Not a photo");
    text.set("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
    const rejected = await call("/api/v1/admin/gallery", { method: "POST", body: text }, cookie);
    expect(rejected.status).toBe(400);
    expect(((await rejected.json()) as ApiErrorBody).error.code).toBe("invalid_image");

    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const form = new FormData();
    form.set("altText", "Soft pink nails");
    form.set("file", new File([png], "nails.png", { type: "image/png" }));
    const uploaded = await call("/api/v1/admin/gallery", { method: "POST", body: form }, cookie);
    expect(uploaded.status).toBe(201);
    const image = (await uploaded.json()) as ApiSuccess<{ id: string; isPublished: boolean }>;
    expect(image.data.isPublished).toBe(false);

    const hiddenList = (await (await call("/api/v1/gallery")).json()) as ApiSuccess<
      Page<{ id: string }>
    >;
    expect(hiddenList.data.items.map((item) => item.id)).not.toContain(image.data.id);
    const hiddenBytes = await call(`/api/v1/gallery/${image.data.id}/image`);
    expect(hiddenBytes.status).toBe(404);

    const published = await call(
      `/api/v1/admin/gallery/${image.data.id}`,
      { method: "PATCH", body: JSON.stringify({ isPublished: true }) },
      cookie,
    );
    expect(published.status).toBe(200);
    const visible = (await (await call("/api/v1/gallery")).json()) as ApiSuccess<
      Page<{ id: string }>
    >;
    expect(visible.data.items.map((item) => item.id)).toContain(image.data.id);
    const bytes = await call(`/api/v1/gallery/${image.data.id}/image`);
    expect(bytes.status).toBe(200);
    expect(bytes.headers.get("content-type")).toContain("image/png");
  });
});
