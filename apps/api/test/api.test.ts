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

describe("database constraints", () => {
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
