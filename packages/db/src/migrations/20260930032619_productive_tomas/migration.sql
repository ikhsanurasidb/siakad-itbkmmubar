CREATE TABLE `student_semester_trackers` (
	`academic_period_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`semester_number` integer NOT NULL,
	`source` text DEFAULT 'AUTO' NOT NULL,
	`student_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_student_semester_trackers_academic_period_id_academic_periods_id_fk` FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_student_semester_trackers_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
	CONSTRAINT "student_semester_trackers_semester_range_ck" CHECK("semester_number" >= 1 AND "semester_number" <= 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_semester_trackers_student_period_uq` ON `student_semester_trackers` (`student_id`,`academic_period_id`);--> statement-breakpoint
CREATE INDEX `student_semester_trackers_period_semester_idx` ON `student_semester_trackers` (`academic_period_id`,`semester_number`);