import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { db } from "@/db/client";
import { type RestoreSummary, restoreData } from "@/db/ops";
import { injections, medications, planSteps, settings, sideEffects, weightEntries } from "@/db/schema";
import {
  type Backup,
  type BackupData,
  type ParseBackupResult,
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
} from "@/domain/backup";
import { today } from "./repo";


/** Everything on the phone, in backup form. */
export async function snapshot(): Promise<BackupData> {
  const [s] = await db.select().from(settings).limit(1);
  return {
    settings:
      s === undefined
        ? null
        : {
            weightUnit: s.weightUnit,
            goalWeightG: s.goalWeightG,
            injectionReminderEnabled: s.injectionReminderEnabled,
            injectionReminderMinute: s.injectionReminderMinute,
            weighInReminderEnabled: s.weighInReminderEnabled,
            weighInReminderMinute: s.weighInReminderMinute,
          },
    weights: await db.select().from(weightEntries),
    medications: await db.select().from(medications),
    planSteps: await db.select().from(planSteps),
    injections: await db.select().from(injections),
    sideEffects: await db.select().from(sideEffects),
    // Rows come from the database, whose CHECKs match the backup schema; only the LocalDate brand
    // on the date columns is missing from Drizzle's row types.
  } as BackupData;
}

/**
 * Writes the backup to the app's cache and opens the share sheet. The user chooses where it goes
 * (Drive, email, a USB stick); Tenulo itself sends it nowhere.
 */
export async function exportBackup(): Promise<void> {
  const backup = createBackup(await snapshot(), Date.now(), Constants.expoConfig?.version ?? "unknown");
  const file = new File(Paths.cache, backupFileName(today()));
  file.create({ overwrite: true });
  await file.write(serializeBackup(backup));
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Save your Tenulo backup" });
}

export type PickResult = { readonly canceled: true } | ({ readonly canceled: false } & ParseBackupResult);

/** Lets the user pick a backup file and validates it. Nothing is written yet. */
export async function pickBackup(): Promise<PickResult> {
  const picked = await File.pickFileAsync({ mimeTypes: ["application/json", "text/*", "application/octet-stream"] });
  if (picked.canceled) return { canceled: true };
  return { canceled: false, ...parseBackup(await picked.result.text()) };
}

export type { RestoreSummary };

/**
 * Adds every record from the backup that is not on the phone yet, in one transaction; nothing on
 * the phone is changed or removed. See restoreData for the exact rules.
 */
export function restoreBackup(backup: Backup): RestoreSummary {
  return restoreData(db, backup.data, Date.now());
}
