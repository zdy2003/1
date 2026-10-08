CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '进行中' NOT NULL,
	`due_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`file_name` text NOT NULL,
	`tender_file_name` text,
	`file_key` text NOT NULL,
	`tender_file_key` text,
	`status` text DEFAULT 'running' NOT NULL,
	`score` integer,
	`high_count` integer DEFAULT 0 NOT NULL,
	`medium_count` integer DEFAULT 0 NOT NULL,
	`low_count` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`result_json` text,
	`error` text,
	`response_id` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT '已邀请' NOT NULL,
	`created_at` text NOT NULL
);
