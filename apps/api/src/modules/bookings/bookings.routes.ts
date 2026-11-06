import type { ApiSuccess, BookingDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { AppError } from "../../utils/errors";
import { parseCreateBooking } from "./booking-request";
import { createBooking } from "./bookings.repository";

export const bookingsRoutes = new Hono<AppEnv>().post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError(400, "validation_error", "The request is invalid.");
  }

  const input = parseCreateBooking(body, c.req.header("Idempotency-Key"));
  const result = await createBooking(createDb(c.env.DB), input);
  const status = result.created ? 201 : 200;
  return c.json({ data: result.booking } satisfies ApiSuccess<BookingDto>, status);
});
