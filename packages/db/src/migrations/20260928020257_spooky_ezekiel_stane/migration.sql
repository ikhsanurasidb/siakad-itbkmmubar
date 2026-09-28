CREATE TABLE `grade_scale_entries` (
	`grade_code` text NOT NULL,
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`max_score` real NOT NULL,
	`min_score` real NOT NULL,
	`quality_points` real NOT NULL,
	`scale_set_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	CONSTRAINT `fk_grade_scale_entries_scale_set_id_grade_scale_sets_id_fk` FOREIGN KEY (`scale_set_id`) REFERENCES `grade_scale_sets`(`id`) ON DELETE CASCADE,
	CONSTRAINT "grade_scale_entries_range_ck" CHECK("min_score" >= 0 AND "max_score" <= 100 AND "min_score" <= "max_score"),
	CONSTRAINT "grade_scale_entries_quality_ck" CHECK("quality_points" >= 0 AND "quality_points" <= 4)
);
--> statement-breakpoint
CREATE TABLE `grade_scale_sets` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`effective_from` integer NOT NULL,
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`scope_id` text DEFAULT '' NOT NULL,
	`scope_type` text NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_grade_scale_sets_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `policy_activation_histories` (
	`action` text NOT NULL,
	`activated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`activated_by` text,
	`id` text PRIMARY KEY,
	`metadata` text,
	`policy_id` text NOT NULL,
	`policy_type` text NOT NULL,
	`previous_policy_id` text,
	`scope_id` text DEFAULT '' NOT NULL,
	`scope_type` text NOT NULL,
	CONSTRAINT `fk_policy_activation_histories_activated_by_user_id_fk` FOREIGN KEY (`activated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `setting_definitions` (
	`category` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`default_value` text NOT NULL,
	`description` text NOT NULL,
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`max_value` real,
	`min_value` real,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`value_type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setting_values` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`current_version_id` text,
	`definition_id` text NOT NULL,
	`id` text PRIMARY KEY,
	`scope_id` text DEFAULT '' NOT NULL,
	`scope_type` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_setting_values_definition_id_setting_definitions_id_fk` FOREIGN KEY (`definition_id`) REFERENCES `setting_definitions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `setting_versions` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	`effective_from` integer NOT NULL,
	`id` text PRIMARY KEY,
	`note` text,
	`setting_value_id` text NOT NULL,
	`value_json` text NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_setting_versions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_setting_versions_setting_value_id_setting_values_id_fk` FOREIGN KEY (`setting_value_id`) REFERENCES `setting_values`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grade_scale_entries_code_uq` ON `grade_scale_entries` (`scale_set_id`,`grade_code`);--> statement-breakpoint
CREATE INDEX `grade_scale_entries_scale_idx` ON `grade_scale_entries` (`scale_set_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `grade_scale_sets_scope_version_uq` ON `grade_scale_sets` (`scope_type`,`scope_id`,`version`);--> statement-breakpoint
CREATE INDEX `grade_scale_sets_effective_idx` ON `grade_scale_sets` (`scope_type`,`scope_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `policy_activation_histories_policy_idx` ON `policy_activation_histories` (`policy_type`,`policy_id`);--> statement-breakpoint
CREATE INDEX `policy_activation_histories_activated_at_idx` ON `policy_activation_histories` (`activated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `setting_definitions_key_uq` ON `setting_definitions` (`key`);--> statement-breakpoint
CREATE INDEX `setting_definitions_category_idx` ON `setting_definitions` (`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `setting_values_definition_scope_uq` ON `setting_values` (`definition_id`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `setting_values_scope_idx` ON `setting_values` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `setting_versions_value_version_uq` ON `setting_versions` (`setting_value_id`,`version`);--> statement-breakpoint
CREATE INDEX `setting_versions_effective_idx` ON `setting_versions` (`setting_value_id`,`effective_from`);
--> statement-breakpoint
INSERT INTO `setting_definitions` (`category`, `default_value`, `description`, `id`, `key`, `label`, `max_value`, `min_value`, `value_type`) VALUES
('SECURITY', '72', 'Batas waktu sesi tidak aktif sebelum pengguna harus masuk kembali.', 'setting-session_idle_timeout_hours', 'session_idle_timeout_hours', 'Batas waktu sesi tidak aktif (jam)', 720, 1, 'INTEGER'),
('SECURITY', '60', 'Jeda minimum pembaruan aktivitas sesi.', 'setting-session_refresh_interval_minutes', 'session_refresh_interval_minutes', 'Jeda pembaruan sesi (menit)', 1440, 5, 'INTEGER'),
('SECURITY', '16', 'Panjang minimum semua kata sandi.', 'setting-password_min_length', 'password_min_length', 'Panjang minimum kata sandi', 256, 16, 'INTEGER'),
('SECURITY', '24', 'Masa berlaku kata sandi sementara.', 'setting-temporary_password_ttl_hours', 'temporary_password_ttl_hours', 'Masa berlaku kata sandi sementara (jam)', 720, 1, 'INTEGER'),
('SECURITY', '5', 'Jumlah percobaan masuk sebelum akun dikunci.', 'setting-login_rate_limit_attempts', 'login_rate_limit_attempts', 'Batas percobaan masuk', 100, 1, 'INTEGER'),
('SECURITY', '15', 'Durasi penguncian setelah batas percobaan masuk terlampaui.', 'setting-login_lock_window_minutes', 'login_lock_window_minutes', 'Durasi penguncian akun (menit)', 1440, 1, 'INTEGER'),
('SCHEDULING', '7', 'Batas waktu perubahan kelas dengan hitungan tanggal inklusif.', 'setting-schedule_change_lead_days', 'schedule_change_lead_days', 'Batas waktu perubahan kelas (hari)', 365, 1, 'INTEGER'),
('SCHEDULING', '2', 'Maksimum pertemuan daring dalam satu kelas.', 'setting-online_meeting_max_per_class', 'online_meeting_max_per_class', 'Maksimum pertemuan daring', 100, 0, 'INTEGER'),
('ATTENDANCE', '1000', 'Radius presensi luring dalam meter.', 'setting-attendance_radius_meters', 'attendance_radius_meters', 'Radius presensi (meter)', 100000, 1, 'DECIMAL'),
('ATTENDANCE', '30', 'Jeda pembukaan presensi setelah kelas dimulai.', 'setting-attendance_open_offset_minutes', 'attendance_open_offset_minutes', 'Jeda pembukaan presensi (menit)', 1440, 0, 'INTEGER'),
('ATTENDANCE', '60', 'Jeda penutupan presensi setelah kelas selesai.', 'setting-attendance_close_offset_minutes', 'attendance_close_offset_minutes', 'Jeda penutupan presensi (menit)', 1440, 0, 'INTEGER'),
('GRADING', '"HIGHEST"', 'Nilai yang digunakan untuk mata kuliah ulang.', 'setting-retake_policy', 'retake_policy', 'Kebijakan mata kuliah ulang', NULL, NULL, 'ENUM'),
('GRADING', '"HALF_UP"', 'Metode pembulatan nilai.', 'setting-rounding_method', 'rounding_method', 'Metode pembulatan', NULL, NULL, 'ENUM'),
('GRADING', '2', 'Presisi angka setelah pembulatan.', 'setting-rounding_precision', 'rounding_precision', 'Presisi pembulatan', 6, 0, 'INTEGER'),
('FILE', '10485760', 'Ukuran maksimum berkas yang diunggah dalam byte.', 'setting-upload_max_size_bytes', 'upload_max_size_bytes', 'Ukuran maksimum unggahan (byte)', 1073741824, 1, 'INTEGER'),
('FILE', '["application/pdf","image/jpeg","image/png"]', 'Jenis berkas yang diizinkan untuk unggahan privat.', 'setting-allowed_mime_types', 'allowed_mime_types', 'Jenis berkas yang diizinkan', NULL, NULL, 'JSON'),
('BATCH', '10000', 'Batas baris impor dalam satu pekerjaan.', 'setting-import_max_rows', 'import_max_rows', 'Maksimum baris impor', 1000000, 1, 'INTEGER'),
('BATCH', '100', 'Ukuran kelompok yang aman untuk operasi massal.', 'setting-import_chunk_size', 'import_chunk_size', 'Ukuran kelompok impor', 1000, 1, 'INTEGER');
--> statement-breakpoint
INSERT INTO `setting_values` (`created_at`, `current_version_id`, `definition_id`, `id`, `scope_id`, `scope_type`, `updated_at`) VALUES
(0, 'setting-version-session_idle_timeout_hours-1', 'setting-session_idle_timeout_hours', 'setting-value-session_idle_timeout_hours-system', '', 'SYSTEM', 0),
(0, 'setting-version-session_refresh_interval_minutes-1', 'setting-session_refresh_interval_minutes', 'setting-value-session_refresh_interval_minutes-system', '', 'SYSTEM', 0),
(0, 'setting-version-password_min_length-1', 'setting-password_min_length', 'setting-value-password_min_length-system', '', 'SYSTEM', 0),
(0, 'setting-version-temporary_password_ttl_hours-1', 'setting-temporary_password_ttl_hours', 'setting-value-temporary_password_ttl_hours-system', '', 'SYSTEM', 0),
(0, 'setting-version-login_rate_limit_attempts-1', 'setting-login_rate_limit_attempts', 'setting-value-login_rate_limit_attempts-system', '', 'SYSTEM', 0),
(0, 'setting-version-login_lock_window_minutes-1', 'setting-login_lock_window_minutes', 'setting-value-login_lock_window_minutes-system', '', 'SYSTEM', 0),
(0, 'setting-version-schedule_change_lead_days-1', 'setting-schedule_change_lead_days', 'setting-value-schedule_change_lead_days-system', '', 'SYSTEM', 0),
(0, 'setting-version-online_meeting_max_per_class-1', 'setting-online_meeting_max_per_class', 'setting-value-online_meeting_max_per_class-system', '', 'SYSTEM', 0),
(0, 'setting-version-attendance_radius_meters-1', 'setting-attendance_radius_meters', 'setting-value-attendance_radius_meters-system', '', 'SYSTEM', 0),
(0, 'setting-version-attendance_open_offset_minutes-1', 'setting-attendance_open_offset_minutes', 'setting-value-attendance_open_offset_minutes-system', '', 'SYSTEM', 0),
(0, 'setting-version-attendance_close_offset_minutes-1', 'setting-attendance_close_offset_minutes', 'setting-value-attendance_close_offset_minutes-system', '', 'SYSTEM', 0),
(0, 'setting-version-retake_policy-1', 'setting-retake_policy', 'setting-value-retake_policy-system', '', 'SYSTEM', 0),
(0, 'setting-version-rounding_method-1', 'setting-rounding_method', 'setting-value-rounding_method-system', '', 'SYSTEM', 0),
(0, 'setting-version-rounding_precision-1', 'setting-rounding_precision', 'setting-value-rounding_precision-system', '', 'SYSTEM', 0),
(0, 'setting-version-upload_max_size_bytes-1', 'setting-upload_max_size_bytes', 'setting-value-upload_max_size_bytes-system', '', 'SYSTEM', 0),
(0, 'setting-version-allowed_mime_types-1', 'setting-allowed_mime_types', 'setting-value-allowed_mime_types-system', '', 'SYSTEM', 0),
(0, 'setting-version-import_max_rows-1', 'setting-import_max_rows', 'setting-value-import_max_rows-system', '', 'SYSTEM', 0),
(0, 'setting-version-import_chunk_size-1', 'setting-import_chunk_size', 'setting-value-import_chunk_size-system', '', 'SYSTEM', 0);
--> statement-breakpoint
INSERT INTO `setting_versions` (`created_at`, `created_by`, `effective_from`, `id`, `note`, `setting_value_id`, `value_json`, `version`) VALUES
(0, NULL, 0, 'setting-version-session_idle_timeout_hours-1', 'Default SIAKAD-03', 'setting-value-session_idle_timeout_hours-system', '72', 1),
(0, NULL, 0, 'setting-version-session_refresh_interval_minutes-1', 'Default SIAKAD-03', 'setting-value-session_refresh_interval_minutes-system', '60', 1),
(0, NULL, 0, 'setting-version-password_min_length-1', 'Default SIAKAD-03', 'setting-value-password_min_length-system', '16', 1),
(0, NULL, 0, 'setting-version-temporary_password_ttl_hours-1', 'Default SIAKAD-03', 'setting-value-temporary_password_ttl_hours-system', '24', 1),
(0, NULL, 0, 'setting-version-login_rate_limit_attempts-1', 'Default SIAKAD-03', 'setting-value-login_rate_limit_attempts-system', '5', 1),
(0, NULL, 0, 'setting-version-login_lock_window_minutes-1', 'Default SIAKAD-03', 'setting-value-login_lock_window_minutes-system', '15', 1),
(0, NULL, 0, 'setting-version-schedule_change_lead_days-1', 'Default SIAKAD-03', 'setting-value-schedule_change_lead_days-system', '7', 1),
(0, NULL, 0, 'setting-version-online_meeting_max_per_class-1', 'Default SIAKAD-03', 'setting-value-online_meeting_max_per_class-system', '2', 1),
(0, NULL, 0, 'setting-version-attendance_radius_meters-1', 'Default SIAKAD-03', 'setting-value-attendance_radius_meters-system', '1000', 1),
(0, NULL, 0, 'setting-version-attendance_open_offset_minutes-1', 'Default SIAKAD-03', 'setting-value-attendance_open_offset_minutes-system', '30', 1),
(0, NULL, 0, 'setting-version-attendance_close_offset_minutes-1', 'Default SIAKAD-03', 'setting-value-attendance_close_offset_minutes-system', '60', 1),
(0, NULL, 0, 'setting-version-retake_policy-1', 'Default SIAKAD-03', 'setting-value-retake_policy-system', '"HIGHEST"', 1),
(0, NULL, 0, 'setting-version-rounding_method-1', 'Default SIAKAD-03', 'setting-value-rounding_method-system', '"HALF_UP"', 1),
(0, NULL, 0, 'setting-version-rounding_precision-1', 'Default SIAKAD-03', 'setting-value-rounding_precision-system', '2', 1),
(0, NULL, 0, 'setting-version-upload_max_size_bytes-1', 'Default SIAKAD-03', 'setting-value-upload_max_size_bytes-system', '10485760', 1),
(0, NULL, 0, 'setting-version-allowed_mime_types-1', 'Default SIAKAD-03', 'setting-value-allowed_mime_types-system', '["application/pdf","image/jpeg","image/png"]', 1),
(0, NULL, 0, 'setting-version-import_max_rows-1', 'Default SIAKAD-03', 'setting-value-import_max_rows-system', '10000', 1),
(0, NULL, 0, 'setting-version-import_chunk_size-1', 'Default SIAKAD-03', 'setting-value-import_chunk_size-system', '100', 1);
--> statement-breakpoint
INSERT INTO `grade_scale_sets` (`effective_from`, `id`, `name`, `scope_id`, `scope_type`, `version`) VALUES
(0, 'grade-scale-system-v1', 'Skala nilai standar', '', 'SYSTEM', 1);
--> statement-breakpoint
INSERT INTO `grade_scale_entries` (`grade_code`, `id`, `label`, `max_score`, `min_score`, `quality_points`, `scale_set_id`, `sort_order`) VALUES
('A', 'grade-scale-system-v1-A', 'Sangat baik', 100, 85, 4, 'grade-scale-system-v1', 0),
('AB', 'grade-scale-system-v1-AB', 'Baik sekali', 85, 80, 3.5, 'grade-scale-system-v1', 1),
('B', 'grade-scale-system-v1-B', 'Baik', 80, 75, 3, 'grade-scale-system-v1', 2),
('BC', 'grade-scale-system-v1-BC', 'Cukup baik', 75, 70, 2.5, 'grade-scale-system-v1', 3),
('C', 'grade-scale-system-v1-C', 'Cukup', 70, 65, 2, 'grade-scale-system-v1', 4),
('D', 'grade-scale-system-v1-D', 'Kurang', 65, 50, 1, 'grade-scale-system-v1', 5),
('E', 'grade-scale-system-v1-E', 'Tidak lulus', 50, 0, 0, 'grade-scale-system-v1', 6);
