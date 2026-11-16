/**
 * Tenulo's on-device database. Nothing here is ever sent off the device.
 *
 * Conventions:
 *  - Ids are ULIDs (text): sortable by creation time, generated offline, safe to merge on restore.
 *  - Instants are UTC epoch milliseconds (integer). Calendar dates are `YYYY-MM-DD` text, the
 *    user's local date at the time of the event, so history never shifts when they travel.
 *    The format is enforced in the database: by a CHECK on weight_entry.local_date, and by
 *    triggers on injection.local_date, side_effect.local_date and plan_step.start_date
 *    (drizzle/0003_date_format_triggers.sql). Drizzle does not model triggers, so they do not
 *    appear below; migration.test.ts covers them. Never add a CHECK to an existing table that
 *    others reference: drizzle-kit rebuilds it, and the rebuild clears their links on the phone.
 *  - Weights are integer grams, doses integer micrograms, energy integer kcal, nutrients integer
 *    milligrams, water integer millilitres, lengths integer millimetres, amounts integer
 *    thousandths. No floats are stored.
 *  - Tables added in 1.1 (food, water, measurements, exercise) check their date format with a table
 *    CHECK: nothing older references them. settings gained CHECKed columns in 1.1, so drizzle-kit
 *    rebuilt it; that is safe only because no table references settings.
 *  - Enumerations are text with CHECK constraints, so bad values fail at the database too.
 */
import { sql } from "drizzle-orm";
import { type SQLiteColumn, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { EXERCISE_KINDS, INTENSITIES, MAX_DURATION_MIN, MAX_EXERCISE_KCAL } from "../domain/exercise";
import {
  MAX_ENTRY_KCAL,
  MAX_NUTRIENT_MG,
  MAX_QUANTITY_MILLI,
  MAX_SERVING_KCAL,
  MAX_SERVING_NUTRIENT_G,
  MEALS,
  MIN_QUANTITY_MILLI,
} from "../domain/food-log";
import { ENERGY_GOAL_KCAL, PROTEIN_GOAL_G, WATER_GOAL_ML, WATER_SERVING_ML } from "../domain/goals";
import { INJECTION_SITES } from "../domain/injection";
import { LANGUAGE_PREFERENCES } from "../domain/language";
import { MAX_LENGTH_MM, MEASUREMENT_SITES, MIN_LENGTH_MM } from "../domain/measurement";
import { SIDE_EFFECT_TYPES } from "../domain/side-effect";
import { MAX_WATER_ENTRY_ML } from "../domain/water";
import { WEIGHT_SOURCES, WEIGHT_UNITS } from "../domain/weight";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at").notNull();
const updatedAt = () => integer("updated_at").notNull();
const localDate = (name: string) => text(name).notNull();

/** Inlines constant enum values into a CHECK. Only ever called with literals defined in code. */
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", "));
/** Inlines a numeric constant defined in code into a CHECK. */
const num = (value: number) => sql.raw(String(value));
const DATE_GLOB = sql.raw("'[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'");
const nutrientsWithin = (max: number, ...columns: SQLiteColumn[]) =>
  sql.join(
    columns.map((c) => sql`coalesce(${c}, 0) BETWEEN 0 AND ${num(max)}`),
    sql` AND `,
  );

/** Single row (id = 1). */
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    weightUnit: text("weight_unit", { enum: WEIGHT_UNITS }).notNull().default("kg"),
    goalWeightG: integer("goal_weight_g"),
    injectionReminderEnabled: integer("injection_reminder_enabled", { mode: "boolean" }).notNull().default(false),
    /** Minutes after local midnight, e.g. 540 = 09:00. */
    injectionReminderMinute: integer("injection_reminder_minute").notNull().default(540),
    weighInReminderEnabled: integer("weigh_in_reminder_enabled", { mode: "boolean" }).notNull().default(false),
    weighInReminderMinute: integer("weigh_in_reminder_minute").notNull().default(450),
    /** Read weight from Health Connect. Off until the user turns it on and grants access. */
    healthConnectEnabled: integer("health_connect_enabled", { mode: "boolean" }).notNull().default(false),
    /** End of the last successful Health Connect read (epoch ms); the next sync starts near it. */
    healthConnectSyncedAt: integer("health_connect_synced_at"),
    /** When the user finished the welcome screens (epoch ms). Null shows them; "Delete all data" resets it. */
    welcomedAt: integer("welcomed_at"),
    /** UI language; "system" follows the phone. */
    language: text("language", { enum: LANGUAGE_PREFERENCES }).notNull().default("system"),
    /** The user's own daily goals; Tenulo never suggests one. */
    energyGoalKcal: integer("energy_goal_kcal"),
    proteinGoalG: integer("protein_goal_g"),
    waterGoalMl: integer("water_goal_ml"),
    /** What one tap of "+ glass" adds. */
    waterServingMl: integer("water_serving_ml").notNull().default(WATER_SERVING_ML.default),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_weight_unit", sql`${t.weightUnit} IN (${oneOf(WEIGHT_UNITS)})`),
    check("settings_goal_range", sql`${t.goalWeightG} IS NULL OR ${t.goalWeightG} BETWEEN 20000 AND 400000`),
    check("settings_injection_minute", sql`${t.injectionReminderMinute} BETWEEN 0 AND 1439`),
    check("settings_weigh_in_minute", sql`${t.weighInReminderMinute} BETWEEN 0 AND 1439`),
    check("settings_language", sql`${t.language} IN (${oneOf(LANGUAGE_PREFERENCES)})`),
    check(
      "settings_energy_goal",
      sql`${t.energyGoalKcal} IS NULL OR ${t.energyGoalKcal} BETWEEN ${num(ENERGY_GOAL_KCAL.min)} AND ${num(ENERGY_GOAL_KCAL.max)}`,
    ),
    check(
      "settings_protein_goal",
      sql`${t.proteinGoalG} IS NULL OR ${t.proteinGoalG} BETWEEN ${num(PROTEIN_GOAL_G.min)} AND ${num(PROTEIN_GOAL_G.max)}`,
    ),
    check(
      "settings_water_goal",
      sql`${t.waterGoalMl} IS NULL OR ${t.waterGoalMl} BETWEEN ${num(WATER_GOAL_ML.min)} AND ${num(WATER_GOAL_ML.max)}`,
    ),
    check(
      "settings_water_serving",
      sql`${t.waterServingMl} BETWEEN ${num(WATER_SERVING_ML.min)} AND ${num(WATER_SERVING_ML.max)}`,
    ),
  ],
);

export const weightEntries = sqliteTable(
  "weight_entry",
  {
    id: id(),
    measuredAt: integer("measured_at").notNull(),
    localDate: localDate("local_date"),
    weightG: integer("weight_g").notNull(),
    source: text("source", { enum: WEIGHT_SOURCES }).notNull(),
    /** Health Connect record id; unique so a repeated import never duplicates a reading. */
    healthConnectId: text("health_connect_id"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("weight_entry_local_date").on(t.localDate),
    uniqueIndex("weight_entry_hc_id").on(t.healthConnectId),
    check("weight_entry_range", sql`${t.weightG} BETWEEN 20000 AND 400000`),
    check("weight_entry_source", sql`${t.source} IN (${oneOf(WEIGHT_SOURCES)})`),
    check("weight_entry_local_date", sql`${t.localDate} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`),
    check(
      "weight_entry_hc_source",
      sql`(${t.source} = 'health_connect') = (${t.healthConnectId} IS NOT NULL)`,
    ),
  ],
);

/** A medication the user takes. The name is free text; Tenulo ships no drug list. */
export const medications = sqliteTable(
  "medication",
  {
    id: id(),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("medication_name", sql`length(trim(${t.name})) BETWEEN 1 AND 60`)],
);

/** One step of the user's own schedule. Tenulo displays it; it never proposes one. */
export const planSteps = sqliteTable(
  "plan_step",
  {
    id: id(),
    medicationId: text("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    startDate: localDate("start_date"),
    doseMcg: integer("dose_mcg").notNull(),
    intervalDays: integer("interval_days").notNull().default(7),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plan_step_medication_start").on(t.medicationId, t.startDate),
    check("plan_step_dose", sql`${t.doseMcg} > 0`),
    check("plan_step_interval", sql`${t.intervalDays} BETWEEN 1 AND 90`),
  ],
);

export const injections = sqliteTable(
  "injection",
  {
    id: id(),
    medicationId: text("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "restrict" }),
    takenAt: integer("taken_at").notNull(),
    localDate: localDate("local_date"),
    doseMcg: integer("dose_mcg").notNull(),
    site: text("site", { enum: INJECTION_SITES }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("injection_medication_date").on(t.medicationId, t.localDate),
    check("injection_dose", sql`${t.doseMcg} > 0`),
    check("injection_site", sql`${t.site} IS NULL OR ${t.site} IN (${oneOf(INJECTION_SITES)})`),
  ],
);

export const sideEffects = sqliteTable(
  "side_effect",
  {
    id: id(),
    localDate: localDate("local_date"),
    type: text("type", { enum: SIDE_EFFECT_TYPES }).notNull(),
    /** 1 mild, 2 moderate, 3 severe; the user's own rating. */
    severity: integer("severity").notNull(),
    injectionId: text("injection_id").references(() => injections.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("side_effect_local_date").on(t.localDate),
    check("side_effect_severity", sql`${t.severity} BETWEEN 1 AND 3`),
    check("side_effect_type", sql`${t.type} IN (${oneOf(SIDE_EFFECT_TYPES)})`),
  ],
);

/** A food the user defined, by the serving they eat. Logged entries keep their own copy of its values. */
export const customFoods = sqliteTable(
  "custom_food",
  {
    id: id(),
    name: text("name").notNull(),
    servingLabel: text("serving_label").notNull(),
    servingGrams: integer("serving_grams"),
    energyKcal: integer("energy_kcal").notNull(),
    proteinMg: integer("protein_mg"),
    carbMg: integer("carb_mg"),
    fatMg: integer("fat_mg"),
    fiberMg: integer("fiber_mg"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("custom_food_name", sql`length(trim(${t.name})) BETWEEN 1 AND 60`),
    check("custom_food_serving_label", sql`length(trim(${t.servingLabel})) BETWEEN 1 AND 40`),
    check("custom_food_serving_grams", sql`${t.servingGrams} IS NULL OR ${t.servingGrams} BETWEEN 1 AND 5000`),
    check("custom_food_energy", sql`${t.energyKcal} BETWEEN 0 AND ${num(MAX_SERVING_KCAL)}`),
    check(
      "custom_food_nutrients",
      nutrientsWithin(MAX_SERVING_NUTRIENT_G * 1000, t.proteinMg, t.carbMg, t.fatMg, t.fiberMg),
    ),
  ],
);

/**
 * One food eaten at one meal. Name, portion and nutrients are a snapshot taken when it was logged,
 * so a regenerated food list or an edited custom food never rewrites history.
 */
export const foodEntries = sqliteTable(
  "food_entry",
  {
    id: id(),
    localDate: localDate("local_date"),
    loggedAt: integer("logged_at").notNull(),
    meal: text("meal", { enum: MEALS }).notNull(),
    /** Id in the bundled food list (src/domain/foods). */
    catalogFoodId: text("catalog_food_id"),
    customFoodId: text("custom_food_id").references(() => customFoods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    portionLabel: text("portion_label").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    grams: integer("grams"),
    energyKcal: integer("energy_kcal").notNull(),
    proteinMg: integer("protein_mg"),
    carbMg: integer("carb_mg"),
    fatMg: integer("fat_mg"),
    fiberMg: integer("fiber_mg"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("food_entry_local_date").on(t.localDate),
    check("food_entry_local_date", sql`${t.localDate} GLOB ${DATE_GLOB}`),
    check("food_entry_meal", sql`${t.meal} IN (${oneOf(MEALS)})`),
    check("food_entry_one_source", sql`${t.catalogFoodId} IS NULL OR ${t.customFoodId} IS NULL`),
    check("food_entry_name", sql`length(trim(${t.name})) BETWEEN 1 AND 80`),
    check("food_entry_portion", sql`length(trim(${t.portionLabel})) BETWEEN 1 AND 40`),
    check(
      "food_entry_quantity",
      sql`${t.quantityMilli} BETWEEN ${num(MIN_QUANTITY_MILLI)} AND ${num(MAX_QUANTITY_MILLI)}`,
    ),
    check("food_entry_grams", sql`${t.grams} IS NULL OR ${t.grams} BETWEEN 0 AND 100000`),
    check("food_entry_energy", sql`${t.energyKcal} BETWEEN 0 AND ${num(MAX_ENTRY_KCAL)}`),
    check("food_entry_nutrients", nutrientsWithin(MAX_NUTRIENT_MG, t.proteinMg, t.carbMg, t.fatMg, t.fiberMg)),
  ],
);

export const waterEntries = sqliteTable(
  "water_entry",
  {
    id: id(),
    localDate: localDate("local_date"),
    loggedAt: integer("logged_at").notNull(),
    amountMl: integer("amount_ml").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("water_entry_local_date").on(t.localDate),
    check("water_entry_local_date", sql`${t.localDate} GLOB ${DATE_GLOB}`),
    check("water_entry_amount", sql`${t.amountMl} BETWEEN 1 AND ${num(MAX_WATER_ENTRY_ML)}`),
  ],
);

export const measurementEntries = sqliteTable(
  "measurement_entry",
  {
    id: id(),
    localDate: localDate("local_date"),
    measuredAt: integer("measured_at").notNull(),
    site: text("site", { enum: MEASUREMENT_SITES }).notNull(),
    lengthMm: integer("length_mm").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("measurement_entry_site_date").on(t.site, t.localDate),
    check("measurement_entry_local_date", sql`${t.localDate} GLOB ${DATE_GLOB}`),
    check("measurement_entry_site", sql`${t.site} IN (${oneOf(MEASUREMENT_SITES)})`),
    check("measurement_entry_length", sql`${t.lengthMm} BETWEEN ${num(MIN_LENGTH_MM)} AND ${num(MAX_LENGTH_MM)}`),
  ],
);

export const exerciseEntries = sqliteTable(
  "exercise_entry",
  {
    id: id(),
    localDate: localDate("local_date"),
    loggedAt: integer("logged_at").notNull(),
    kind: text("kind", { enum: EXERCISE_KINDS }).notNull(),
    durationMin: integer("duration_min").notNull(),
    intensity: text("intensity", { enum: INTENSITIES }).notNull(),
    /** Only what the user entered; estimates are computed for display and never stored. */
    energyKcal: integer("energy_kcal"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("exercise_entry_local_date").on(t.localDate),
    check("exercise_entry_local_date", sql`${t.localDate} GLOB ${DATE_GLOB}`),
    check("exercise_entry_kind", sql`${t.kind} IN (${oneOf(EXERCISE_KINDS)})`),
    check("exercise_entry_intensity", sql`${t.intensity} IN (${oneOf(INTENSITIES)})`),
    check("exercise_entry_duration", sql`${t.durationMin} BETWEEN 1 AND ${num(MAX_DURATION_MIN)}`),
    check(
      "exercise_entry_energy",
      sql`${t.energyKcal} IS NULL OR ${t.energyKcal} BETWEEN 0 AND ${num(MAX_EXERCISE_KCAL)}`,
    ),
  ],
);
