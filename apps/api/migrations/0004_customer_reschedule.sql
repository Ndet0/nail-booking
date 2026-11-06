-- Hand-edited after drizzle-kit generate:
-- * rescheduled_at is new, so the copy inserts NULL instead of reading it from the old table.
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
	`rescheduled_at` text,
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
	CONSTRAINT "appointments_house_call_address" CHECK("__new_appointments"."location" <> 'house_call' OR length(trim(coalesce("__new_appointments"."address", ''))) > 0),
	CONSTRAINT "appointments_rescheduled_at" CHECK("__new_appointments"."rescheduled_at" IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', "__new_appointments"."rescheduled_at") IS "__new_appointments"."rescheduled_at")
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "booking_reference", "management_token_hash", "idempotency_key", "customer_name", "customer_email", "customer_phone", "staff_id", "service_id", "service_name_snapshot", "duration_minutes_snapshot", "price_minor_snapshot", "currency", "start_at", "end_at", "status", "location", "address", "travel_fee_minor", "customer_notes", "rescheduled_at", "created_at", "updated_at") SELECT "id", "booking_reference", "management_token_hash", "idempotency_key", "customer_name", "customer_email", "customer_phone", "staff_id", "service_id", "service_name_snapshot", "duration_minutes_snapshot", "price_minor_snapshot", "currency", "start_at", "end_at", "status", "location", "address", "travel_fee_minor", "customer_notes", NULL, "created_at", "updated_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_booking_reference_unique` ON `appointments` (`booking_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_idempotency_key_unique` ON `appointments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `appointments_staff_start_idx` ON `appointments` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_start_idx` ON `appointments` (`start_at`);