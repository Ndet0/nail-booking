import type { AdminProfileDto, ApiSuccess } from "@nailsbychao/types";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import { user } from "../../db/schema";
import type { AppEnv } from "../../env";
import { AppError } from "../../utils/errors";
import { requireAdmin } from "../auth/require-admin";
import { adminBookingRoutes } from "./bookings.routes";
import { adminCalendarRoutes } from "./calendar.routes";
import { adminGalleryRoutes } from "./gallery.routes";
import { adminNotificationRoutes } from "./notifications.routes";
import { adminServiceRoutes } from "./services.routes";
import { adminStaffRoutes, adminTimeOffRoutes } from "./staff.routes";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", requireAdmin);
adminRoutes.get("/me", async (c) => {
  const actor = c.get("admin");
  const row = await createDb(c.env.DB)
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, actor.userId))
    .get();
  if (!row) throw new AppError(401, "unauthenticated", "Sign in to continue.");
  const data: AdminProfileDto = { userId: actor.userId, email: row.email, name: row.name };
  return c.json({ data } satisfies ApiSuccess<AdminProfileDto>);
});
adminRoutes.route("/bookings", adminBookingRoutes);
adminRoutes.route("/calendar", adminCalendarRoutes);
adminRoutes.route("/notifications", adminNotificationRoutes);
adminRoutes.route("/services", adminServiceRoutes);
adminRoutes.route("/staff", adminStaffRoutes);
adminRoutes.route("/time-off", adminTimeOffRoutes);
adminRoutes.route("/gallery", adminGalleryRoutes);
