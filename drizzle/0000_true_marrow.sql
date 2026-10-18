CREATE TABLE `injection` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`taken_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`dose_mcg` integer NOT NULL,
	`site` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medication`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "injection_dose" CHECK("injection"."dose_mcg" > 0),
	CONSTRAINT "injection_site" CHECK("injection"."site" IS NULL OR "injection"."site" IN ('abdomen-left', 'abdomen-right', 'thigh-left', 'thigh-right', 'arm-left', 'arm-right'))
);
--> statement-breakpoint
CREATE INDEX `injection_medication_date` ON `injection` (`medication_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `medication` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "medication_name" CHECK(length(trim("medication"."name")) BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE `plan_step` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`start_date` text NOT NULL,
	`dose_mcg` integer NOT NULL,
	`interval_days` integer DEFAULT 7 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medication`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "plan_step_dose" CHECK("plan_step"."dose_mcg" > 0),
	CONSTRAINT "plan_step_interval" CHECK("plan_step"."interval_days" BETWEEN 1 AND 90)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_step_medication_start` ON `plan_step` (`medication_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`goal_weight_g` integer,
	`injection_reminder_enabled` integer DEFAULT false NOT NULL,
	`injection_reminder_minute` integer DEFAULT 540 NOT NULL,
	`weigh_in_reminder_enabled` integer DEFAULT false NOT NULL,
	`weigh_in_reminder_minute` integer DEFAULT 450 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1),
	CONSTRAINT "settings_weight_unit" CHECK("settings"."weight_unit" IN ('kg', 'lb')),
	CONSTRAINT "settings_goal_range" CHECK("settings"."goal_weight_g" IS NULL OR "settings"."goal_weight_g" BETWEEN 20000 AND 400000),
	CONSTRAINT "settings_injection_minute" CHECK("settings"."injection_reminder_minute" BETWEEN 0 AND 1439),
	CONSTRAINT "settings_weigh_in_minute" CHECK("settings"."weigh_in_reminder_minute" BETWEEN 0 AND 1439)
);
--> statement-breakpoint
CREATE TABLE `side_effect` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`type` text NOT NULL,
	`severity` integer NOT NULL,
	`injection_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`injection_id`) REFERENCES `injection`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "side_effect_severity" CHECK("side_effect"."severity" BETWEEN 1 AND 3),
	CONSTRAINT "side_effect_type" CHECK("side_effect"."type" IN ('nausea', 'vomiting', 'constipation', 'diarrhea', 'heartburn', 'fatigue', 'headache', 'injection-site', 'other'))
);
--> statement-breakpoint
CREATE INDEX `side_effect_local_date` ON `side_effect` (`local_date`);--> statement-breakpoint
CREATE TABLE `weight_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`measured_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`weight_g` integer NOT NULL,
	`source` text NOT NULL,
	`health_connect_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "weight_entry_range" CHECK("weight_entry"."weight_g" BETWEEN 20000 AND 400000),
	CONSTRAINT "weight_entry_source" CHECK("weight_entry"."source" IN ('manual', 'health_connect')),
	CONSTRAINT "weight_entry_local_date" CHECK("weight_entry"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "weight_entry_hc_source" CHECK(("weight_entry"."source" = 'health_connect') = ("weight_entry"."health_connect_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `weight_entry_local_date` ON `weight_entry` (`local_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `weight_entry_hc_id` ON `weight_entry` (`health_connect_id`);