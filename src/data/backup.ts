import { eq } from "drizzle-orm";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { db } from "@/db/client";
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

/** Rows per INSERT: 200 rows x 10 columns stays far below SQLite's bound-variable limit. */
const INSERT_CHUNK = 200;

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

export interface RestoreSummary {
  readonly weights: number;
  readonly injections: number;
  readonly sideEffects: number;
  readonly medications: number;
  readonly planSteps: number;
}

/**
 * Adds every record from the backup that is not on the phone yet, in one transaction. Nothing on
 * the phone is changed or removed: a record whose id (or Health Connect id, or plan date) already
 * exists is skipped. Settings are taken from the backup only on a phone with no records yet.
 */
export async function restoreBackup(backup: Backup): Promise<RestoreSummary> {
  const d = backup.data;
  return db.transaction(async (tx) => {
    const hadRecords =
      (await tx.select({ id: weightEntries.id }).from(weightEntries).limit(1)).length > 0 ||
      (await tx.select({ id: medications.id }).from(medications).limit(1)).length > 0;

    /** Inserts in chunks (SQLite caps bound variables per statement) and counts the new rows. */
    async function insertAll<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<{ id: string }[]>): Promise<number> {
      let added = 0;
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) added += (await insert(rows.slice(i, i + INSERT_CHUNK))).length;
      return added;
    }
    // Parents before children, so every foreign key already resolves.
    const medicationsAdded = await insertAll(d.medications, (c) =>
      tx.insert(medications).values(c).onConflictDoNothing().returning({ id: medications.id }),
    );
    const planStepsAdded = await insertAll(d.planSteps, (c) =>
      tx.insert(planSteps).values(c).onConflictDoNothing().returning({ id: planSteps.id }),
    );
    const injectionsAdded = await insertAll(d.injections, (c) =>
      tx.insert(injections).values(c).onConflictDoNothing().returning({ id: injections.id }),
    );
    const sideEffectsAdded = await insertAll(d.sideEffects, (c) =>
      tx.insert(sideEffects).values(c).onConflictDoNothing().returning({ id: sideEffects.id }),
    );
    const weightsAdded = await insertAll(d.weights, (c) =>
      tx.insert(weightEntries).values(c).onConflictDoNothing().returning({ id: weightEntries.id }),
    );

    if (!hadRecords && d.settings !== null) {
      await tx
        .update(settings)
        .set({ weightUnit: d.settings.weightUnit, goalWeightG: d.settings.goalWeightG, updatedAt: Date.now() })
        .where(eq(settings.id, 1));
    }
    return {
      weights: weightsAdded,
      injections: injectionsAdded,
      sideEffects: sideEffectsAdded,
      medications: medicationsAdded,
      planSteps: planStepsAdded,
    };
  });
}
