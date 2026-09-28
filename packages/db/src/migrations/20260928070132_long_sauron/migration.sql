CREATE TABLE `assignment_files` (
	`assignment_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	CONSTRAINT `fk_assignment_files_assignment_id_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_assignment_files_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `assignment_submissions` (
	`assignment_id` text NOT NULL,
	`body` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`is_late` integer NOT NULL,
	`status` text NOT NULL,
	`student_id` text NOT NULL,
	`submitted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_assignment_submissions_assignment_id_assignments_id_fk` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_assignment_submissions_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`allow_resubmit` integer DEFAULT false NOT NULL,
	`body` text,
	`class_meeting_id` text,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	`due_at` integer NOT NULL,
	`id` text PRIMARY KEY,
	`published_at` integer,
	`published_by` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_assignments_class_meeting_id_class_meetings_id_fk` FOREIGN KEY (`class_meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_assignments_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_assignments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_assignments_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "assignments_title_not_empty_ck" CHECK(length(trim("title")) > 0)
);
--> statement-breakpoint
CREATE TABLE `forum_attachments` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`post_id` text NOT NULL,
	CONSTRAINT `fk_forum_attachments_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_forum_attachments_post_id_forum_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `forum_posts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `forum_posts` (
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`edited_at` integer,
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	CONSTRAINT `fk_forum_posts_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_forum_posts_thread_id_forum_threads_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `forum_threads`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `forum_threads` (
	`class_meeting_id` text,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	`id` text PRIMARY KEY,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_forum_threads_class_meeting_id_class_meetings_id_fk` FOREIGN KEY (`class_meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_forum_threads_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_forum_threads_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `learning_materials` (
	`body` text,
	`class_meeting_id` text,
	`class_section_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text NOT NULL,
	`id` text PRIMARY KEY,
	`published_at` integer,
	`published_by` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_learning_materials_class_meeting_id_class_meetings_id_fk` FOREIGN KEY (`class_meeting_id`) REFERENCES `class_meetings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_learning_materials_class_section_id_class_sections_id_fk` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_learning_materials_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_learning_materials_published_by_user_id_fk` FOREIGN KEY (`published_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "learning_materials_title_not_empty_ck" CHECK(length(trim("title")) > 0)
);
--> statement-breakpoint
CREATE TABLE `material_files` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`material_id` text NOT NULL,
	CONSTRAINT `fk_material_files_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_material_files_material_id_learning_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `learning_materials`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `submission_files` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`file_object_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`submission_id` text NOT NULL,
	CONSTRAINT `fk_submission_files_file_object_id_file_objects_id_fk` FOREIGN KEY (`file_object_id`) REFERENCES `file_objects`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_submission_files_submission_id_assignment_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `assignment_submissions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_files_assignment_file_uq` ON `assignment_files` (`assignment_id`,`file_object_id`);--> statement-breakpoint
CREATE INDEX `assignment_files_assignment_idx` ON `assignment_files` (`assignment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_submissions_assignment_student_version_uq` ON `assignment_submissions` (`assignment_id`,`student_id`,`version`);--> statement-breakpoint
CREATE INDEX `assignment_submissions_assignment_student_idx` ON `assignment_submissions` (`assignment_id`,`student_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `assignments_section_meeting_status_due_idx` ON `assignments` (`class_section_id`,`class_meeting_id`,`status`,`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `forum_attachments_post_file_uq` ON `forum_attachments` (`post_id`,`file_object_id`);--> statement-breakpoint
CREATE INDEX `forum_attachments_post_idx` ON `forum_attachments` (`post_id`);--> statement-breakpoint
CREATE INDEX `forum_posts_thread_created_idx` ON `forum_posts` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `forum_threads_section_meeting_status_idx` ON `forum_threads` (`class_section_id`,`class_meeting_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `learning_materials_section_meeting_status_idx` ON `learning_materials` (`class_section_id`,`class_meeting_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `material_files_material_file_uq` ON `material_files` (`material_id`,`file_object_id`);--> statement-breakpoint
CREATE INDEX `material_files_material_idx` ON `material_files` (`material_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `submission_files_submission_file_uq` ON `submission_files` (`submission_id`,`file_object_id`);--> statement-breakpoint
CREATE INDEX `submission_files_submission_idx` ON `submission_files` (`submission_id`);