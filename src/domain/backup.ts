/**
 * Tenulo's backup file: every record on the phone as one versioned JSON document.
 *
 * The file is created on the device and leaves it only through the share sheet, where the user
 * picks the destination. Restoring validates the whole file before a single row is written: a
 * hand-edited or truncated backup is rejected instead of half-imported. The rules below mirror the
 * database CHECK constraints, so anything that passes here also passes the database.
 */
import { z } from "zod";
import { type LocalDate, isLocalDate } from "./date";
import { EXERCISE_KINDS, INTENSITIES, MAX_DURATION_MIN, MAX_EXERCISE_KCAL } from "./exercise";
import {
  MAX_ENTRY_KCAL,
  MAX_NUTRIENT_MG,
  MAX_QUANTITY_MILLI,
  MAX_SERVING_KCAL,
  MAX_SERVING_NUTRIENT_G,
  MEALS,
  MIN_QUANTITY_MILLI,
} from "./food-log";
import { ENERGY_GOAL_KCAL, PROTEIN_GOAL_G, WATER_GOAL_ML, WATER_SERVING_ML } from "./goals";
import { ULID_PATTERN } from "./id";
import { INJECTION_SITES } from "./injection";
import { BODY_FIGURES, DEFAULT_BODY_FIGURE } from "./body-figure";
import { LANGUAGE_PREFERENCES } from "./language";
import { MAX_LENGTH_MM, MEASUREMENT_SITES, MIN_LENGTH_MM } from "./measurement";
import { MAX_DOSE_MCG, MIN_DOSE_MCG } from "./parse";
import { SIDE_EFFECT_TYPES } from "./side-effect";
import { MAX_WATER_ENTRY_ML } from "./water";
import { MAX_WEIGHT_G, MIN_WEIGHT_G, WEIGHT_SOURCES, WEIGHT_UNITS } from "./weight";

export const BACKUP_FORMAT = "tenulo-backup";
/**
 * Bump when the shape changes; older versions must stay readable.
 * 1: Tenulo 1.0. 2: adds the daily log (food, custom foods, water, measurements, exercise), the
 * language and the daily goals; a version 1 file reads as one with none of them.
 */
export const BACKUP_VERSION = 2;

/**
 * Far above any real backup (ten years of daily records is about 1.5 MB). A file bigger than this
 * was picked by mistake (a video, say) and is refused before it is read into memory.
 */
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

/** Whether a file of this many bytes is too large to read as a backup. Unknown size: let parseBackup decide. */
export function backupTooLarge(bytes: number | null): boolean {
  return bytes !== null && bytes > MAX_BACKUP_BYTES;
}

const MAX_NOTE = 1_000;
const MINUTES_PER_DAY = 1_440;

const id = z.string().regex(ULID_PATTERN, "Not a Tenulo id");
const instant = z.number().int().nonnegative();
const localDate = z.string().refine(isLocalDate, "Not a calendar date");
const note = z.string().max(MAX_NOTE).nullable();
const minuteOfDay = z.number().int().min(0).max(MINUTES_PER_DAY - 1);
const dose = z.number().int().min(MIN_DOSE_MCG).max(MAX_DOSE_MCG);
const timestamps = { createdAt: instant, updatedAt: instant };

const wholeIn = (r: { min: number; max: number }) => z.number().int().min(r.min).max(r.max);
/** Integer milligrams of one nutrient, or null when unknown. */
const nutrientMg = (max: number) => z.number().int().min(0).max(max).nullable();

const settingsSchema = z.object({
  weightUnit: z.enum(WEIGHT_UNITS),
  goalWeightG: z.number().int().min(MIN_WEIGHT_G).max(MAX_WEIGHT_G).nullable(),
  injectionReminderEnabled: z.boolean(),
  injectionReminderMinute: minuteOfDay,
  weighInReminderEnabled: z.boolean(),
  weighInReminderMinute: minuteOfDay,
  // Version 2; the defaults are what a version 1 file means.
  language: z.enum(LANGUAGE_PREFERENCES).default("system"),
  energyGoalKcal: wholeIn(ENERGY_GOAL_KCAL).nullable().default(null),
  proteinGoalG: wholeIn(PROTEIN_GOAL_G).nullable().default(null),
  waterGoalMl: wholeIn(WATER_GOAL_ML).nullable().default(null),
  waterServingMl: wholeIn(WATER_SERVING_ML).default(WATER_SERVING_ML.default),
  // Added within version 2: a file without it was made before the figure could be chosen.
  bodyFigure: z.enum(BODY_FIGURES).default(DEFAULT_BODY_FIGURE),
});

const weightSchema = z
  .object({
    id,
    measuredAt: instant,
    localDate,
    weightG: z.number().int().min(MIN_WEIGHT_G).max(MAX_WEIGHT_G),
    source: z.enum(WEIGHT_SOURCES),
    healthConnectId: z.string().min(1).max(200).nullable(),
    note,
    ...timestamps,
  })
  .refine((w) => (w.source === "health_connect") === (w.healthConnectId !== null), {
    message: "Only Health Connect readings carry a Health Connect id",
  });

const medicationSchema = z.object({
  id,
  name: z.string().refine((n) => n.trim().length >= 1 && n.trim().length <= 60, "Name must be 1-60 characters"),
  active: z.boolean(),
  ...timestamps,
});

const planStepSchema = z.object({
  id,
  medicationId: id,
  startDate: localDate,
  doseMcg: dose,
  intervalDays: z.number().int().min(1).max(90),
  ...timestamps,
});

const injectionSchema = z.object({
  id,
  medicationId: id,
  takenAt: instant,
  localDate,
  doseMcg: dose,
  site: z.enum(INJECTION_SITES).nullable(),
  note,
  ...timestamps,
});

const sideEffectSchema = z.object({
  id,
  localDate,
  type: z.enum(SIDE_EFFECT_TYPES),
  severity: z.number().int().min(1).max(3),
  injectionId: id.nullable(),
  note,
  ...timestamps,
});

/** SQLite's trim(): spaces only, so the backup accepts exactly what the database CHECKs accept. */
const sqliteTrim = (s: string) => s.replace(/^ +| +$/g, "");
const trimmedLength = (min: number, max: number) =>
  z.string().refine((s) => sqliteTrim(s).length >= min && sqliteTrim(s).length <= max, `Must be ${min}-${max} characters`);

const customFoodSchema = z.object({
  id,
  name: trimmedLength(1, 60),
  servingLabel: trimmedLength(1, 40),
  servingGrams: z.number().int().min(1).max(5000).nullable(),
  energyKcal: z.number().int().min(0).max(MAX_SERVING_KCAL),
  proteinMg: nutrientMg(MAX_SERVING_NUTRIENT_G * 1000),
  carbMg: nutrientMg(MAX_SERVING_NUTRIENT_G * 1000),
  fatMg: nutrientMg(MAX_SERVING_NUTRIENT_G * 1000),
  fiberMg: nutrientMg(MAX_SERVING_NUTRIENT_G * 1000),
  ...timestamps,
});

/** Ids in the bundled food list: lowercase kebab-case. */
export const CATALOG_FOOD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const foodEntrySchema = z
  .object({
    id,
    localDate,
    loggedAt: instant,
    meal: z.enum(MEALS),
    catalogFoodId: z.string().max(80).regex(CATALOG_FOOD_ID, "Not a food list id").nullable(),
    customFoodId: id.nullable(),
    name: trimmedLength(1, 80),
    portionId: z.string().max(40).regex(CATALOG_FOOD_ID, "Not a portion id").nullable(),
    portionLabel: trimmedLength(1, 40),
    quantityMilli: z.number().int().min(MIN_QUANTITY_MILLI).max(MAX_QUANTITY_MILLI),
    grams: z.number().int().min(0).max(100_000).nullable(),
    energyKcal: z.number().int().min(0).max(MAX_ENTRY_KCAL),
    proteinMg: nutrientMg(MAX_NUTRIENT_MG),
    carbMg: nutrientMg(MAX_NUTRIENT_MG),
    fatMg: nutrientMg(MAX_NUTRIENT_MG),
    fiberMg: nutrientMg(MAX_NUTRIENT_MG),
    ...timestamps,
  })
  .refine((f) => f.catalogFoodId === null || f.customFoodId === null, {
    message: "A food comes from the food list or from the user's own foods, not both",
  });

const waterEntrySchema = z.object({
  id,
  localDate,
  loggedAt: instant,
  amountMl: z.number().int().min(1).max(MAX_WATER_ENTRY_ML),
  ...timestamps,
});

const measurementSchema = z.object({
  id,
  localDate,
  measuredAt: instant,
  site: z.enum(MEASUREMENT_SITES),
  lengthMm: z.number().int().min(MIN_LENGTH_MM).max(MAX_LENGTH_MM),
  note,
  ...timestamps,
});

const exerciseSchema = z.object({
  id,
  localDate,
  loggedAt: instant,
  kind: z.enum(EXERCISE_KINDS),
  durationMin: z.number().int().min(1).max(MAX_DURATION_MIN),
  intensity: z.enum(INTENSITIES),
  energyKcal: z.number().int().min(0).max(MAX_EXERCISE_KCAL).nullable(),
  note,
  ...timestamps,
});

const dataSchema = z
  .object({
    settings: settingsSchema.nullable(),
    weights: z.array(weightSchema),
    medications: z.array(medicationSchema),
    planSteps: z.array(planStepSchema),
    injections: z.array(injectionSchema),
    sideEffects: z.array(sideEffectSchema),
    // Version 2; a version 1 file has none.
    customFoods: z.array(customFoodSchema).default([]),
    foodEntries: z.array(foodEntrySchema).default([]),
    waterEntries: z.array(waterEntrySchema).default([]),
    measurements: z.array(measurementSchema).default([]),
    exercises: z.array(exerciseSchema).default([]),
  })
  .superRefine((d, ctx) => {
    const tables = [
      d.weights,
      d.medications,
      d.planSteps,
      d.injections,
      d.sideEffects,
      d.customFoods,
      d.foodEntries,
      d.waterEntries,
      d.measurements,
      d.exercises,
    ] as const;
    for (const rows of tables) {
      if (new Set(rows.map((r) => r.id)).size !== rows.length) {
        ctx.addIssue({ code: "custom", message: "Duplicate id in backup" });
      }
    }
    const medicationIds = new Set(d.medications.map((m) => m.id));
    const injectionIds = new Set(d.injections.map((i) => i.id));
    if (d.planSteps.some((s) => !medicationIds.has(s.medicationId))) {
      ctx.addIssue({ code: "custom", message: "Plan step for a medication not in the backup" });
    }
    if (d.injections.some((i) => !medicationIds.has(i.medicationId))) {
      ctx.addIssue({ code: "custom", message: "Injection for a medication not in the backup" });
    }
    if (d.sideEffects.some((e) => e.injectionId !== null && !injectionIds.has(e.injectionId))) {
      ctx.addIssue({ code: "custom", message: "Side effect linked to an injection not in the backup" });
    }
    const customFoodIds = new Set(d.customFoods.map((f) => f.id));
    if (d.foodEntries.some((f) => f.customFoodId !== null && !customFoodIds.has(f.customFoodId))) {
      ctx.addIssue({ code: "custom", message: "Food entry for a custom food not in the backup" });
    }
  });

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: instant,
  appVersion: z.string().max(40),
  data: dataSchema,
});

export type BackupData = z.infer<typeof dataSchema>;
export type BackupSettings = z.infer<typeof settingsSchema>;
export type Backup = z.infer<typeof backupSchema>;

export type ParseBackupResult =
  | { readonly ok: true; readonly backup: Backup }
  | { readonly ok: false; readonly reason: "not-json" | "not-a-backup" | "newer-version" | "too-large" }
  | {
      readonly ok: false;
      readonly reason: "invalid";
      /** The first problem, in Zod's words. */
      readonly detail: string;
      /** Where it is, e.g. ["data", "weights", 3, "weightG"]; empty for whole-backup checks. */
      readonly path: readonly PropertyKey[];
    };

export function createBackup(data: BackupData, exportedAt: number, appVersion: string): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, appVersion, data };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): ParseBackupResult {
  // The second line of defence when the file's size was unknown before reading it.
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: "too-large" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  const header = z.object({ format: z.literal(BACKUP_FORMAT), version: z.number().int() }).safeParse(json);
  if (!header.success) return { ok: false, reason: "not-a-backup" };
  if (header.data.version > BACKUP_VERSION) return { ok: false, reason: "newer-version" };

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, reason: "invalid", detail: first?.message ?? "Invalid backup", path: first?.path ?? [] };
  }
  return { ok: true, backup: parsed.data };
}

export function backupFileName(today: LocalDate): string {
  return `tenulo-backup-${today}.json`;
}
