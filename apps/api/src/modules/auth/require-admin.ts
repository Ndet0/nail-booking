import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { createDb } from "../../db/client";
import { admins } from "../../db/schema";
import type { AppEnv } from "../../env";
import { AppError } from "../../utils/errors";
import { createAuth } from "./auth";

/** Session cookie plus an `admins` row. A signed-in customer is not an administrator. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    throw new AppError(401, "unauthenticated", "Sign in to continue.");
  }

  const admin = await createDb(c.env.DB)
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.userId, session.user.id))
    .get();
  if (!admin) {
    throw new AppError(403, "forbidden", "You do not have access to this.");
  }

  c.set("admin", { userId: session.user.id, adminId: admin.id });
  await next();
});
