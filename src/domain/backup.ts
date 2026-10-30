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
import { ULID_PATTERN } from "./id";
import { INJECTION_SITES } from "./injection";
import { MAX_DOSE_MCG, MIN_DOSE_MCG } from "./parse";
import { SIDE_EFFECT_TYPES } from "./side-effect";
import { MAX_WEIGHT_G, MIN_WEIGHT_G, WEIGHT_SOURCES, WEIGHT_UNITS } from "./weight";

export const BACKUP_FORMAT = "tenulo-backup";
/** Bump when the shape changes; older versions must stay readable. */
export const BACKUP_VERSION = 1;

const MAX_NOTE = 1_000;
const MINUTES_PER_DAY = 1_440;

const id = z.string().regex(ULID_PATTERN, "Not a Tenulo id");
const instant = z.number().int().nonnegative();
const localDate = z.string().refine(isLocalDate, "Not a calendar date");
const note = z.string().max(MAX_NOTE).nullable();
const minuteOfDay = z.number().int().min(0).max(MINUTES_PER_DAY - 1);
const dose = z.number().int().min(MIN_DOSE_MCG).max(MAX_DOSE_MCG);
const timestamps = { createdAt: instant, updatedAt: instant };

const settingsSchema = z.object({
  weightUnit: z.enum(WEIGHT_UNITS),
  goalWeightG: z.number().int().min(MIN_WEIGHT_G).max(MAX_WEIGHT_G).nullable(),
  injectionReminderEnabled: z.boolean(),
  injectionReminderMinute: minuteOfDay,
  weighInReminderEnabled: z.boolean(),
  weighInReminderMinute: minuteOfDay,
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

const dataSchema = z
  .object({
    settings: settingsSchema.nullable(),
    weights: z.array(weightSchema),
    medications: z.array(medicationSchema),
    planSteps: z.array(planStepSchema),
    injections: z.array(injectionSchema),
    sideEffects: z.array(sideEffectSchema),
  })
  .superRefine((d, ctx) => {
    const tables = [d.weights, d.medications, d.planSteps, d.injections, d.sideEffects] as const;
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
  });

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: instant,
  appVersion: z.string().max(40),
  data: dataSchema,
});

export type BackupData = z.infer<typeof dataSchema>;
export type BackupSettings = z.infer<typeof settingsSchema>;
export type Backup = z.infer<typeof backupSchema>;

export type ParseBackupResult =
  | { readonly ok: true; readonly backup: Backup }
  | { readonly ok: false; readonly reason: "not-json" | "not-a-backup" | "newer-version" }
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
