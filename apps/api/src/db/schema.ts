import { relations, type SQLWrapper, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** `HH:MM` in Africa/Nairobi. Zero-padded, so text order matches clock order. */
function localTime(column: SQLWrapper) {
  return sql`${column} GLOB '[0-1][0-9]:[0-5][0-9]' OR ${column} GLOB '2[0-3]:[0-5][0-9]'`;
}

/**
 * Canonical UTC instant `YYYY-MM-DDTHH:MM:SS.SSSZ` (what `Date#toISOString` produces).
 * Instants are compared and keyed as text, so a single format is required for correctness.
 * Round-trips through strftime because D1 rejects long GLOB patterns; `IS` (not `=`) makes
 * unparseable values fail instead of yielding NULL, which a CHECK would accept.
 */
function utcInstant(column: SQLWrapper) {
  return sql`strftime('%Y-%m-%dT%H:%M:%fZ', ${column}) IS ${column}`;
}

/** A canonical instant on a 15-minute boundary, e.g. `2026-10-28T06:15:00.000Z`. */
function slotInstant(column: SQLWrapper) {
  return sql`strftime('%Y-%m-%dT%H:%M:00.000Z', ${column}) IS ${column} AND strftime('%M', ${column}) IN ('00', '15', '30', '45')`;
}

const timestamp = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const now = () => new Date().toISOString();

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
    /** R2 object key, not a URL. */
    imageKey: text("image_key"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(timestamp),
    updatedAt: text("updated_at").notNull().default(timestamp).$onUpdate(now),
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
  updatedAt: text("updated_at").notNull().default(timestamp).$onUpdate(now),
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
    check("staff_time_off_start_at", utcInstant(table.startAt)),
    check("staff_time_off_end_at", utcInstant(table.endAt)),
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
    /** SHA-256 of the customer's booking-management token. The reference alone grants no access. */
    managementTokenHash: text("management_token_hash").notNull(),
    /** Client-supplied `Idempotency-Key`; a retried submission returns the original booking. */
    idempotencyKey: text("idempotency_key").unique(),
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
    updatedAt: text("updated_at").notNull().default(timestamp).$onUpdate(now),
  },
  (table) => [
    index("appointments_staff_start_idx").on(table.staffId, table.startAt),
    index("appointments_start_idx").on(table.startAt),
    check("appointments_reference_present", sql`length(${table.bookingReference}) > 0`),
    check("appointments_token_hash_present", sql`length(${table.managementTokenHash}) > 0`),
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
    check("appointments_start_at", utcInstant(table.startAt)),
    check("appointments_end_at", utcInstant(table.endAt)),
    check("appointments_range", sql`${table.endAt} > ${table.startAt}`),
    check(
      "appointments_travel_fee_non_negative",
      sql`${table.travelFeeMinor} IS NULL OR ${table.travelFeeMinor} >= 0`,
    ),
    check(
      "appointments_house_call_address",
      sql`${table.location} <> 'house_call' OR length(trim(coalesce(${table.address}, ''))) > 0`,
    ),
  ],
);

export type AppointmentRow = typeof appointments.$inferSelect;

/**
 * One row per 15-minute increment a booking occupies, including its buffers.
 * The primary key is the conflict lock: one staff member cannot hold the same instant twice.
 * Cancelling only changes the appointment status, so the cancel operation must delete these rows.
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
    check("appointment_slot_reservations_slot_start_at", slotInstant(table.slotStartAt)),
  ],
);

export type AppointmentSlotReservationRow = typeof appointmentSlotReservations.$inferSelect;

export const galleryImages = sqliteTable(
  "gallery_images",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    description: text("description"),
    altText: text("alt_text").notNull(),
    r2ObjectKey: text("r2_object_key").notNull().unique(),
    displayOrder: integer("display_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(timestamp),
    updatedAt: text("updated_at").notNull().default(timestamp).$onUpdate(now),
  },
  (table) => [
    index("gallery_images_published_order_idx").on(table.isPublished, table.displayOrder),
    check("gallery_images_alt_text_present", sql`length(${table.altText}) > 0`),
    check("gallery_images_object_key_present", sql`length(${table.r2ObjectKey}) > 0`),
  ],
);

export type GalleryImageRow = typeof galleryImages.$inferSelect;

/**
 * Better Auth identity tables. Drizzle property names stay camelCase because that is what the
 * adapter looks up; SQL columns are snake_case like the rest of the database.
 * Timestamps are Unix milliseconds (`timestamp_ms`), which is what the adapter reads and writes.
 */
const authTimestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: authTimestamp("created_at"),
  updatedAt: authTimestamp("updated_at"),
});

export type AuthUserRow = typeof user.$inferSelect;

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** Better Auth database-backed rate limit. `lastRequest` is Unix milliseconds. */
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

/** Application admin role. A Better Auth session is not enough; this row is required. */
export const admins = sqliteTable(
  "admins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin"] }).notNull(),
    createdAt: text("created_at").notNull().default(timestamp),
  },
  (table) => [check("admins_role_valid", sql`${table.role} = 'admin'`)],
);

export type AdminRow = typeof admins.$inferSelect;

/**
 * Important administrative actions. No passwords, session tokens, or extra customer fields.
 */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: text("created_at").notNull().default(timestamp),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    check("audit_events_action_present", sql`length(${table.action}) > 0`),
    check("audit_events_entity_type_present", sql`length(${table.entityType}) > 0`),
    check("audit_events_entity_id_present", sql`length(${table.entityId}) > 0`),
  ],
);

/** Sign-in loads the credential account through this relation. The property name must be `accounts`. */
export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
