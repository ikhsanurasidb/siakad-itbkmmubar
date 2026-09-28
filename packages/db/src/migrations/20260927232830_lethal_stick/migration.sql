CREATE TABLE `identifier_reservations` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`master_record_id` text NOT NULL,
	`prefix` text NOT NULL,
	`sequence_date` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`status` text DEFAULT 'RESERVED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `identifier_sequences` (
	`next_value` integer DEFAULT 1 NOT NULL,
	`prefix` text NOT NULL,
	`sequence_date` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `identifier_sequences_pk` PRIMARY KEY(`prefix`, `sequence_date`)
);
--> statement-breakpoint
CREATE TABLE `identity_accounts` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deactivated_at` integer,
	`id` text PRIMARY KEY,
	`identity_type` text NOT NULL,
	`identifier` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`temporary_password_expires_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_identity_accounts_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`description` text NOT NULL,
	`key` text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE `program_heads` (
	`assigned_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`assigned_by` text,
	`ends_at` integer,
	`id` text PRIMARY KEY,
	`prodi_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_program_heads_assigned_by_user_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_program_heads_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`count` integer NOT NULL,
	`key` text PRIMARY KEY,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_conflicts` (
	`conflicting_role_key` text NOT NULL,
	`role_key` text NOT NULL,
	CONSTRAINT `role_conflicts_pk` PRIMARY KEY(`role_key`, `conflicting_role_key`),
	CONSTRAINT `fk_role_conflicts_conflicting_role_key_roles_key_fk` FOREIGN KEY (`conflicting_role_key`) REFERENCES `roles`(`key`) ON DELETE CASCADE,
	CONSTRAINT `fk_role_conflicts_role_key_roles_key_fk` FOREIGN KEY (`role_key`) REFERENCES `roles`(`key`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`permission_key` text NOT NULL,
	`role_key` text NOT NULL,
	CONSTRAINT `role_permissions_pk` PRIMARY KEY(`role_key`, `permission_key`),
	CONSTRAINT `fk_role_permissions_permission_key_permissions_key_fk` FOREIGN KEY (`permission_key`) REFERENCES `permissions`(`key`) ON DELETE CASCADE,
	CONSTRAINT `fk_role_permissions_role_key_roles_key_fk` FOREIGN KEY (`role_key`) REFERENCES `roles`(`key`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`description` text NOT NULL,
	`key` text PRIMARY KEY,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`event_type` text NOT NULL,
	`id` text PRIMARY KEY,
	`ip_address` text,
	`metadata` text,
	`request_id` text,
	`user_agent` text,
	`user_id` text,
	CONSTRAINT `fk_security_events_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`assigned_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`assigned_by` text,
	`id` text PRIMARY KEY,
	`is_active` integer DEFAULT true NOT NULL,
	`role_key` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_user_roles_assigned_by_user_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_user_roles_role_key_roles_key_fk` FOREIGN KEY (`role_key`) REFERENCES `roles`(`key`) ON DELETE RESTRICT,
	CONSTRAINT `fk_user_roles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_scopes` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ends_at` integer,
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`starts_at` integer NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_user_scopes_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY,
	`image` text,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`username` text UNIQUE
);
--> statement-breakpoint
INSERT INTO `__new_user`(`created_at`, `email`, `email_verified`, `id`, `image`, `name`, `updated_at`) SELECT `created_at`, `email`, `email_verified`, `id`, `image`, `name`, `updated_at` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `identifier_reservations_identifier_uq` ON `identifier_reservations` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `identifier_reservations_idempotency_uq` ON `identifier_reservations` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `identifier_reservations_master_uq` ON `identifier_reservations` (`master_record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_accounts_identifier_uq` ON `identity_accounts` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_accounts_user_id_uq` ON `identity_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `identity_accounts_status_type_idx` ON `identity_accounts` (`status`,`identity_type`);--> statement-breakpoint
CREATE INDEX `program_heads_prodi_active_idx` ON `program_heads` (`prodi_id`,`ends_at`);--> statement-breakpoint
CREATE INDEX `program_heads_user_idx` ON `program_heads` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_events_user_created_at_idx` ON `security_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_type_created_at_idx` ON `security_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_active_uq` ON `user_roles` (`user_id`,`role_key`,`is_active`);--> statement-breakpoint
CREATE INDEX `user_roles_user_active_idx` ON `user_roles` (`user_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_scopes_active_uq` ON `user_scopes` (`user_id`,`scope_type`,`scope_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `user_scopes_user_type_idx` ON `user_scopes` (`user_id`,`scope_type`);--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`key`, `name`, `description`) VALUES
	('SUPERADMIN', 'Superadmin', 'Mengelola seluruh konfigurasi dan akses sistem.'),
	('ADMIN_AKADEMIK', 'Admin Akademik', 'Mengelola identitas akademik dan operasi akademik.'),
	('ADMIN_KEUANGAN', 'Admin Keuangan', 'Mengelola akses dan proses keuangan.'),
	('KAPRODI', 'Kaprodi', 'Memimpin satu atau lebih assignment Prodi.'),
	('DOSEN', 'Dosen', 'Mengelola aktivitas akademik sesuai assignment.'),
	('MAHASISWA', 'Mahasiswa', 'Mengakses data dan layanan akademik milik sendiri.');--> statement-breakpoint
INSERT OR IGNORE INTO `permissions` (`key`, `description`) VALUES
	('identity.accounts.manage', 'Membuat dan mengelola akun identitas.'),
	('identity.roles.manage', 'Mengelola assignment role.'),
	('identity.scopes.manage', 'Mengelola scope akses.'),
	('identity.sessions.manage', 'Mengelola sesi pengguna.');--> statement-breakpoint
INSERT OR IGNORE INTO `role_conflicts` (`role_key`, `conflicting_role_key`) VALUES
	('ADMIN_AKADEMIK', 'ADMIN_KEUANGAN'),
	('ADMIN_KEUANGAN', 'ADMIN_AKADEMIK');
