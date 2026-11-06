import type {
  AdminStaffDto,
  ApiSuccess,
  Page,
  TimeOffDto,
  WorkingHoursDto,
} from "@nailsbychao/types";
import { Hono } from "hono";
import { STUDIO } from "../../config/studio";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { addDays, localToUtc } from "../../utils/studio-time";
import {
  hoursBody,
  idParam,
  pageQuery,
  staffCreateBody,
  staffPatchBody,
  staffServicesBody,
  timeOffBody,
  timeOffListQuery,
} from "./schemas";
import {
  createStaff,
  createTimeOff,
  deleteTimeOff,
  listHours,
  listStaff,
  listTimeOff,
  replaceHours,
  replaceStaffServices,
  updateStaff,
} from "./staff.repository";

export const adminStaffRoutes = new Hono<AppEnv>()
  .get("/", validate("query", pageQuery), async (c) => {
    const data = await listStaff(createDb(c.env.DB), c.req.valid("query"));
    return c.json({ data } satisfies ApiSuccess<Page<AdminStaffDto>>);
  })
  .post("/", validate("json", staffCreateBody), async (c) => {
    const data = await createStaff(createDb(c.env.DB), c.get("admin").userId, c.req.valid("json"));
    return c.json({ data } satisfies ApiSuccess<AdminStaffDto>, 201);
  })
  .patch("/:id", validate("param", idParam), validate("json", staffPatchBody), async (c) => {
    const data = await updateStaff(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return c.json({ data } satisfies ApiSuccess<AdminStaffDto>);
  })
  .put(
    "/:id/services",
    validate("param", idParam),
    validate("json", staffServicesBody),
    async (c) => {
      const data = await replaceStaffServices(
        createDb(c.env.DB),
        c.get("admin").userId,
        c.req.valid("param").id,
        c.req.valid("json").serviceIds,
      );
      return c.json({ data } satisfies ApiSuccess<AdminStaffDto>);
    },
  )
  .get("/:id/hours", validate("param", idParam), async (c) => {
    const data = await listHours(createDb(c.env.DB), c.req.valid("param").id);
    return c.json({ data } satisfies ApiSuccess<WorkingHoursDto[]>);
  })
  .put("/:id/hours", validate("param", idParam), validate("json", hoursBody), async (c) => {
    const data = await replaceHours(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("param").id,
      c.req.valid("json").hours,
    );
    return c.json({ data } satisfies ApiSuccess<WorkingHoursDto[]>);
  });

export const adminTimeOffRoutes = new Hono<AppEnv>()
  .get("/", validate("query", timeOffListQuery), async (c) => {
    const query = c.req.valid("query");
    const data = await listTimeOff(createDb(c.env.DB), {
      staffId: query.staffId,
      fromInstant: query.from
        ? localToUtc(query.from, "00:00", STUDIO.timezone).toISOString()
        : undefined,
      toInstant: query.to
        ? localToUtc(addDays(query.to, 1), "00:00", STUDIO.timezone).toISOString()
        : undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({ data } satisfies ApiSuccess<Page<TimeOffDto>>);
  })
  .post("/", validate("json", timeOffBody), async (c) => {
    const body = c.req.valid("json");
    const data = await createTimeOff(createDb(c.env.DB), c.get("admin").userId, {
      staffId: body.staffId,
      startAt: localToUtc(body.startDate, body.startTime, STUDIO.timezone).toISOString(),
      endAt: localToUtc(body.endDate, body.endTime, STUDIO.timezone).toISOString(),
      reason: body.reason,
    });
    return c.json({ data } satisfies ApiSuccess<TimeOffDto>, 201);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    await deleteTimeOff(createDb(c.env.DB), c.get("admin").userId, c.req.valid("param").id);
    return c.body(null, 204);
  });
