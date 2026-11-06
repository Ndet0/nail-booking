import type { ApiSuccess, AvailabilityDto, BookingDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { isCalendarDate } from "../../utils/studio-time";
import {
  bookingAvailability,
  cancelBooking,
  getCustomerBooking,
  requireBooking,
  rescheduleBooking,
} from "./booking-management";
import { isCanonicalSlotInstant, parseCreateBooking } from "./booking-request";
import { createBooking } from "./bookings.repository";

const dateQuery = z.object({
  date: z.string().refine(isCalendarDate, "Use a real date in YYYY-MM-DD format."),
});

const rescheduleBody = z.object({
  startAt: z.string().refine(isCanonicalSlotInstant, "Choose a time on a 15-minute mark."),
});

export const bookingsRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
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
  })
  .get("/:reference", async (c) => {
    const row = await requireBooking(
      createDb(c.env.DB),
      c.req.param("reference"),
      c.req.header("X-Booking-Token"),
    );
    return c.json({ data: getCustomerBooking(row) } satisfies ApiSuccess<BookingDto>);
  })
  .get("/:reference/availability", validate("query", dateQuery), async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await bookingAvailability(db, row, c.req.valid("query").date);
    return c.json({ data } satisfies ApiSuccess<AvailabilityDto>);
  })
  .post("/:reference/cancel", async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await cancelBooking(db, row);
    return c.json({ data } satisfies ApiSuccess<BookingDto>);
  })
  .post("/:reference/reschedule", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AppError(400, "validation_error", "The request is invalid.");
    }
    const parsed = rescheduleBody.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        400,
        "validation_error",
        parsed.error.issues[0]?.message ?? "The request is invalid.",
        z.flattenError(parsed.error),
      );
    }

    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await rescheduleBooking(db, row, parsed.data.startAt);
    return c.json({ data } satisfies ApiSuccess<BookingDto>);
  });
