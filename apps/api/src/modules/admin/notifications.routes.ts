import type { ApiSuccess, NotificationListDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notifications/notifications";
import { idParam } from "./schemas";

export const adminNotificationRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const data = await listNotifications(createDb(c.env.DB), "admin");
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  })
  .post("/read", async (c) => {
    const db = createDb(c.env.DB);
    await markAllNotificationsRead(db, "admin");
    const data = await listNotifications(db, "admin");
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  })
  .post("/:id/read", validate("param", idParam), async (c) => {
    const db = createDb(c.env.DB);
    const found = await markNotificationRead(db, "admin", c.req.valid("param").id);
    if (!found) throw new AppError(404, "not_found", "That notification was not found.");
    const data = await listNotifications(db, "admin");
    return c.json({ data } satisfies ApiSuccess<NotificationListDto>);
  });
