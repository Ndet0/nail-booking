CREATE TABLE `booking_write_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "booking_write_attempts_ip_hash" CHECK(length("booking_write_attempts"."ip_hash") = 64),
	CONSTRAINT "booking_write_attempts_kind_valid" CHECK("booking_write_attempts"."kind" IN ('create', 'cancel', 'reschedule')),
	CONSTRAINT "booking_write_attempts_created_at" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "booking_write_attempts"."created_at") IS "booking_write_attempts"."created_at")
);
--> statement-breakpoint
CREATE INDEX `booking_write_attempts_kind_ip_created_idx` ON `booking_write_attempts` (`kind`,`ip_hash`,`created_at`);