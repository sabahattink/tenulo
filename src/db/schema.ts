/**
 * Tenulo's on-device database. Nothing here is ever sent off the device.
 *
 * Conventions:
 *  - Ids are ULIDs (text): sortable by creation time, generated offline, safe to merge on restore.
 *  - Instants are UTC epoch milliseconds (integer). Calendar dates are `YYYY-MM-DD` text, the
 *    user's local date at the time of the event, so history never shifts when they travel.
 *  - Weights are integer grams, doses integer micrograms. No floats are stored.
 *  - Enumerations are text with CHECK constraints, so bad values fail at the database too.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { INJECTION_SITES } from "../domain/injection";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at").notNull();
const updatedAt = () => integer("updated_at").notNull();
const localDate = (name: string) => text(name).notNull();

/** Inlines constant enum values into a CHECK. Only ever called with literals defined in code. */
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", "));

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export const WEIGHT_SOURCES = ["manual", "health_connect"] as const;
export const SIDE_EFFECT_TYPES = [
  "nausea",
  "vomiting",
  "constipation",
  "diarrhea",
  "heartburn",
  "fatigue",
  "headache",
  "injection-site",
  "other",
] as const;

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
    updatedAt: updatedAt(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_weight_unit", sql`${t.weightUnit} IN (${oneOf(WEIGHT_UNITS)})`),
    check("settings_goal_range", sql`${t.goalWeightG} IS NULL OR ${t.goalWeightG} BETWEEN 20000 AND 400000`),
    check("settings_injection_minute", sql`${t.injectionReminderMinute} BETWEEN 0 AND 1439`),
    check("settings_weigh_in_minute", sql`${t.weighInReminderMinute} BETWEEN 0 AND 1439`),
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
