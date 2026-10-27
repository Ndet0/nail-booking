CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_minor` integer NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "services_duration_positive" CHECK("services"."duration_minutes" > 0),
	CONSTRAINT "services_price_non_negative" CHECK("services"."price_minor" >= 0),
	CONSTRAINT "services_category_valid" CHECK("services"."category" IN ('nails', 'makeup')),
	CONSTRAINT "services_currency_format" CHECK(length("services"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE INDEX `services_active_order_idx` ON `services` (`is_active`,`display_order`);