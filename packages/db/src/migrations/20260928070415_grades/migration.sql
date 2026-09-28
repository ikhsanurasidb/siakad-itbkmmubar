CREATE TABLE `class_grade_components` (
	`class_section_id` text NOT NULL,
	`component_code` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	`weight` integer NOT NULL,
	CONSTRAINT `fk_class_grade_components_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT "class_grade_components_weight_ck" CHECK("weight" >= 0 AND "weight" <= 100)
);
--> statement-breakpoint
CREATE TABLE `final_grade_snapshots` (
	`attempt` integer DEFAULT 1 NOT NULL,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`grade_code` text NOT NULL,
	`grade_point_hundredths` integer NOT NULL,
	`id` text PRIMARY KEY,
	`policy_version` text NOT NULL,
	`raw_score_hundredths` integer NOT NULL,
	`rounded_score_hundredths` integer NOT NULL,
	`scale_version_id` text,
	`student_id` text NOT NULL,
	`taken_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_final_grade_snapshots_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_final_grade_snapshots_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "final_grade_snapshots_score_ck" CHECK("rounded_score_hundredths" >= 0 AND "rounded_score_hundredths" <= 10000)
);
--> statement-breakpoint
CREATE TABLE `grade_adjustments` (
	`actor_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`final_grade_snapshot_id` text,
	`id` text PRIMARY KEY,
	`new_value` text NOT NULL,
	`old_value` text,
	`reason` text NOT NULL,
	CONSTRAINT `fk_grade_adjustments_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_grade_adjustments_final_grade_snapshot_id_final_grade_snapshots_id_fk` FOREIGN KEY (`final_grade_snapshot_id`) REFERENCES `final_grade_snapshots`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `grade_publications` (
	`academic_period_id` text NOT NULL,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`published_at` integer,
	`published_by` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_grade_publications_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_grade_publications_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_grade_publications_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `grade_submission_batches` (
	`actor_user_id` text,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`submitted_at` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_grade_submission_batches_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_grade_submission_batches_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `student_component_scores` (
	`class_grade_component_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`score_hundredths` integer NOT NULL,
	`student_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_student_component_scores_class_grade_component_id_class_grade_components_id_fk` FOREIGN KEY (`class_grade_component_id`) REFERENCES `class_grade_components`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_student_component_scores_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "student_component_scores_range_ck" CHECK("score_hundredths" >= 0 AND "score_hundredths" <= 10000)
);
--> statement-breakpoint
CREATE TABLE `study_result_snapshots` (
	`academic_period_id` text NOT NULL,
	`built_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`counted_credits` integer NOT NULL,
	`counted_quality_points_hundredths` integer NOT NULL,
	`id` text PRIMARY KEY,
	`ipk_hundredths` integer NOT NULL,
	`ips_hundredths` integer NOT NULL,
	`policy_version` text NOT NULL,
	`retake_policy` text NOT NULL,
	`student_id` text NOT NULL,
	CONSTRAINT `fk_study_result_snapshots_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_study_result_snapshots_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `transcript_entries` (
	`academic_period_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`course_id` text NOT NULL,
	`credits` integer NOT NULL,
	`final_grade_snapshot_id` text NOT NULL,
	`grade_code` text NOT NULL,
	`grade_point_hundredths` integer NOT NULL,
	`id` text PRIMARY KEY,
	`student_id` text NOT NULL,
	`study_result_snapshot_id` text NOT NULL,
	CONSTRAINT `fk_transcript_entries_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_transcript_entries_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_transcript_entries_final_grade_snapshot_id_final_grade_snapshots_id_fk` FOREIGN KEY (`final_grade_snapshot_id`) REFERENCES `final_grade_snapshots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_transcript_entries_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_transcript_entries_study_result_snapshot_id_study_result_snapshots_id_fk` FOREIGN KEY (`study_result_snapshot_id`) REFERENCES `study_result_snapshots`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_grade_components_class_code_uq` ON `class_grade_components` (`class_section_id`,`component_code`);--> statement-breakpoint
CREATE INDEX `class_grade_components_class_idx` ON `class_grade_components` (`class_section_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `final_grade_snapshots_class_student_attempt_uq` ON `final_grade_snapshots` (`class_section_id`,`student_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `final_grade_snapshots_student_taken_idx` ON `final_grade_snapshots` (`student_id`,`taken_at`);--> statement-breakpoint
CREATE INDEX `grade_adjustments_snapshot_created_idx` ON `grade_adjustments` (`final_grade_snapshot_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `grade_publications_class_period_uq` ON `grade_publications` (`class_section_id`,`academic_period_id`);--> statement-breakpoint
CREATE INDEX `grade_publications_period_status_idx` ON `grade_publications` (`academic_period_id`,`status`);--> statement-breakpoint
CREATE INDEX `grade_submission_batches_class_status_idx` ON `grade_submission_batches` (`class_section_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_component_scores_student_component_uq` ON `student_component_scores` (`student_id`,`class_grade_component_id`);--> statement-breakpoint
CREATE INDEX `student_component_scores_component_idx` ON `student_component_scores` (`class_grade_component_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_result_snapshots_student_period_uq` ON `study_result_snapshots` (`student_id`,`academic_period_id`);--> statement-breakpoint
CREATE INDEX `study_result_snapshots_student_idx` ON `study_result_snapshots` (`student_id`,`built_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `transcript_entries_result_course_uq` ON `transcript_entries` (`study_result_snapshot_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `transcript_entries_student_period_idx` ON `transcript_entries` (`student_id`,`academic_period_id`);