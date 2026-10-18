CREATE TABLE `contact_turnstile_rate_limits` (
	`ip_hash` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_turnstile_rate_limits_expires_idx` ON `contact_turnstile_rate_limits` (`expires_at`);