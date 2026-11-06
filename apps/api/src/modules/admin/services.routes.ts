import type { AdminServiceDto, ApiSuccess, Page } from "@nailsbychao/types";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { idParam, pageQuery, serviceCreateBody, servicePatchBody } from "./schemas";
import { createService, listAdminServices, updateService } from "./services.repository";

export const adminServiceRoutes = new Hono<AppEnv>()
  .get("/", validate("query", pageQuery), async (c) => {
    const query = c.req.valid("query");
    const data = await listAdminServices(createDb(c.env.DB), query);
    return c.json({ data } satisfies ApiSuccess<Page<AdminServiceDto>>);
  })
  .post("/", validate("json", serviceCreateBody), async (c) => {
    const data = await createService(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("json"),
    );
    return c.json({ data } satisfies ApiSuccess<AdminServiceDto>, 201);
  })
  .patch("/:id", validate("param", idParam), validate("json", servicePatchBody), async (c) => {
    const data = await updateService(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return c.json({ data } satisfies ApiSuccess<AdminServiceDto>);
  });
