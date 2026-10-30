ALTER TABLE `settings` ADD `welcomed_at` integer;--> statement-breakpoint
UPDATE `settings` SET `welcomed_at` = `updated_at`;
