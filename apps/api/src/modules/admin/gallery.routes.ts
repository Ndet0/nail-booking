import type { AdminGalleryImageDto, ApiSuccess, Page } from "@nailsbychao/types";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../db/client";
import type { AppEnv } from "../../env";
import { validate } from "../../middleware/validator";
import { AppError } from "../../utils/errors";
import { detectImage, imageResponse, mimeForKey } from "../gallery/images";
import {
  deleteGalleryRow,
  getGalleryRow,
  insertGalleryImage,
  listAdminGallery,
  updateGalleryImage,
} from "./gallery.repository";
import { galleryPatchBody, idParam, pageQuery } from "./schemas";

const uploadFields = z.object({
  altText: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const adminGalleryRoutes = new Hono<AppEnv>()
  .get("/", validate("query", pageQuery), async (c) => {
    const data = await listAdminGallery(createDb(c.env.DB), c.req.valid("query"));
    return c.json({ data } satisfies ApiSuccess<Page<AdminGalleryImageDto>>);
  })
  .post("/", async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError(400, "validation_error", "Choose an image to upload.");
    }
    const parsed = uploadFields.safeParse({
      altText: form.get("altText"),
      title: form.get("title") || undefined,
      description: form.get("description") || undefined,
      displayOrder: form.get("displayOrder") || undefined,
    });
    if (!parsed.success) {
      throw new AppError(
        400,
        "validation_error",
        "The request is invalid.",
        z.flattenError(parsed.error),
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = detectImage(bytes);
    if (!image) {
      throw new AppError(400, "invalid_image", "Upload a JPEG, PNG, or WebP image up to 5 MB.");
    }

    const id = `gal_${crypto.randomUUID().replaceAll("-", "")}`;
    const key = `gallery/${id}.${image.extension}`;
    await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: image.mime } });

    try {
      const data = await insertGalleryImage(createDb(c.env.DB), c.get("admin").userId, {
        id,
        r2ObjectKey: key,
        title: parsed.data.title ?? null,
        description: parsed.data.description ?? null,
        altText: parsed.data.altText,
        displayOrder: parsed.data.displayOrder,
        isPublished: false,
      });
      return c.json({ data } satisfies ApiSuccess<AdminGalleryImageDto>, 201);
    } catch (error) {
      await c.env.BUCKET.delete(key);
      throw error;
    }
  })
  .get("/:id/image", validate("param", idParam), async (c) => {
    const row = await getGalleryRow(createDb(c.env.DB), c.req.valid("param").id);
    if (!row) throw new AppError(404, "gallery_not_found", "That image was not found.");
    const object = await c.env.BUCKET.get(row.r2ObjectKey);
    if (!object) throw new AppError(404, "gallery_not_found", "That image was not found.");
    return imageResponse(
      object.body,
      object.httpMetadata?.contentType ?? mimeForKey(row.r2ObjectKey),
      "private",
    );
  })
  .patch("/:id", validate("param", idParam), validate("json", galleryPatchBody), async (c) => {
    const data = await updateGalleryImage(
      createDb(c.env.DB),
      c.get("admin").userId,
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return c.json({ data } satisfies ApiSuccess<AdminGalleryImageDto>);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const db = createDb(c.env.DB);
    const row = await getGalleryRow(db, c.req.valid("param").id);
    if (!row) throw new AppError(404, "gallery_not_found", "That image was not found.");
    await c.env.BUCKET.delete(row.r2ObjectKey);
    await deleteGalleryRow(db, c.get("admin").userId, row.id);
    return c.body(null, 204);
  });
