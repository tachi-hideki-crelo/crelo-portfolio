DROP INDEX `contact_requests_fingerprint_idx`;--> statement-breakpoint
CREATE INDEX `contact_requests_fingerprint_idx` ON `contact_requests` (`fingerprint_hash`);