CREATE TABLE `comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`record` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paper_owner_identity` ON `papers` (`user_id`,`fingerprint`);