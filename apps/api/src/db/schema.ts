import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category", { enum: ["nails", "makeup"] }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull().default("KES"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index("services_active_order_idx").on(table.isActive, table.displayOrder),
    check("services_duration_positive", sql`${table.durationMinutes} > 0`),
    check("services_price_non_negative", sql`${table.priceMinor} >= 0`),
    check("services_category_valid", sql`${table.category} IN ('nails', 'makeup')`),
    check("services_currency_format", sql`length(${table.currency}) = 3`),
  ],
);

export type ServiceRow = typeof services.$inferSelect;
