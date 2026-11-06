import type { AdminGalleryImageDto, Page } from "@nailsbychao/types";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { galleryImages } from "../../db/schema";
import { decodeCursor, encodeCursor, pageOf } from "../../utils/cursor";
import { AppError } from "../../utils/errors";
import { auditInsert } from "../auth/audit";
import { runBatch } from "./batch";

export type GalleryWrite = {
  title: string | null;
  description: string | null;
  altText: string;
  displayOrder: number;
  isPublished: boolean;
};

function toAdminGallery(row: typeof galleryImages.$inferSelect): AdminGalleryImageDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    altText: row.altText,
    displayOrder: row.displayOrder,
    imagePath: `/api/v1/admin/gallery/${row.id}/image`,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
  };
}

export async function listAdminGallery(
  db: Db,
  filters: { limit: number; cursor?: string },
): Promise<Page<AdminGalleryImageDto>> {
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  const displayOrder = cursor ? Number(cursor.displayOrder) : null;
  if (cursor && (!cursor.id || displayOrder === null || !Number.isInteger(displayOrder))) {
    throw new AppError(400, "validation_error", "The request is invalid.");
  }

  const rows = await db
    .select()
    .from(galleryImages)
    .where(
      cursor
        ? or(
            sql`${galleryImages.displayOrder} > ${displayOrder}`,
            and(
              eq(galleryImages.displayOrder, displayOrder ?? 0),
              sql`${galleryImages.id} > ${cursor.id}`,
            ),
          )
        : undefined,
    )
    .orderBy(asc(galleryImages.displayOrder), asc(galleryImages.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) =>
    encodeCursor({ displayOrder: String(row.displayOrder), id: row.id }),
  );
  return { items: page.items.map(toAdminGallery), nextCursor: page.nextCursor };
}

export async function insertGalleryImage(
  db: Db,
  actorId: string,
  row: { id: string; r2ObjectKey: string } & GalleryWrite,
): Promise<AdminGalleryImageDto> {
  await runBatch(db, [
    db.insert(galleryImages).values({ ...row, isPublished: false }),
    auditInsert(db, {
      actorId,
      action: "gallery.created",
      entityType: "gallery_image",
      entityId: row.id,
    }),
  ]);
  const created = await db.select().from(galleryImages).where(eq(galleryImages.id, row.id)).get();
  if (!created)
    throw new AppError(500, "internal_error", "Something went wrong. Please try again.");
  return toAdminGallery(created);
}

export async function updateGalleryImage(
  db: Db,
  actorId: string,
  id: string,
  input: Partial<GalleryWrite>,
): Promise<AdminGalleryImageDto> {
  const existing = await db.select().from(galleryImages).where(eq(galleryImages.id, id)).get();
  if (!existing) throw new AppError(404, "gallery_not_found", "That image was not found.");

  await runBatch(db, [
    db
      .update(galleryImages)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(galleryImages.id, id)),
    auditInsert(db, {
      actorId,
      action: "gallery.updated",
      entityType: "gallery_image",
      entityId: id,
    }),
  ]);

  const updated = await db.select().from(galleryImages).where(eq(galleryImages.id, id)).get();
  if (!updated) throw new AppError(404, "gallery_not_found", "That image was not found.");
  return toAdminGallery(updated);
}

export async function getGalleryRow(db: Db, id: string) {
  return (await db.select().from(galleryImages).where(eq(galleryImages.id, id)).get()) ?? null;
}

export async function deleteGalleryRow(db: Db, actorId: string, id: string) {
  await runBatch(db, [
    db.delete(galleryImages).where(eq(galleryImages.id, id)),
    auditInsert(db, {
      actorId,
      action: "gallery.deleted",
      entityType: "gallery_image",
      entityId: id,
    }),
  ]);
}
