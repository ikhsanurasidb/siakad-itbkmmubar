CREATE TABLE `email_change_requests` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`new_email` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`user_id` text NOT NULL,
	`verification_token_hash` text NOT NULL,
	`verified_at` integer,
	CONSTRAINT `fk_email_change_requests_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `email_change_requests_user_status_idx` ON `email_change_requests` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `email_change_requests_token_hash_idx` ON `email_change_requests` (`verification_token_hash`);