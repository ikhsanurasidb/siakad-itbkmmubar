CREATE TABLE `class_enrollments` (
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`student_id` text NOT NULL,
	`study_plan_id` text NOT NULL,
	`study_plan_item_id` text NOT NULL,
	CONSTRAINT `fk_class_enrollments_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_class_enrollments_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_class_enrollments_study_plan_id_study_plans_id_fk` FOREIGN KEY (`study_plan_id`) REFERENCES `study_plans`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_class_enrollments_study_plan_item_id_study_plan_items_id_fk` FOREIGN KEY (`study_plan_item_id`) REFERENCES `study_plan_items`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `class_mapping_jobs` (
	`academic_period_id` text NOT NULL,
	`checkpoint_group_key` text,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`error_count` integer DEFAULT 0 NOT NULL,
	`failure_details` text,
	`id` text PRIMARY KEY,
	`idempotency_key` text NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`study_program_id` text,
	`total_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_class_mapping_jobs_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_class_mapping_jobs_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_class_mapping_jobs_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `class_meetings` (
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`instructions` text,
	`modality` text DEFAULT 'OFFLINE' NOT NULL,
	`online_url` text,
	`room_id` text,
	`sequence` integer NOT NULL,
	`start_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT `fk_class_meetings_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_class_meetings_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "class_meetings_sequence_positive_ck" CHECK("sequence" > 0),
	CONSTRAINT "class_meetings_time_order_ck" CHECK("end_at" > "start_at")
);
--> statement-breakpoint
CREATE TABLE `class_sections` (
	`academic_period_id` text NOT NULL,
	`capacity` integer NOT NULL,
	`code` text NOT NULL,
	`course_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`mapping_job_id` text,
	`policy_lead_days` integer DEFAULT 7 NOT NULL,
	`policy_max_online_meetings` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`study_program_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_class_sections_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_class_sections_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_class_sections_mapping_job_id_class_mapping_jobs_id_fk` FOREIGN KEY (`mapping_job_id`) REFERENCES `class_mapping_jobs`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_class_sections_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "class_sections_capacity_positive_ck" CHECK("capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE `exam_schedules` (
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_at` integer NOT NULL,
	`exam_type` text NOT NULL,
	`id` text PRIMARY KEY,
	`room_id` text,
	`schedule_draft_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_exam_schedules_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_exam_schedules_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_exam_schedules_schedule_draft_id_schedule_drafts_id_fk` FOREIGN KEY (`schedule_draft_id`) REFERENCES `schedule_drafts`(`id`) ON DELETE CASCADE,
	CONSTRAINT "exam_schedules_time_order_ck" CHECK("end_at" > "start_at")
);
--> statement-breakpoint
CREATE TABLE `lecturer_availabilities` (
	`academic_period_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`day_of_week` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`id` text PRIMARY KEY,
	`lecturer_id` text NOT NULL,
	`start_minute` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_lecturer_availabilities_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_lecturer_availabilities_lecturer_id_lecturers_id_fk` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE CASCADE,
	CONSTRAINT "lecturer_availabilities_day_ck" CHECK("day_of_week" >= 1 AND "day_of_week" <= 7),
	CONSTRAINT "lecturer_availabilities_time_ck" CHECK("start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute")
);
--> statement-breakpoint
CREATE TABLE `schedule_approvals` (
	`actor_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`decision` text NOT NULL,
	`draft_version` integer NOT NULL,
	`id` text PRIMARY KEY,
	`reason` text,
	`schedule_draft_id` text NOT NULL,
	CONSTRAINT `fk_schedule_approvals_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_approvals_schedule_draft_id_schedule_drafts_id_fk` FOREIGN KEY (`schedule_draft_id`) REFERENCES `schedule_drafts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `schedule_change_requests` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	`decision_reason` text,
	`id` text PRIMARY KEY,
	`meeting_id` text NOT NULL,
	`proposed_end_at` integer NOT NULL,
	`proposed_room_id` text NOT NULL,
	`proposed_start_at` integer NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_schedule_change_requests_decided_by_user_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_change_requests_meeting_id_class_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_schedule_change_requests_proposed_room_id_rooms_id_fk` FOREIGN KEY (`proposed_room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_schedule_change_requests_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "schedule_change_requests_time_order_ck" CHECK("proposed_end_at" > "proposed_start_at")
);
--> statement-breakpoint
CREATE TABLE `schedule_conflicts` (
	`class_section_id` text,
	`conflict_type` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_at` integer,
	`entity_ids` text NOT NULL,
	`id` text PRIMARY KEY,
	`message` text NOT NULL,
	`resolution` text,
	`resolved_at` integer,
	`resolved_by` text,
	`schedule_draft_id` text NOT NULL,
	`severity` text DEFAULT 'BLOCKING' NOT NULL,
	`start_at` integer,
	CONSTRAINT `fk_schedule_conflicts_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_schedule_conflicts_resolved_by_user_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_conflicts_schedule_draft_id_schedule_drafts_id_fk` FOREIGN KEY (`schedule_draft_id`) REFERENCES `schedule_drafts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `schedule_drafts` (
	`academic_period_id` text NOT NULL,
	`approved_at` integer,
	`approved_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`id` text PRIMARY KEY,
	`published_at` integer,
	`published_by` text,
	`rejection_reason` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`study_program_id` text NOT NULL,
	`submitted_at` integer,
	`submitted_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_schedule_drafts_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_schedule_drafts_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_drafts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_drafts_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_drafts_study_program_id_study_programs_id_fk` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_schedule_drafts_submitted_by_user_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_revisions` (
	`change_request_id` text,
	`changed_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`effective_from` integer NOT NULL,
	`effective_until` integer,
	`end_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`instructions` text,
	`meeting_id` text NOT NULL,
	`modality` text NOT NULL,
	`online_url` text,
	`reason` text NOT NULL,
	`room_id` text,
	`start_at` integer NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_schedule_revisions_change_request_id_schedule_change_requests_id_fk` FOREIGN KEY (`change_request_id`) REFERENCES `schedule_change_requests`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_revisions_changed_by_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_schedule_revisions_meeting_id_class_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_schedule_revisions_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `schedule_slots` (
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`end_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`instructions` text,
	`modality` text DEFAULT 'OFFLINE' NOT NULL,
	`online_url` text,
	`room_id` text,
	`schedule_draft_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_schedule_slots_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_schedule_slots_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_schedule_slots_schedule_draft_id_schedule_drafts_id_fk` FOREIGN KEY (`schedule_draft_id`) REFERENCES `schedule_drafts`(`id`) ON DELETE CASCADE,
	CONSTRAINT "schedule_slots_time_order_ck" CHECK("end_at" > "start_at")
);
--> statement-breakpoint
CREATE TABLE `teaching_assignments` (
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`is_primary` integer DEFAULT false NOT NULL,
	`lecturer_id` text NOT NULL,
	CONSTRAINT `fk_teaching_assignments_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_teaching_assignments_lecturer_id_lecturers_id_fk` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_enrollments_student_course_plan_uq` ON `class_enrollments` (`student_id`,`study_plan_item_id`);--> statement-breakpoint
CREATE INDEX `class_enrollments_class_idx` ON `class_enrollments` (`class_section_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_mapping_jobs_period_key_uq` ON `class_mapping_jobs` (`academic_period_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `class_mapping_jobs_status_idx` ON `class_mapping_jobs` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_meetings_class_sequence_uq` ON `class_meetings` (`class_section_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `class_meetings_window_idx` ON `class_meetings` (`start_at`,`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_sections_period_course_code_uq` ON `class_sections` (`academic_period_id`,`course_id`,`code`);--> statement-breakpoint
CREATE INDEX `class_sections_program_period_status_idx` ON `class_sections` (`study_program_id`,`academic_period_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `exam_schedules_draft_class_type_uq` ON `exam_schedules` (`schedule_draft_id`,`class_section_id`,`exam_type`);--> statement-breakpoint
CREATE INDEX `exam_schedules_room_window_idx` ON `exam_schedules` (`room_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `lecturer_availabilities_window_uq` ON `lecturer_availabilities` (`academic_period_id`,`lecturer_id`,`day_of_week`,`start_minute`,`end_minute`);--> statement-breakpoint
CREATE INDEX `schedule_approvals_draft_created_at_idx` ON `schedule_approvals` (`schedule_draft_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `schedule_change_requests_status_created_idx` ON `schedule_change_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `schedule_conflicts_draft_severity_resolved_idx` ON `schedule_conflicts` (`schedule_draft_id`,`severity`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `schedule_drafts_program_period_status_idx` ON `schedule_drafts` (`study_program_id`,`academic_period_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_revisions_meeting_version_uq` ON `schedule_revisions` (`meeting_id`,`version`);--> statement-breakpoint
CREATE INDEX `schedule_revisions_meeting_effective_idx` ON `schedule_revisions` (`meeting_id`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_slots_draft_class_uq` ON `schedule_slots` (`schedule_draft_id`,`class_section_id`);--> statement-breakpoint
CREATE INDEX `schedule_slots_room_window_idx` ON `schedule_slots` (`room_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `teaching_assignments_class_lecturer_uq` ON `teaching_assignments` (`class_section_id`,`lecturer_id`);--> statement-breakpoint
CREATE INDEX `teaching_assignments_lecturer_idx` ON `teaching_assignments` (`lecturer_id`);