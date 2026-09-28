CREATE TABLE `academic_periods` (
	`academic_year_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_date` integer NOT NULL,
	`id` text PRIMARY KEY,
	`start_date` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`term` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_academic_periods_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "academic_periods_date_order_ck" CHECK("end_date" >= "start_date")
);
--> statement-breakpoint
CREATE TABLE `academic_years` (
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_year` integer NOT NULL,
	`id` text PRIMARY KEY,
	`start_year` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "academic_years_order_ck" CHECK("end_year" = "start_year" + 1)
);
--> statement-breakpoint
CREATE TABLE `cohorts` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`entry_year` integer NOT NULL,
	`id` text PRIMARY KEY,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_cohorts_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`default_semester` integer NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`credits` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_courses_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "courses_credits_range_ck" CHECK("credits" >= 1 AND "credits" <= 6),
	CONSTRAINT "courses_semester_range_ck" CHECK("default_semester" >= 1 AND "default_semester" <= 14)
);
--> statement-breakpoint
CREATE TABLE `identifier_usages` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`identifier_type` text NOT NULL,
	`locked_at` integer,
	`usage_type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`checksum` text NOT NULL,
	`committed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	`entity_type` text NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`file_object_id` text,
	`filename` text NOT NULL,
	`id` text PRIMARY KEY,
	`processed_rows` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'UPLOADED' NOT NULL,
	`template_version` text NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`valid_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`invalid_count` integer DEFAULT 0 NOT NULL,
	`checkpoint_row` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_import_jobs_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`commit_error` text,
	`commit_status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`entity_id` text,
	`errors` text,
	`id` text PRIMARY KEY,
	`job_id` text NOT NULL,
	`normalized_data` text,
	`raw_data` text NOT NULL,
	`row_number` integer NOT NULL,
	`status` text NOT NULL,
	CONSTRAINT `fk_import_rows_job_id_import_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `import_jobs`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `lecturers` (
	`academic_status` text DEFAULT 'ACTIVE' NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`dsn` text,
	`email` text,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`nidn` text,
	`nuptk` text,
	`phone` text,
	`provisioning_status` text DEFAULT 'PENDING_PROVISIONING' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`capacity` integer NOT NULL,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "rooms_capacity_positive_ck" CHECK("capacity" > 0),
	CONSTRAINT "rooms_latitude_range_ck" CHECK("latitude" >= -90 AND "latitude" <= 90),
	CONSTRAINT "rooms_longitude_range_ck" CHECK("longitude" >= -180 AND "longitude" <= 180)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`academic_status` text DEFAULT 'ACTIVE' NOT NULL,
	`archived_at` integer,
	`cohort_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`email` text,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`nim` text NOT NULL,
	`phone` text,
	`provisioning_status` text DEFAULT 'PENDING_PROVISIONING' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_students_cohort_id_cohorts_id_fk` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_students_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `study_programs` (
	`archived_at` integer,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`degree` text NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_periods_year_term_uq` ON `academic_periods` (`academic_year_id`,`term`);--> statement-breakpoint
CREATE INDEX `academic_periods_status_date_idx` ON `academic_periods` (`status`,`start_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `academic_years_code_uq` ON `academic_years` (`code`);--> statement-breakpoint
CREATE INDEX `academic_years_status_start_year_idx` ON `academic_years` (`status`,`start_year`);--> statement-breakpoint
CREATE UNIQUE INDEX `cohorts_program_year_uq` ON `cohorts` (`study_program_id`,`entry_year`);--> statement-breakpoint
CREATE INDEX `cohorts_status_year_idx` ON `cohorts` (`status`,`entry_year`);--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_uq` ON `courses` (`code`);--> statement-breakpoint
CREATE INDEX `courses_program_status_idx` ON `courses` (`study_program_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `identifier_usages_identifier_uq` ON `identifier_usages` (`identifier_type`,`identifier`);--> statement-breakpoint
CREATE INDEX `identifier_usages_entity_idx` ON `identifier_usages` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `identifier_usages_locked_idx` ON `identifier_usages` (`identifier_type`,`locked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_jobs_checksum_entity_uq` ON `import_jobs` (`checksum`,`entity_type`);--> statement-breakpoint
CREATE INDEX `import_jobs_created_by_created_at_idx` ON `import_jobs` (`created_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_rows_job_row_uq` ON `import_rows` (`job_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `import_rows_job_status_idx` ON `import_rows` (`job_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `lecturers_dsn_uq` ON `lecturers` (`dsn`);--> statement-breakpoint
CREATE UNIQUE INDEX `lecturers_nidn_uq` ON `lecturers` (`nidn`);--> statement-breakpoint
CREATE UNIQUE INDEX `lecturers_nuptk_uq` ON `lecturers` (`nuptk`);--> statement-breakpoint
CREATE INDEX `lecturers_status_name_idx` ON `lecturers` (`status`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_uq` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `rooms_status_name_idx` ON `rooms` (`status`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_nim_uq` ON `students` (`nim`);--> statement-breakpoint
CREATE INDEX `students_program_cohort_status_idx` ON `students` (`study_program_id`,`cohort_id`,`status`);--> statement-breakpoint
CREATE INDEX `students_name_idx` ON `students` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_programs_code_uq` ON `study_programs` (`code`);--> statement-breakpoint
CREATE INDEX `study_programs_status_name_idx` ON `study_programs` (`status`,`name`);