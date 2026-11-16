import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { db } from "@/db/client";
import { type RestoreSummary, readBackupData, restoreData } from "@/db/ops";
import {
  type Backup,
  type ParseBackupResult,
  backupFileName,
  backupTooLarge,
  createBackup,
  parseBackup,
  serializeBackup,
} from "@/domain/backup";
import { today } from "./repo";

/**
 * Writes the backup to the app's cache and opens the share sheet. The user chooses where it goes
 * (Drive, email, a USB stick); Tenulo itself sends it nowhere.
 */
export async function exportBackup(dialogTitle: string): Promise<void> {
  const backup = createBackup(readBackupData(db), Date.now(), Constants.expoConfig?.version ?? "unknown");
  const file = new File(Paths.cache, backupFileName(today()));
  file.create({ overwrite: true });
  await file.write(serializeBackup(backup));
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle });
}

export type PickResult = { readonly canceled: true } | ({ readonly canceled: false } & ParseBackupResult);

/** Lets the user pick a backup file and validates it. Nothing is written yet. */
export async function pickBackup(): Promise<PickResult> {
  const picked = await File.pickFileAsync({ mimeTypes: ["application/json", "text/*", "application/octet-stream"] });
  if (picked.canceled) return { canceled: true };
  // Checked before reading: a wrong pick (a video, say) must not be loaded into memory.
  if (backupTooLarge(picked.result.size)) return { canceled: false, ok: false, reason: "too-large" };
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
