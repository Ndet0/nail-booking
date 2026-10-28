import { type SQLWrapper, sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** `HH:MM` in Africa/Nairobi. Zero-padded, so text order matches clock order. */
function localTime(column: SQLWrapper) {
  return sql`${column} GLOB '[0-1][0-9]:[0-5][0-9]' OR ${column} GLOB '2[0-3]:[0-5][0-9]'`;
}

const timestamp = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

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
    createdAt: text("created_at").notNull().default(timestamp),
    updatedAt: text("updated_at").notNull().default(timestamp),
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

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(timestamp),
  updatedAt: text("updated_at").notNull().default(timestamp),
});

export type StaffRow = typeof staff.$inferSelect;

export const staffServices = sqliteTable(
  "staff_services",
  {
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
  },
  (table) => [primaryKey({ columns: [table.staffId, table.serviceId] })],
);

export type StaffServiceRow = typeof staffServices.$inferSelect;

/**
 * Recurring hours in Africa/Nairobi local time.
 * `weekday` is 0 = Sunday through 6 = Saturday. Several rows per weekday are allowed (split shifts).
 */
export const staffWorkingHours = sqliteTable(
  "staff_working_hours",
  {
    id: text("id").primaryKey(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveUntil: text("effective_until"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("staff_working_hours_staff_weekday_idx").on(table.staffId, table.weekday),
    check("staff_working_hours_weekday", sql`${table.weekday} BETWEEN 0 AND 6`),
    check("staff_working_hours_start_time", localTime(table.startTime)),
    check("staff_working_hours_end_time", localTime(table.endTime)),
    check("staff_working_hours_range", sql`${table.endTime} > ${table.startTime}`),
    check(
      "staff_working_hours_effective_from",
      sql`${table.effectiveFrom} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`,
    ),
    check(
      "staff_working_hours_effective_until",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`,
    ),
    check(
      "staff_working_hours_effective_range",
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} >= ${table.effectiveFrom}`,
    ),
  ],
);

export type StaffWorkingHoursRow = typeof staffWorkingHours.$inferSelect;

/** Absolute instants (`YYYY-MM-DDTHH:MM:SS.SSSZ`). Breaks and closures, not weekly hours. */
export const staffTimeOff = sqliteTable(
  "staff_time_off",
  {
    id: text("id").primaryKey(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull().default(timestamp),
  },
  (table) => [
    index("staff_time_off_staff_start_idx").on(table.staffId, table.startAt),
    check("staff_time_off_range", sql`${table.endAt} > ${table.startAt}`),
  ],
);

export type StaffTimeOffRow = typeof staffTimeOff.$inferSelect;

export const appointmentStatuses = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;

export const appointmentLocations = ["studio", "house_call"] as const;

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    bookingReference: text("booking_reference").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone").notNull(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    serviceNameSnapshot: text("service_name_snapshot").notNull(),
    durationMinutesSnapshot: integer("duration_minutes_snapshot").notNull(),
    priceMinorSnapshot: integer("price_minor_snapshot").notNull(),
    currency: text("currency").notNull().default("KES"),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    status: text("status", { enum: appointmentStatuses }).notNull().default("pending"),
    location: text("location", { enum: appointmentLocations }).notNull(),
    address: text("address"),
    travelFeeMinor: integer("travel_fee_minor"),
    customerNotes: text("customer_notes"),
    createdAt: text("created_at").notNull().default(timestamp),
    updatedAt: text("updated_at").notNull().default(timestamp),
  },
  (table) => [
    index("appointments_staff_start_idx").on(table.staffId, table.startAt),
    check("appointments_reference_present", sql`length(${table.bookingReference}) > 0`),
    check("appointments_customer_name_present", sql`length(${table.customerName}) > 0`),
    check("appointments_customer_phone_present", sql`length(${table.customerPhone}) > 0`),
    check(
      "appointments_status_valid",
      sql`${table.status} IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')`,
    ),
    check("appointments_location_valid", sql`${table.location} IN ('studio', 'house_call')`),
    check("appointments_duration_positive", sql`${table.durationMinutesSnapshot} > 0`),
    check("appointments_price_non_negative", sql`${table.priceMinorSnapshot} >= 0`),
    check("appointments_currency_format", sql`length(${table.currency}) = 3`),
    check("appointments_range", sql`${table.endAt} > ${table.startAt}`),
    check(
      "appointments_travel_fee_non_negative",
      sql`${table.travelFeeMinor} IS NULL OR ${table.travelFeeMinor} >= 0`,
    ),
  ],
);

export type AppointmentRow = typeof appointments.$inferSelect;

/**
 * One row per 15-minute increment a booking occupies.
 * The primary key is the conflict lock: one staff member cannot hold the same instant twice.
 */
export const appointmentSlotReservations = sqliteTable(
  "appointment_slot_reservations",
  {
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    slotStartAt: text("slot_start_at").notNull(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.slotStartAt] }),
    index("appointment_slot_reservations_appointment_idx").on(table.appointmentId),
  ],
);

export type AppointmentSlotReservationRow = typeof appointmentSlotReservations.$inferSelect;
