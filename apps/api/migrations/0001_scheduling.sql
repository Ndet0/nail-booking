CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_services` (
	`staff_id` text NOT NULL,
	`service_id` text NOT NULL,
	PRIMARY KEY(`staff_id`, `service_id`),
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff_working_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "staff_working_hours_weekday" CHECK("staff_working_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "staff_working_hours_start_time" CHECK("staff_working_hours"."start_time" GLOB '[0-1][0-9]:[0-5][0-9]' OR "staff_working_hours"."start_time" GLOB '2[0-3]:[0-5][0-9]'),
	CONSTRAINT "staff_working_hours_end_time" CHECK("staff_working_hours"."end_time" GLOB '[0-1][0-9]:[0-5][0-9]' OR "staff_working_hours"."end_time" GLOB '2[0-3]:[0-5][0-9]'),
	CONSTRAINT "staff_working_hours_range" CHECK("staff_working_hours"."end_time" > "staff_working_hours"."start_time"),
	CONSTRAINT "staff_working_hours_effective_from" CHECK("staff_working_hours"."effective_from" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "staff_working_hours_effective_until" CHECK("staff_working_hours"."effective_until" IS NULL OR "staff_working_hours"."effective_until" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "staff_working_hours_effective_range" CHECK("staff_working_hours"."effective_until" IS NULL OR "staff_working_hours"."effective_until" >= "staff_working_hours"."effective_from")
);
--> statement-breakpoint
CREATE INDEX `staff_working_hours_staff_weekday_idx` ON `staff_working_hours` (`staff_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `staff_time_off` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "staff_time_off_range" CHECK("staff_time_off"."end_at" > "staff_time_off"."start_at")
);
--> statement-breakpoint
CREATE INDEX `staff_time_off_staff_start_idx` ON `staff_time_off` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_reference` text NOT NULL,
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
	CONSTRAINT "appointments_reference_present" CHECK(length("appointments"."booking_reference") > 0),
	CONSTRAINT "appointments_customer_name_present" CHECK(length("appointments"."customer_name") > 0),
	CONSTRAINT "appointments_customer_phone_present" CHECK(length("appointments"."customer_phone") > 0),
	CONSTRAINT "appointments_status_valid" CHECK("appointments"."status" IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
	CONSTRAINT "appointments_location_valid" CHECK("appointments"."location" IN ('studio', 'house_call')),
	CONSTRAINT "appointments_duration_positive" CHECK("appointments"."duration_minutes_snapshot" > 0),
	CONSTRAINT "appointments_price_non_negative" CHECK("appointments"."price_minor_snapshot" >= 0),
	CONSTRAINT "appointments_currency_format" CHECK(length("appointments"."currency") = 3),
	CONSTRAINT "appointments_range" CHECK("appointments"."end_at" > "appointments"."start_at"),
	CONSTRAINT "appointments_travel_fee_non_negative" CHECK("appointments"."travel_fee_minor" IS NULL OR "appointments"."travel_fee_minor" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_booking_reference_unique` ON `appointments` (`booking_reference`);--> statement-breakpoint
CREATE INDEX `appointments_staff_start_idx` ON `appointments` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `appointment_slot_reservations` (
	`staff_id` text NOT NULL,
	`slot_start_at` text NOT NULL,
	`appointment_id` text NOT NULL,
	PRIMARY KEY(`staff_id`, `slot_start_at`),
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appointment_slot_reservations_appointment_idx` ON `appointment_slot_reservations` (`appointment_id`);
