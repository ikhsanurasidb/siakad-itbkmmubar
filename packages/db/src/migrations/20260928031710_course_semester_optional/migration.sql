PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_courses` (
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`credits` integer NOT NULL,
	`default_semester` integer,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_courses_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "courses_credits_range_ck" CHECK("credits" >= 1 AND "credits" <= 6),
	CONSTRAINT "courses_semester_range_ck" CHECK("default_semester" IS NULL OR ("default_semester" >= 1 AND "default_semester" <= 14))
);
--> statement-breakpoint
INSERT INTO `__new_courses`(`code`, `created_at`, `credits`, `default_semester`, `id`, `name`, `status`, `study_program_id`, `updated_at`) SELECT `code`, `created_at`, `credits`, `default_semester`, `id`, `name`, `status`, `study_program_id`, `updated_at` FROM `courses`;--> statement-breakpoint
DROP TABLE `courses`;--> statement-breakpoint
ALTER TABLE `__new_courses` RENAME TO `courses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_uq` ON `courses` (`code`);--> statement-breakpoint
CREATE INDEX `courses_program_status_idx` ON `courses` (`study_program_id`,`status`);