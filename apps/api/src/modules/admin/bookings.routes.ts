import type { AdminBookingDto, ApiSuccess, Page } from "@nailsbychao/types";
import { Hono } from "hono";
import { STUDIO } from "../../config/studio";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { addDays, localToUtc } from "../../utils/studio-time";
import { changeBookingStatus, getAdminBooking, listAdminBookings } from "./bookings.repository";
import { bookingListQuery, idParam, statusBody } from "./schemas";

export const adminBookingRoutes = new Hono<AppEnv>()
  .get("/", validate("query", bookingListQuery), async (c) => {
    const query = c.req.valid("query");
    const fromInstant = query.from
      ? localToUtc(query.from, "00:00", STUDIO.timezone).toISOString()
      : query.to
        ? undefined
        : new Date().toISOString();
    const toInstant = query.to
      ? localToUtc(addDays(query.to, 1), "00:00", STUDIO.timezone).toISOString()
      : undefined;

    const data = await listAdminBookings(createDb(c.env.DB), {
      status: query.status,
      fromInstant,
      toInstant,
      cursor: query.cursor,
      limit: query.limit,
    });
    return c.json({ data } satisfies ApiSuccess<Page<AdminBookingDto>>);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const data = await getAdminBooking(createDb(c.env.DB), c.req.valid("param").id);
    if (!data) throw new AppError(404, "booking_not_found", "That booking was not found.");
    return c.json({ data } satisfies ApiSuccess<AdminBookingDto>);
  })
  .patch("/:id", validate("param", idParam), validate("json", statusBody), async (c) => {
    const data = await changeBookingStatus(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("param").id,
      c.req.valid("json").status,
    );
    return c.json({ data } satisfies ApiSuccess<AdminBookingDto>);
  });
