PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rate_limit` (
	`count` integer NOT NULL,
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_rate_limit` (`count`, `id`, `key`, `last_request`)
SELECT `count`, `key`, `key`, `last_request` FROM `rate_limit`;--> statement-breakpoint
DROP TABLE `rate_limit`;--> statement-breakpoint
ALTER TABLE `__new_rate_limit` RENAME TO `rate_limit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
