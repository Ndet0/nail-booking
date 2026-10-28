import type { ApiSuccess, HealthDto } from "@nailsbychao/types";
import { Hono } from "hono";
import type { AppEnv } from "../env";

export const healthRoutes = new Hono<AppEnv>().get("/", async (c) => {
  let db: HealthDto["db"] = "ok";
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch (error) {
    console.error("Health check: D1 unavailable", error);
    db = "error";
  }
  const body: ApiSuccess<HealthDto> = { data: { status: db === "ok" ? "ok" : "degraded", db } };
  return c.json(body, db === "ok" ? 200 : 503);
});
