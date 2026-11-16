/**
 * The kinds of record that messages count or point at. Shared by the dictionaries (which name them)
 * and the formatters (which pick them out of a restore summary or a backup error path).
 */

/** Tables in a backup file, by their key under `data` (see src/domain/backup.ts). */
export const BACKUP_RECORDS = [
  "weights",
  "medications",
  "planSteps",
  "injections",
  "sideEffects",
  "customFoods",
  "foodEntries",
  "waterEntries",
  "measurements",
  "exercises",
] as const;
export type BackupRecord = (typeof BACKUP_RECORDS)[number];

export function isBackupRecord(value: unknown): value is BackupRecord {
  return typeof value === "string" && (BACKUP_RECORDS as readonly string[]).includes(value);
}

/** What a restore (or a Health Connect read) added, in the order a summary lists it. */
export const RESTORE_COUNTS = [
  "weights",
  "injections",
  "sideEffects",
  "planSteps",
  "medications",
  "foodEntries",
  "customFoods",
  "waterEntries",
  "measurements",
  "exercises",
] as const satisfies readonly BackupRecord[];
export type RestoreCountKey = (typeof RESTORE_COUNTS)[number];
export type RestoreCounts = Partial<Record<RestoreCountKey, number>>;
