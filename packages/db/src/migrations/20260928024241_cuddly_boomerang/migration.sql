CREATE TABLE `course_assessment_defaults` (
	`component_code` text NOT NULL,
	`course_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`weight` integer NOT NULL,
	CONSTRAINT `fk_course_assessment_defaults_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
	CONSTRAINT "course_assessment_defaults_weight_range_ck" CHECK("weight" >= 0 AND "weight" <= 100)
);
--> statement-breakpoint
CREATE TABLE `curricula` (
	`activated_at` integer,
	`activated_by` text,
	`cohort_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_curricula_activated_by_user_id_fk` FOREIGN KEY (`activated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_curricula_cohort_id_cohorts_id_fk` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_curricula_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_curricula_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `curriculum_assessment_overrides` (
	`component_code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`curriculum_course_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`weight` integer NOT NULL,
	CONSTRAINT `fk_curriculum_assessment_overrides_curriculum_course_id_curriculum_courses_id_fk` FOREIGN KEY (`curriculum_course_id`) REFERENCES `curriculum_courses`(`id`) ON DELETE CASCADE,
	CONSTRAINT "curriculum_assessment_overrides_weight_range_ck" CHECK("weight" >= 0 AND "weight" <= 100)
);
--> statement-breakpoint
CREATE TABLE `curriculum_courses` (
	`course_id` text NOT NULL,
	`course_type` text DEFAULT 'REQUIRED' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`credits` integer NOT NULL,
	`curriculum_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`semester` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_curriculum_courses_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_curriculum_courses_curriculum_id_curricula_id_fk` FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON DELETE CASCADE,
	CONSTRAINT "curriculum_courses_semester_range_ck" CHECK("semester" >= 1 AND "semester" <= 8),
	CONSTRAINT "curriculum_courses_credits_positive_ck" CHECK("credits" >= 1 AND "credits" <= 6)
);
--> statement-breakpoint
CREATE TABLE `curriculum_documents` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`curriculum_id` text NOT NULL,
	`document_type` text DEFAULT 'CURRICULUM' NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`is_current` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_curriculum_documents_curriculum_id_curricula_id_fk` FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_curriculum_documents_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_assessment_defaults_course_component_uq` ON `course_assessment_defaults` (`course_id`,`component_code`);--> statement-breakpoint
CREATE INDEX `course_assessment_defaults_course_idx` ON `course_assessment_defaults` (`course_id`);--> statement-breakpoint
CREATE INDEX `curricula_program_cohort_status_idx` ON `curricula` (`study_program_id`,`cohort_id`,`status`);--> statement-breakpoint
CREATE INDEX `curricula_status_updated_at_idx` ON `curricula` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `curriculum_assessment_overrides_course_component_uq` ON `curriculum_assessment_overrides` (`curriculum_course_id`,`component_code`);--> statement-breakpoint
CREATE INDEX `curriculum_assessment_overrides_course_idx` ON `curriculum_assessment_overrides` (`curriculum_course_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `curriculum_courses_curriculum_course_semester_uq` ON `curriculum_courses` (`curriculum_id`,`course_id`,`semester`);--> statement-breakpoint
CREATE INDEX `curriculum_courses_curriculum_semester_idx` ON `curriculum_courses` (`curriculum_id`,`semester`,`sort_order`);--> statement-breakpoint
CREATE INDEX `curriculum_documents_curriculum_current_idx` ON `curriculum_documents` (`curriculum_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `curriculum_documents_file_idx` ON `curriculum_documents` (`file_object_id`);