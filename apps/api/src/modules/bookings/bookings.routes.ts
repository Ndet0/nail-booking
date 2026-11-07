import type {
  ApiSuccess,
  AvailabilityDto,
  BookingClosedDatesDto,
  BookingDto,
  NotificationListDto,
} from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { isCalendarDate } from "../../utils/studio-time";
import {
  assertLookupAllowed,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notifications/notifications";
import {
  bookingAvailability,
  bookingClosedDates,
  cancelBooking,
  getCustomerBooking,
  lookupBooking,
  requireBooking,
  rescheduleBooking,
} from "./booking-management";
import { isCanonicalSlotInstant, parseCreateBooking } from "./booking-request";
import { createBooking } from "./bookings.repository";
import { assertBookingWriteAllowed, clientAddressHash } from "./write-limit";

const calendarDate = z.string().refine(isCalendarDate, "Use a real date in YYYY-MM-DD format.");

const dateQuery = z.object({
  date: calendarDate,
});

const closedDatesQuery = z.object({
  from: calendarDate,
  to: calendarDate,
});

const rescheduleBody = z.object({
  startAt: z.string().refine(isCanonicalSlotInstant, "Choose a time on a 15-minute mark."),
});

const lookupBody = z.object({
  bookingReference: z.string().trim().min(1, "Enter the booking reference.").max(40),
  customerPhone: z.string().trim().min(1, "Enter your phone number.").max(30),
});

export const bookingsRoutes = new Hono<AppEnv>()
  .post("/lookup", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AppError(400, "validation_error", "The request is invalid.");
    }
    const parsed = lookupBody.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        400,
        "validation_error",
        parsed.error.issues[0]?.message ?? "The request is invalid.",
        z.flattenError(parsed.error),
      );
    }

    const db = createDb(c.env.DB);
    const ipHash = await clientAddressHash(c.req.header("cf-connecting-ip"));
    await assertLookupAllowed(db, ipHash);
    const data = await lookupBooking(db, parsed.data.bookingReference, parsed.data.customerPhone);
    return c.json({ data } satisfies ApiSuccess<BookingDto>);
  })
  .post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AppError(400, "validation_error", "The request is invalid.");
    }

    const input = parseCreateBooking(body, c.req.header("Idempotency-Key"));
    const db = createDb(c.env.DB);
    await assertBookingWriteAllowed(
      db,
      await clientAddressHash(c.req.header("cf-connecting-ip")),
      "create",
    );
    const result = await createBooking(db, input);
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
  .get("/:reference/closed-dates", validate("query", closedDatesQuery), async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const { from, to } = c.req.valid("query");
    const data = await bookingClosedDates(db, row, from, to);
    return c.json({ data } satisfies ApiSuccess<BookingClosedDatesDto>);
  })
  .get("/:reference/availability", validate("query", dateQuery), async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await bookingAvailability(db, row, c.req.valid("query").date);
    return c.json({ data } satisfies ApiSuccess<AvailabilityDto>);
  })
  .post("/:reference/cancel", async (c) => {
    const db = createDb(c.env.DB);
    await assertBookingWriteAllowed(
      db,
      await clientAddressHash(c.req.header("cf-connecting-ip")),
      "cancel",
    );
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
    await assertBookingWriteAllowed(
      db,
      await clientAddressHash(c.req.header("cf-connecting-ip")),
      "reschedule",
    );
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await rescheduleBooking(db, row, parsed.data.startAt);
    return c.json({ data } satisfies ApiSuccess<BookingDto>);
  })
  .get("/:reference/notifications", async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const data = await listNotifications(db, "customer", row.id);
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  })
  .post("/:reference/notifications/read", async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    await markAllNotificationsRead(db, "customer", row.id);
    const data = await listNotifications(db, "customer", row.id);
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  })
  .post("/:reference/notifications/:notificationId/read", async (c) => {
    const db = createDb(c.env.DB);
    const row = await requireBooking(db, c.req.param("reference"), c.req.header("X-Booking-Token"));
    const found = await markNotificationRead(db, "customer", c.req.param("notificationId"), row.id);
    if (!found) throw new AppError(404, "not_found", "That notification was not found.");
    const data = await listNotifications(db, "customer", row.id);
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  });
