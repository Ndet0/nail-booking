import type { ApiSuccess, ServiceDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { getActiveServiceById, listActiveServices } from "./services.repository";

const listQuery = z.object({
  category: z.enum(["nails", "makeup"]).optional(),
});

const idParam = z.object({
  id: z.string().trim().min(1).max(64),
});

export const servicesRoutes = new Hono<AppEnv>()
  .get("/", validate("query", listQuery), async (c) => {
    const { category } = c.req.valid("query");
    const data = await listActiveServices(createDb(c.env.DB), { category });
    return c.json({ data } satisfies ApiSuccess<ServiceDto[]>);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    // Inactive services are hidden from the public API, so they 404 like unknown ids.
    const data = await getActiveServiceById(createDb(c.env.DB), id);
    if (!data) {
      throw new AppError(404, "service_not_found", "This service is not available.");
    }
    return c.json({ data } satisfies ApiSuccess<ServiceDto>);
  });
