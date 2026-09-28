CREATE TABLE `attendance_adjustments` (
	`actor_user_id` text,
	`attendance_record_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`from_status` text NOT NULL,
	`id` text PRIMARY KEY,
	`reason` text NOT NULL,
	`to_status` text NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_attendance_adjustments_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_attendance_adjustments_attendance_record_id_attendance_records_id_fk` FOREIGN KEY (`attendance_record_id`) REFERENCES `attendance_records`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `attendance_capture_attempts` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`modality` text NOT NULL,
	`nonce_hash` text NOT NULL,
	`participant_id` text NOT NULL,
	`participant_type` text NOT NULL,
	`session_id` text NOT NULL,
	`used_at` integer,
	CONSTRAINT `fk_attendance_capture_attempts_session_id_attendance_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `attendance_evidences` (
	`accuracy_meters` real,
	`attendance_record_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`capture_attempt_id` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`dimension_height` integer NOT NULL,
	`dimension_width` integer NOT NULL,
	`distance_meters` real,
	`evidence_type` text NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`latitude` real,
	`longitude` real,
	`mime_type` text NOT NULL,
	`policy_radius_meters` real NOT NULL,
	`reference_latitude` real,
	`reference_longitude` real,
	`size_bytes` integer NOT NULL,
	CONSTRAINT `fk_attendance_evidences_attendance_record_id_attendance_records_id_fk` FOREIGN KEY (`attendance_record_id`) REFERENCES `attendance_records`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attendance_evidences_capture_attempt_id_attendance_capture_attempts_id_fk` FOREIGN KEY (`capture_attempt_id`) REFERENCES `attendance_capture_attempts`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_attendance_evidences_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "attendance_evidences_coordinate_pair_ck" CHECK(("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `attendance_generation_jobs` (
	`completed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`cursor` text,
	`error_count` integer DEFAULT 0 NOT NULL,
	`error_details` text,
	`id` text PRIMARY KEY,
	`idempotency_key` text NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`session_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_attendance_generation_jobs_session_id_attendance_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`note` text,
	`participant_id` text NOT NULL,
	`participant_type` text NOT NULL,
	`session_id` text NOT NULL,
	`status` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT `fk_attendance_records_session_id_attendance_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `attendance_requests` (
	`attendance_record_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	`decision_reason` text,
	`id` text PRIMARY KEY,
	`requested_status` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT `fk_attendance_requests_attendance_record_id_attendance_records_id_fk` FOREIGN KEY (`attendance_record_id`) REFERENCES `attendance_records`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attendance_requests_decided_by_user_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `attendance_review_logs` (
	`actor_user_id` text,
	`attendance_request_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`decision` text NOT NULL,
	`id` text PRIMARY KEY,
	`reason` text,
	CONSTRAINT `fk_attendance_review_logs_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_attendance_review_logs_attendance_request_id_attendance_requests_id_fk` FOREIGN KEY (`attendance_request_id`) REFERENCES `attendance_requests`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`class_section_id` text NOT NULL,
	`close_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`meeting_id` text NOT NULL,
	`modality` text NOT NULL,
	`open_at` integer NOT NULL,
	`policy_radius_meters` real NOT NULL,
	`policy_version` text NOT NULL,
	`schedule_revision_id` text,
	`start_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_attendance_sessions_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_attendance_sessions_meeting_id_class_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `attendance_adjustments_record_idx` ON `attendance_adjustments` (`attendance_record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_capture_attempts_nonce_uq` ON `attendance_capture_attempts` (`nonce_hash`);--> statement-breakpoint
CREATE INDEX `attendance_capture_attempts_participant_idx` ON `attendance_capture_attempts` (`participant_type`,`participant_id`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_evidences_record_uq` ON `attendance_evidences` (`attendance_record_id`);--> statement-breakpoint
CREATE INDEX `attendance_evidences_file_idx` ON `attendance_evidences` (`file_object_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_generation_jobs_session_key_uq` ON `attendance_generation_jobs` (`session_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `attendance_generation_jobs_status_idx` ON `attendance_generation_jobs` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_records_participant_session_uq` ON `attendance_records` (`session_id`,`participant_type`,`participant_id`);--> statement-breakpoint
CREATE INDEX `attendance_records_session_status_idx` ON `attendance_records` (`session_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_requests_record_uq` ON `attendance_requests` (`attendance_record_id`);--> statement-breakpoint
CREATE INDEX `attendance_requests_status_created_idx` ON `attendance_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `attendance_review_logs_request_idx` ON `attendance_review_logs` (`attendance_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_sessions_meeting_uq` ON `attendance_sessions` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `attendance_sessions_window_idx` ON `attendance_sessions` (`open_at`,`close_at`);