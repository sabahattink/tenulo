CREATE TABLE `custom_food` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`serving_label` text NOT NULL,
	`serving_grams` integer,
	`energy_kcal` integer NOT NULL,
	`protein_mg` integer,
	`carb_mg` integer,
	`fat_mg` integer,
	`fiber_mg` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "custom_food_name" CHECK(length(trim("custom_food"."name")) BETWEEN 1 AND 60),
	CONSTRAINT "custom_food_serving_label" CHECK(length(trim("custom_food"."serving_label")) BETWEEN 1 AND 40),
	CONSTRAINT "custom_food_serving_grams" CHECK("custom_food"."serving_grams" IS NULL OR "custom_food"."serving_grams" BETWEEN 1 AND 5000),
	CONSTRAINT "custom_food_energy" CHECK("custom_food"."energy_kcal" BETWEEN 0 AND 5000),
	CONSTRAINT "custom_food_nutrients" CHECK(coalesce("custom_food"."protein_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("custom_food"."carb_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("custom_food"."fat_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("custom_food"."fiber_mg", 0) BETWEEN 0 AND 2000000)
);
--> statement-breakpoint
CREATE TABLE `exercise_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`logged_at` integer NOT NULL,
	`kind` text NOT NULL,
	`duration_min` integer NOT NULL,
	`intensity` text NOT NULL,
	`energy_kcal` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "exercise_entry_local_date" CHECK("exercise_entry"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "exercise_entry_kind" CHECK("exercise_entry"."kind" IN ('walking', 'running', 'cycling', 'swimming', 'strength', 'yoga', 'sports', 'other')),
	CONSTRAINT "exercise_entry_intensity" CHECK("exercise_entry"."intensity" IN ('light', 'moderate', 'vigorous')),
	CONSTRAINT "exercise_entry_duration" CHECK("exercise_entry"."duration_min" BETWEEN 1 AND 1440),
	CONSTRAINT "exercise_entry_energy" CHECK("exercise_entry"."energy_kcal" IS NULL OR "exercise_entry"."energy_kcal" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `exercise_entry_local_date` ON `exercise_entry` (`local_date`);--> statement-breakpoint
CREATE TABLE `food_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`logged_at` integer NOT NULL,
	`meal` text NOT NULL,
	`catalog_food_id` text,
	`custom_food_id` text,
	`name` text NOT NULL,
	`portion_label` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`grams` integer,
	`energy_kcal` integer NOT NULL,
	`protein_mg` integer,
	`carb_mg` integer,
	`fat_mg` integer,
	`fiber_mg` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`custom_food_id`) REFERENCES `custom_food`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "food_entry_local_date" CHECK("food_entry"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "food_entry_meal" CHECK("food_entry"."meal" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "food_entry_one_source" CHECK("food_entry"."catalog_food_id" IS NULL OR "food_entry"."custom_food_id" IS NULL),
	CONSTRAINT "food_entry_name" CHECK(length(trim("food_entry"."name")) BETWEEN 1 AND 80),
	CONSTRAINT "food_entry_portion" CHECK(length(trim("food_entry"."portion_label")) BETWEEN 1 AND 40),
	CONSTRAINT "food_entry_quantity" CHECK("food_entry"."quantity_milli" BETWEEN 1 AND 100000000),
	CONSTRAINT "food_entry_grams" CHECK("food_entry"."grams" IS NULL OR "food_entry"."grams" BETWEEN 0 AND 100000),
	CONSTRAINT "food_entry_energy" CHECK("food_entry"."energy_kcal" BETWEEN 0 AND 10000),
	CONSTRAINT "food_entry_nutrients" CHECK(coalesce("food_entry"."protein_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("food_entry"."carb_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("food_entry"."fat_mg", 0) BETWEEN 0 AND 2000000 AND coalesce("food_entry"."fiber_mg", 0) BETWEEN 0 AND 2000000)
);
--> statement-breakpoint
CREATE INDEX `food_entry_local_date` ON `food_entry` (`local_date`);--> statement-breakpoint
CREATE TABLE `measurement_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`measured_at` integer NOT NULL,
	`site` text NOT NULL,
	`length_mm` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "measurement_entry_local_date" CHECK("measurement_entry"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "measurement_entry_site" CHECK("measurement_entry"."site" IN ('waist', 'hip', 'chest', 'neck', 'arm', 'thigh')),
	CONSTRAINT "measurement_entry_length" CHECK("measurement_entry"."length_mm" BETWEEN 100 AND 3000)
);
--> statement-breakpoint
CREATE INDEX `measurement_entry_site_date` ON `measurement_entry` (`site`,`local_date`);--> statement-breakpoint
CREATE TABLE `water_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`logged_at` integer NOT NULL,
	`amount_ml` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "water_entry_local_date" CHECK("water_entry"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "water_entry_amount" CHECK("water_entry"."amount_ml" BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE INDEX `water_entry_local_date` ON `water_entry` (`local_date`);--> statement-breakpoint
ALTER TABLE `settings` ADD `language` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `energy_goal_kcal` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `protein_goal_g` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `water_goal_ml` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `water_serving_ml` integer DEFAULT 250 NOT NULL;