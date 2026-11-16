PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`goal_weight_g` integer,
	`injection_reminder_enabled` integer DEFAULT false NOT NULL,
	`injection_reminder_minute` integer DEFAULT 540 NOT NULL,
	`weigh_in_reminder_enabled` integer DEFAULT false NOT NULL,
	`weigh_in_reminder_minute` integer DEFAULT 450 NOT NULL,
	`health_connect_enabled` integer DEFAULT false NOT NULL,
	`health_connect_synced_at` integer,
	`welcomed_at` integer,
	`language` text DEFAULT 'system' NOT NULL,
	`energy_goal_kcal` integer,
	`protein_goal_g` integer,
	`water_goal_ml` integer,
	`water_serving_ml` integer DEFAULT 250 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("__new_settings"."id" = 1),
	CONSTRAINT "settings_weight_unit" CHECK("__new_settings"."weight_unit" IN ('kg', 'lb')),
	CONSTRAINT "settings_goal_range" CHECK("__new_settings"."goal_weight_g" IS NULL OR "__new_settings"."goal_weight_g" BETWEEN 20000 AND 400000),
	CONSTRAINT "settings_injection_minute" CHECK("__new_settings"."injection_reminder_minute" BETWEEN 0 AND 1439),
	CONSTRAINT "settings_weigh_in_minute" CHECK("__new_settings"."weigh_in_reminder_minute" BETWEEN 0 AND 1439),
	CONSTRAINT "settings_language" CHECK("__new_settings"."language" IN ('system', 'tr', 'en')),
	CONSTRAINT "settings_energy_goal" CHECK("__new_settings"."energy_goal_kcal" IS NULL OR "__new_settings"."energy_goal_kcal" BETWEEN 500 AND 6000),
	CONSTRAINT "settings_protein_goal" CHECK("__new_settings"."protein_goal_g" IS NULL OR "__new_settings"."protein_goal_g" BETWEEN 10 AND 400),
	CONSTRAINT "settings_water_goal" CHECK("__new_settings"."water_goal_ml" IS NULL OR "__new_settings"."water_goal_ml" BETWEEN 250 AND 10000),
	CONSTRAINT "settings_water_serving" CHECK("__new_settings"."water_serving_ml" BETWEEN 50 AND 2000)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "weight_unit", "goal_weight_g", "injection_reminder_enabled", "injection_reminder_minute", "weigh_in_reminder_enabled", "weigh_in_reminder_minute", "health_connect_enabled", "health_connect_synced_at", "welcomed_at", "language", "energy_goal_kcal", "protein_goal_g", "water_goal_ml", "water_serving_ml", "updated_at") SELECT "id", "weight_unit", "goal_weight_g", "injection_reminder_enabled", "injection_reminder_minute", "weigh_in_reminder_enabled", "weigh_in_reminder_minute", "health_connect_enabled", "health_connect_synced_at", "welcomed_at", "language", "energy_goal_kcal", "protein_goal_g", "water_goal_ml", "water_serving_ml", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;