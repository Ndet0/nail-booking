CREATE TABLE `gallery_images` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`description` text,
	`alt_text` text NOT NULL,
	`r2_object_key` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "gallery_images_alt_text_present" CHECK(length("gallery_images"."alt_text") > 0),
	CONSTRAINT "gallery_images_object_key_present" CHECK(length("gallery_images"."r2_object_key") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_images_r2_object_key_unique` ON `gallery_images` (`r2_object_key`);--> statement-breakpoint
CREATE INDEX `gallery_images_published_order_idx` ON `gallery_images` (`is_published`,`display_order`);--> statement-breakpoint
-- Hand-edited after drizzle-kit generate:
-- * The appointments copy omits management_token_hash and idempotency_key (absent from the old
--   table). No bookings exist before this migration; if any did, NOT NULL makes it fail loudly.
-- * D1 ignores PRAGMA foreign_keys inside migrations; defer_foreign_keys is its equivalent.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_reference` text NOT NULL,
	`management_token_hash` text NOT NULL,
	`idempotency_key` text,
	`customer_name` text NOT NULL,
	`customer_email` text,
	`customer_phone` text NOT NULL,
	`staff_id` text NOT NULL,
	`service_id` text NOT NULL,
	`service_name_snapshot` text NOT NULL,
	`duration_minutes_snapshot` integer NOT NULL,
	`price_minor_snapshot` integer NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`location` text NOT NULL,
	`address` text,
	`travel_fee_minor` integer,
	`customer_notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "appointments_reference_present" CHECK(length("__new_appointments"."booking_reference") > 0),
	CONSTRAINT "appointments_token_hash_present" CHECK(length("__new_appointments"."management_token_hash") > 0),
	CONSTRAINT "appointments_customer_name_present" CHECK(length("__new_appointments"."customer_name") > 0),
	CONSTRAINT "appointments_customer_phone_present" CHECK(length("__new_appointments"."customer_phone") > 0),
	CONSTRAINT "appointments_status_valid" CHECK("__new_appointments"."status" IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
	CONSTRAINT "appointments_location_valid" CHECK("__new_appointments"."location" IN ('studio', 'house_call')),
	CONSTRAINT "appointments_duration_positive" CHECK("__new_appointments"."duration_minutes_snapshot" > 0),
	CONSTRAINT "appointments_price_non_negative" CHECK("__new_appointments"."price_minor_snapshot" >= 0),
	CONSTRAINT "appointments_currency_format" CHECK(length("__new_appointments"."currency") = 3),
	CONSTRAINT "appointments_start_at" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "__new_appointments"."start_at") IS "__new_appointments"."start_at"),
	CONSTRAINT "appointments_end_at" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "__new_appointments"."end_at") IS "__new_appointments"."end_at"),
	CONSTRAINT "appointments_range" CHECK("__new_appointments"."end_at" > "__new_appointments"."start_at"),
	CONSTRAINT "appointments_travel_fee_non_negative" CHECK("__new_appointments"."travel_fee_minor" IS NULL OR "__new_appointments"."travel_fee_minor" >= 0),
	CONSTRAINT "appointments_house_call_address" CHECK("__new_appointments"."location" <> 'house_call' OR length(trim(coalesce("__new_appointments"."address", ''))) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "booking_reference", "customer_name", "customer_email", "customer_phone", "staff_id", "service_id", "service_name_snapshot", "duration_minutes_snapshot", "price_minor_snapshot", "currency", "start_at", "end_at", "status", "location", "address", "travel_fee_minor", "customer_notes", "created_at", "updated_at") SELECT "id", "booking_reference", "customer_name", "customer_email", "customer_phone", "staff_id", "service_id", "service_name_snapshot", "duration_minutes_snapshot", "price_minor_snapshot", "currency", "start_at", "end_at", "status", "location", "address", "travel_fee_minor", "customer_notes", "created_at", "updated_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_booking_reference_unique` ON `appointments` (`booking_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_idempotency_key_unique` ON `appointments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `appointments_staff_start_idx` ON `appointments` (`staff_id`,`start_at`);--> statement-breakpoint
ALTER TABLE `services` ADD `image_key` text;--> statement-breakpoint
CREATE TABLE `__new_appointment_slot_reservations` (
	`staff_id` text NOT NULL,
	`slot_start_at` text NOT NULL,
	`appointment_id` text NOT NULL,
	PRIMARY KEY(`staff_id`, `slot_start_at`),
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointment_slot_reservations_slot_start_at" CHECK(strftime('%Y-%m-%dT%H:%M:00.000Z', "__new_appointment_slot_reservations"."slot_start_at") IS "__new_appointment_slot_reservations"."slot_start_at" AND strftime('%M', "__new_appointment_slot_reservations"."slot_start_at") IN ('00', '15', '30', '45'))
);
--> statement-breakpoint
INSERT INTO `__new_appointment_slot_reservations`("staff_id", "slot_start_at", "appointment_id") SELECT "staff_id", "slot_start_at", "appointment_id" FROM `appointment_slot_reservations`;--> statement-breakpoint
DROP TABLE `appointment_slot_reservations`;--> statement-breakpoint
ALTER TABLE `__new_appointment_slot_reservations` RENAME TO `appointment_slot_reservations`;--> statement-breakpoint
CREATE INDEX `appointment_slot_reservations_appointment_idx` ON `appointment_slot_reservations` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `__new_staff_time_off` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "staff_time_off_start_at" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "__new_staff_time_off"."start_at") IS "__new_staff_time_off"."start_at"),
	CONSTRAINT "staff_time_off_end_at" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "__new_staff_time_off"."end_at") IS "__new_staff_time_off"."end_at"),
	CONSTRAINT "staff_time_off_range" CHECK("__new_staff_time_off"."end_at" > "__new_staff_time_off"."start_at")
);
--> statement-breakpoint
INSERT INTO `__new_staff_time_off`("id", "staff_id", "start_at", "end_at", "reason", "created_at") SELECT "id", "staff_id", "start_at", "end_at", "reason", "created_at" FROM `staff_time_off`;--> statement-breakpoint
DROP TABLE `staff_time_off`;--> statement-breakpoint
ALTER TABLE `__new_staff_time_off` RENAME TO `staff_time_off`;--> statement-breakpoint
CREATE INDEX `staff_time_off_staff_start_idx` ON `staff_time_off` (`staff_id`,`start_at`);