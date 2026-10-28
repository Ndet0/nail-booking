import type { ApiSuccess, ServiceDto } from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { listActiveServices } from "./services.repository";

const listQuery = z.object({
  category: z.enum(["nails", "makeup"]).optional(),
});

export const servicesRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", listQuery),
  async (c) => {
    const { category } = c.req.valid("query");
    const data = await listActiveServices(createDb(c.env.DB), { category });
    return c.json({ data } satisfies ApiSuccess<ServiceDto[]>);
  },
);
