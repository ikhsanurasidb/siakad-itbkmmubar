CREATE TABLE `study_plan_generation_jobs` (
	`academic_period_id` text NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`error_count` integer DEFAULT 0 NOT NULL,
	`failure_details` text,
	`id` text PRIMARY KEY,
	`idempotency_key` text,
	`mode` text DEFAULT 'PACKAGE' NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_study_plan_generation_jobs_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_study_plan_generation_jobs_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `study_plan_histories` (
	`action` text NOT NULL,
	`actor_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`from_status` text,
	`id` text PRIMARY KEY,
	`metadata` text,
	`reason` text,
	`study_plan_id` text NOT NULL,
	`to_status` text,
	CONSTRAINT `fk_study_plan_histories_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_study_plan_histories_study_plan_id_study_plans_id_fk` FOREIGN KEY (`study_plan_id`) REFERENCES `study_plans`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `study_plan_items` (
	`course_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`credits` integer NOT NULL,
	`curriculum_course_id` text,
	`id` text PRIMARY KEY,
	`semester` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`source` text DEFAULT 'PACKAGE' NOT NULL,
	`study_plan_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_study_plan_items_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_study_plan_items_curriculum_course_id_curriculum_courses_id_fk` FOREIGN KEY (`curriculum_course_id`) REFERENCES `curriculum_courses`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_study_plan_items_study_plan_id_study_plans_id_fk` FOREIGN KEY (`study_plan_id`) REFERENCES `study_plans`(`id`) ON DELETE CASCADE,
	CONSTRAINT "study_plan_items_semester_range_ck" CHECK("semester" >= 1 AND "semester" <= 8),
	CONSTRAINT "study_plan_items_credits_positive_ck" CHECK("credits" >= 1 AND "credits" <= 6)
);
--> statement-breakpoint
CREATE TABLE `study_plans` (
	`academic_period_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`curriculum_id` text,
	`finalized_at` integer,
	`finalized_by` text,
	`id` text PRIMARY KEY,
	`mode` text DEFAULT 'PACKAGE' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`student_id` text NOT NULL,
	`total_credits` integer DEFAULT 0 NOT NULL,
	`total_courses` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_study_plans_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_study_plans_curriculum_id_curricula_id_fk` FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_study_plans_finalized_by_user_id_fk` FOREIGN KEY (`finalized_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_study_plans_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "study_plans_total_credits_non_negative_ck" CHECK("total_credits" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_plan_generation_jobs_period_key_uq` ON `study_plan_generation_jobs` (`academic_period_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `study_plan_generation_jobs_period_created_idx` ON `study_plan_generation_jobs` (`academic_period_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `study_plan_generation_jobs_status_idx` ON `study_plan_generation_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `study_plan_histories_plan_created_at_idx` ON `study_plan_histories` (`study_plan_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_plan_items_plan_course_uq` ON `study_plan_items` (`study_plan_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `study_plan_items_plan_semester_idx` ON `study_plan_items` (`study_plan_id`,`semester`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_plans_student_period_uq` ON `study_plans` (`student_id`,`academic_period_id`);--> statement-breakpoint
CREATE INDEX `study_plans_period_status_idx` ON `study_plans` (`academic_period_id`,`status`);--> statement-breakpoint
CREATE INDEX `study_plans_student_updated_at_idx` ON `study_plans` (`student_id`,`updated_at`);