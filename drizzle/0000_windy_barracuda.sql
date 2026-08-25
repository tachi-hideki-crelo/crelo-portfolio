CREATE TABLE `contact_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_requests_fingerprint_idx` ON `contact_requests` (`fingerprint_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `contact_requests_token_idx` ON `contact_requests` (`token_hash`);--> statement-breakpoint
CREATE INDEX `contact_requests_ip_created_idx` ON `contact_requests` (`ip_hash`,`created_at`);