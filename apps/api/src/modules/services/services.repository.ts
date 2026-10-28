import type { ServiceCategory, ServiceDto } from "@nailsbychao/types";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { type ServiceRow, services } from "../../db/schema";

export function toServiceDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    durationMinutes: row.durationMinutes,
    priceMinor: row.priceMinor,
    currency: row.currency,
  };
}

export async function listActiveServices(
  db: Db,
  filters: { category?: ServiceCategory } = {},
): Promise<ServiceDto[]> {
  const rows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.isActive, true),
        filters.category ? eq(services.category, filters.category) : undefined,
      ),
    )
    .orderBy(asc(services.displayOrder), asc(services.name));
  return rows.map(toServiceDto);
}
