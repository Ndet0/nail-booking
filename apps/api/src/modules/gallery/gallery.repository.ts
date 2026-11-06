import type { GalleryImageDto, Page } from "@nailsbychao/types";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { galleryImages } from "../../db/schema";
import { decodeCursor, encodeCursor, pageOf } from "../../utils/cursor";
import { AppError } from "../../utils/errors";

function toGallery(row: typeof galleryImages.$inferSelect): GalleryImageDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    altText: row.altText,
    displayOrder: row.displayOrder,
    imagePath: `/api/v1/gallery/${row.id}/image`,
  };
}

export async function listPublishedGallery(
  db: Db,
  filters: { limit: number; cursor?: string },
): Promise<Page<GalleryImageDto>> {
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  const displayOrder = cursor ? Number(cursor.displayOrder) : null;
  if (cursor && (!cursor.id || displayOrder === null || !Number.isInteger(displayOrder))) {
    throw new AppError(400, "validation_error", "The request is invalid.");
  }

  const rows = await db
    .select()
    .from(galleryImages)
    .where(
      and(
        eq(galleryImages.isPublished, true),
        cursor
          ? or(
              sql`${galleryImages.displayOrder} > ${displayOrder}`,
              and(
                eq(galleryImages.displayOrder, displayOrder ?? 0),
                sql`${galleryImages.id} > ${cursor.id}`,
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(galleryImages.displayOrder), asc(galleryImages.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) =>
    encodeCursor({ displayOrder: String(row.displayOrder), id: row.id }),
  );
  return { items: page.items.map(toGallery), nextCursor: page.nextCursor };
}

export async function getPublishedImage(db: Db, id: string) {
  return (
    (await db
      .select()
      .from(galleryImages)
      .where(and(eq(galleryImages.id, id), eq(galleryImages.isPublished, true)))
      .get()) ?? null
  );
}
