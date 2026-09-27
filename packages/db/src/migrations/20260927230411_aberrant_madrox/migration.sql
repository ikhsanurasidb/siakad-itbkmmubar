CREATE TABLE `account` (
	`access_token` text,
	`access_token_expires_at` integer,
	`account_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`id_token` text,
	`password` text,
	`provider_id` text NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`ip_address` text,
	`token` text NOT NULL UNIQUE,
	`updated_at` integer NOT NULL,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY,
	`image` text,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`actor_user_id` text,
	`after_state` text,
	`before_state` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`entity_id` text,
	`entity_type` text,
	`metadata` text,
	`request_id` text,
	CONSTRAINT `fk_audit_logs_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`completed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`cursor` text,
	`error_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY,
	`idempotency_key` text,
	`job_type` text NOT NULL,
	`lease_expires_at` integer,
	`lease_owner` text,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`total_count` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_objects` (
	`checksum` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`deleted_at` integer,
	`declared_mime` text,
	`id` text PRIMARY KEY,
	`mime_type` text NOT NULL,
	`object_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT `fk_file_objects_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`actor_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_reference` text,
	`scope` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT `fk_idempotency_keys_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`read_at` integer,
	`route` text,
	`status` text DEFAULT 'UNREAD' NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_notifications_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`aggregate_id` text,
	`aggregate_type` text,
	`available_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`event_type` text NOT NULL,
	`id` text PRIMARY KEY,
	`last_error` text,
	`payload` text NOT NULL,
	`processed_at` integer,
	`status` text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_created_at_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `background_jobs_status_lease_idx` ON `background_jobs` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `background_jobs_type_created_at_idx` ON `background_jobs` (`job_type`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `file_objects_object_key_uq` ON `file_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `file_objects_owner_idx` ON `file_objects` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `file_objects_status_idx` ON `file_objects` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_keys_scope_key_uq` ON `idempotency_keys` (`scope`,`key`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_expires_at_idx` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_status_created_at_idx` ON `notifications` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbox_events_status_available_at_idx` ON `outbox_events` (`status`,`available_at`);