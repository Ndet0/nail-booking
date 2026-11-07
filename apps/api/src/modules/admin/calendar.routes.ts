import type { AdminCalendarDto, ApiSuccess, CalendarDayDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { closeCalendarDay, readAdminCalendar, reopenCalendarDay } from "./calendar.repository";
import { calendarClosureBody, calendarClosureQuery, calendarQuery } from "./schemas";

export const adminCalendarRoutes = new Hono<AppEnv>()
  .get("/", validate("query", calendarQuery), async (c) => {
    const { staffId, from, to } = c.req.valid("query");
    const data = await readAdminCalendar(createDb(c.env.DB), staffId, from, to);
    return c.json({ data } satisfies ApiSuccess<AdminCalendarDto>);
  })
  .post("/closures", validate("json", calendarClosureBody), async (c) => {
    const { staffId, date } = c.req.valid("json");
    const data = await closeCalendarDay(createDb(c.env.DB), c.get("admin").userId, staffId, date);
    return c.json({ data } satisfies ApiSuccess<CalendarDayDto>);
  })
  .delete("/closures", validate("query", calendarClosureQuery), async (c) => {
    const { staffId, date } = c.req.valid("query");
    const data = await reopenCalendarDay(createDb(c.env.DB), c.get("admin").userId, staffId, date);
    return c.json({ data } satisfies ApiSuccess<CalendarDayDto>);
  });
