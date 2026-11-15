-- Custom migration: the YYYY-MM-DD check weight_entry.local_date has as a CHECK constraint, for the
-- other date columns. SQLite cannot add a CHECK to an existing table without rebuilding it, and a
-- rebuild drops the table inside the migrator's transaction, where PRAGMA foreign_keys=OFF does
-- nothing: dropping `injection` would clear every side effect's link to it. Triggers add the same
-- rule without touching existing rows. They raise SQLite's own CHECK message. See src/db/schema.ts.
CREATE TRIGGER `injection_local_date_insert` BEFORE INSERT ON `injection`
WHEN NEW.`local_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: injection_local_date'); END;
--> statement-breakpoint
CREATE TRIGGER `injection_local_date_update` BEFORE UPDATE OF `local_date` ON `injection`
WHEN NEW.`local_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: injection_local_date'); END;
--> statement-breakpoint
CREATE TRIGGER `side_effect_local_date_insert` BEFORE INSERT ON `side_effect`
WHEN NEW.`local_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: side_effect_local_date'); END;
--> statement-breakpoint
CREATE TRIGGER `side_effect_local_date_update` BEFORE UPDATE OF `local_date` ON `side_effect`
WHEN NEW.`local_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: side_effect_local_date'); END;
--> statement-breakpoint
CREATE TRIGGER `plan_step_start_date_insert` BEFORE INSERT ON `plan_step`
WHEN NEW.`start_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: plan_step_start_date'); END;
--> statement-breakpoint
CREATE TRIGGER `plan_step_start_date_update` BEFORE UPDATE OF `start_date` ON `plan_step`
WHEN NEW.`start_date` NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: plan_step_start_date'); END;
