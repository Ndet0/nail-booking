import type { ApiSuccess, GalleryImageDto, Page } from "@nailsbychao/types";
import { Hono } from "hono";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { idParam, pageQuery } from "../admin/schemas";
import { getPublishedImage, listPublishedGallery } from "./gallery.repository";
import { imageResponse, mimeForKey } from "./images";

export const galleryRoutes = new Hono<AppEnv>()
  .get("/", validate("query", pageQuery), async (c) => {
    const data = await listPublishedGallery(createDb(c.env.DB), c.req.valid("query"));
    return c.json({ data } satisfies ApiSuccess<Page<GalleryImageDto>>);
  })
  .get("/:id/image", validate("param", idParam), async (c) => {
    const row = await getPublishedImage(createDb(c.env.DB), c.req.valid("param").id);
    if (!row) throw new AppError(404, "gallery_not_found", "That image was not found.");
    const object = await c.env.BUCKET.get(row.r2ObjectKey);
    if (!object) throw new AppError(404, "gallery_not_found", "That image was not found.");
    return imageResponse(
      object.body,
      object.httpMetadata?.contentType ?? mimeForKey(row.r2ObjectKey),
      "public",
    );
  });
