import type { AdminServiceDto, Page, ServiceCategory } from "@nailsbychao/types";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { services } from "../../db/schema";
import { decodeCursor, encodeCursor, pageOf } from "../../utils/cursor";
import { AppError } from "../../utils/errors";
import { uniqueConstraintTarget } from "../../utils/sqlite";
import { auditInsert } from "../auth/audit";
import { runBatch } from "./batch";

export type ServiceWrite = {
  name: string;
  slug: string;
  description: string | null;
  category: ServiceCategory;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  isActive: boolean;
  displayOrder: number;
};

function toAdminService(row: typeof services.$inferSelect): AdminServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    durationMinutes: row.durationMinutes,
    priceMinor: row.priceMinor,
    currency: row.currency,
    isActive: row.isActive,
    displayOrder: row.displayOrder,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function listAdminServices(
  db: Db,
  filters: { limit: number; cursor?: string },
): Promise<Page<AdminServiceDto>> {
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  const displayOrder = cursor ? Number(cursor.displayOrder) : null;
  if (cursor && (!cursor.id || displayOrder === null || !Number.isInteger(displayOrder))) {
    throw new AppError(400, "validation_error", "The request is invalid.");
  }

  const rows = await db
    .select()
    .from(services)
    .where(
      cursor
        ? or(
            sql`${services.displayOrder} > ${displayOrder}`,
            and(eq(services.displayOrder, displayOrder ?? 0), sql`${services.id} > ${cursor.id}`),
          )
        : undefined,
    )
    .orderBy(asc(services.displayOrder), asc(services.id))
    .limit(filters.limit + 1);

  const page = pageOf(rows, filters.limit, (row) =>
    encodeCursor({ displayOrder: String(row.displayOrder), id: row.id }),
  );
  return { items: page.items.map(toAdminService), nextCursor: page.nextCursor };
}

export async function createService(
  db: Db,
  actorId: string,
  input: ServiceWrite,
): Promise<AdminServiceDto> {
  const id = newId("svc");
  try {
    await runBatch(db, [
      db.insert(services).values({ id, ...input }),
      auditInsert(db, { actorId, action: "service.created", entityType: "service", entityId: id }),
    ]);
  } catch (error) {
    if (uniqueConstraintTarget(error)?.includes("slug")) {
      throw new AppError(409, "slug_taken", "A service already uses that slug.");
    }
    throw error;
  }
  const created = await db.select().from(services).where(eq(services.id, id)).get();
  if (!created)
    throw new AppError(500, "internal_error", "Something went wrong. Please try again.");
  return toAdminService(created);
}

export async function updateService(
  db: Db,
  actorId: string,
  id: string,
  input: Partial<ServiceWrite>,
): Promise<AdminServiceDto> {
  const existing = await db.select().from(services).where(eq(services.id, id)).get();
  if (!existing) throw new AppError(404, "service_not_found", "That service was not found.");

  try {
    await runBatch(db, [
      db
        .update(services)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(services.id, id)),
      auditInsert(db, { actorId, action: "service.updated", entityType: "service", entityId: id }),
    ]);
  } catch (error) {
    if (uniqueConstraintTarget(error)?.includes("slug")) {
      throw new AppError(409, "slug_taken", "A service already uses that slug.");
    }
    throw error;
  }

  const updated = await db.select().from(services).where(eq(services.id, id)).get();
  if (!updated) throw new AppError(404, "service_not_found", "That service was not found.");
  return toAdminService(updated);
}
