/**
 * Every multi-statement write, and the backup read, as one real transaction.
 *
 * Drizzle's expo-sqlite driver is synchronous: `transaction()` commits as soon as its callback
 * returns. An `async` callback returns at its first `await`, so the rest would run outside the
 * transaction and a failure would never roll back. Everything here therefore uses the synchronous
 * query API (`.run()`, `.all()`) inside a synchronous callback. Tested against the real driver in
 * ops.test.ts.
 */
import { eq, sql } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite/driver";
import type { BackupData } from "../domain/backup";
import type { LocalDate } from "../domain/date";
import type { ImportedWeight } from "../domain/health-connect";
import { ulid } from "../domain/id";
import type * as schema from "./schema";
import {
  customFoods,
  exerciseEntries,
  foodEntries,
  injections,
  measurementEntries,
  medications,
  planSteps,
  settings,
  sideEffects,
  waterEntries,
  weightEntries,
} from "./schema";
import { ALL_TABLES_DELETE_ORDER } from "./tables";

export type SyncDb = ExpoSQLiteDatabase<typeof schema>;

/** Rows per INSERT: 200 rows x 10 columns stays far below SQLite's bound-variable limit. */
const INSERT_CHUNK = 200;

function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) out.push(rows.slice(i, i + INSERT_CHUNK));
  return out;
}

/**
 * "Delete all data": every row of every table, then a fresh settings row. All or nothing.
 *
 * The always-true WHERE is load-bearing. Without one, SQLite clears a table that has no triggers
 * or foreign keys in a single step (the truncate optimization) and skips the update hook, so
 * expo-sqlite reports no change and open screens keep showing the deleted rows.
 */
export function wipeAll(database: SyncDb, now: number): void {
  database.transaction((tx) => {
    for (const table of ALL_TABLES_DELETE_ORDER) tx.delete(table).where(sql`1`).run();
    tx.insert(settings).values({ id: 1, updatedAt: now }).run();
  });
}

/**
 * After "Delete all data": leaves no byte of a deleted record in the database's files.
 *
 * Deleted rows are only marked free; their bytes stay in the database file and, in WAL mode, in
 * earlier copies of each page in the write-ahead log. VACUUM rebuilds the file from the rows that
 * are left, and a TRUNCATE checkpoint writes that into the file and empties the log. Runs outside
 * any transaction; throws when the log could not be emptied, so a failure is never silent.
 */
export function purgeDeletedData(database: SyncDb): void {
  database.run(sql`VACUUM`);
  // `.all()` steps the statement to the end. A half-read statement would stay busy, and an open
  // statement makes the next VACUUM fail.
  const [checkpoint] = database.all<{ busy: number }>(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
  if (checkpoint === undefined || checkpoint.busy !== 0) {
    throw new Error("The write-ahead log is in use and could not be emptied");
  }
}

export function createMedicationWithPlan(
  database: SyncDb,
  input: { name: string; doseMcg: number; intervalDays: number; startDate: LocalDate },
  now: number,
): string {
  const id = ulid(now);
  database.transaction((tx) => {
    tx.insert(medications).values({ id, name: input.name.trim(), active: true, createdAt: now, updatedAt: now }).run();
    tx.insert(planSteps)
      .values({
        id: ulid(now),
        medicationId: id,
        startDate: input.startDate,
        doseMcg: input.doseMcg,
        intervalDays: input.intervalDays,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });
  return id;
}

/**
 * Every record on the phone, in backup form, read in one transaction without yielding: a write that
 * happens meanwhile (a Health Connect sync, say) is either wholly in the backup or wholly out of it.
 */
export function readBackupData(database: SyncDb): BackupData {
  return database.transaction((tx) => {
    const [s] = tx.select().from(settings).where(eq(settings.id, 1)).all();
    // Rows come from the database, whose CHECKs and triggers match the backup schema; only the
    // LocalDate brand on the date columns is missing from Drizzle's row types. ops.test.ts parses
    // the result with parseBackup to keep that true.
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
              language: s.language,
              energyGoalKcal: s.energyGoalKcal,
              proteinGoalG: s.proteinGoalG,
              waterGoalMl: s.waterGoalMl,
              waterServingMl: s.waterServingMl,
            },
      weights: tx.select().from(weightEntries).all(),
      medications: tx.select().from(medications).all(),
      planSteps: tx.select().from(planSteps).all(),
      injections: tx.select().from(injections).all(),
      sideEffects: tx.select().from(sideEffects).all(),
      customFoods: tx.select().from(customFoods).all(),
      foodEntries: tx.select().from(foodEntries).all(),
      waterEntries: tx.select().from(waterEntries).all(),
      measurements: tx.select().from(measurementEntries).all(),
      exercises: tx.select().from(exerciseEntries).all(),
    } as BackupData;
  });
}

export interface RestoreSummary {
  readonly weights: number;
  readonly injections: number;
  readonly sideEffects: number;
  readonly medications: number;
  readonly planSteps: number;
  /** Medications added as inactive so that the phone keeps one current medication. */
  readonly inactiveMedications: number;
  readonly customFoods: number;
  readonly foodEntries: number;
  readonly waterEntries: number;
  readonly measurements: number;
  readonly exercises: number;
}

/** Whether the phone holds any record of its own, so a restore must not replace its settings. */
function hasRecords(tx: Pick<SyncDb, "select">): boolean {
  const tables = [weightEntries, medications, foodEntries, customFoods, waterEntries, measurementEntries, exerciseEntries];
  return tables.some((table) => tx.select({ id: table.id }).from(table).limit(1).all().length > 0);
}

/**
 * The backup medication that becomes current on a phone without one: the oldest active one, which
 * is the one useActiveMedication shows. Ties go to the smaller id, so row order never decides.
 */
function oldestActive(meds: BackupData["medications"]): string | undefined {
  let oldest: BackupData["medications"][number] | undefined;
  for (const m of meds) {
    if (!m.active) continue;
    if (oldest === undefined || m.createdAt < oldest.createdAt || (m.createdAt === oldest.createdAt && m.id < oldest.id)) {
      oldest = m;
    }
  }
  return oldest?.id;
}

/**
 * Adds every record from a validated backup that is not on the phone yet. Nothing on the phone is
 * changed or removed: a row whose id (or Health Connect id, or plan date) exists is skipped. Unit,
 * goals and language come from the backup only on a phone with no records yet. Custom foods go in
 * before the food entries that point at them. The phone keeps exactly one
 * current medication: its own if it has one, otherwise the backup's oldest active one; every other
 * active medication in the backup is added as inactive (its injections still show in History).
 */
export function restoreData(database: SyncDb, data: BackupData, now: number): RestoreSummary {
  return database.transaction((tx) => {
    const hadRecords = hasRecords(tx);
    const activeIds = new Set(
      tx.select({ id: medications.id }).from(medications).where(eq(medications.active, true)).all().map((m) => m.id),
    );
    const current = activeIds.size > 0 ? undefined : oldestActive(data.medications);
    const staysActive = (m: { id: string; active: boolean }) => m.active && (activeIds.has(m.id) || m.id === current);
    const meds = data.medications.map((m) => ({ ...m, active: staysActive(m) }));
    const demoted = new Set(data.medications.filter((m) => m.active && !staysActive(m)).map((m) => m.id));

    /** Inserts in chunks; returns the ids actually added (rows already on the phone are skipped). */
    const insertAll = <T>(rows: readonly T[], insert: (chunk: T[]) => { id: string }[]) =>
      chunks(rows).flatMap((chunk) => insert(chunk).map((r) => r.id));

    // Parents before children, so every foreign key already resolves.
    const medicationsAdded = insertAll(meds, (c) =>
      tx.insert(medications).values(c).onConflictDoNothing().returning({ id: medications.id }).all(),
    );
    const planStepsAdded = insertAll(data.planSteps, (c) =>
      tx.insert(planSteps).values(c).onConflictDoNothing().returning({ id: planSteps.id }).all(),
    ).length;
    const injectionsAdded = insertAll(data.injections, (c) =>
      tx.insert(injections).values(c).onConflictDoNothing().returning({ id: injections.id }).all(),
    ).length;
    const sideEffectsAdded = insertAll(data.sideEffects, (c) =>
      tx.insert(sideEffects).values(c).onConflictDoNothing().returning({ id: sideEffects.id }).all(),
    ).length;
    const weightsAdded = insertAll(data.weights, (c) =>
      tx.insert(weightEntries).values(c).onConflictDoNothing().returning({ id: weightEntries.id }).all(),
    ).length;
    const customFoodsAdded = insertAll(data.customFoods, (c) =>
      tx.insert(customFoods).values(c).onConflictDoNothing().returning({ id: customFoods.id }).all(),
    ).length;
    const foodEntriesAdded = insertAll(data.foodEntries, (c) =>
      tx.insert(foodEntries).values(c).onConflictDoNothing().returning({ id: foodEntries.id }).all(),
    ).length;
    const waterAdded = insertAll(data.waterEntries, (c) =>
      tx.insert(waterEntries).values(c).onConflictDoNothing().returning({ id: waterEntries.id }).all(),
    ).length;
    const measurementsAdded = insertAll(data.measurements, (c) =>
      tx.insert(measurementEntries).values(c).onConflictDoNothing().returning({ id: measurementEntries.id }).all(),
    ).length;
    const exercisesAdded = insertAll(data.exercises, (c) =>
      tx.insert(exerciseEntries).values(c).onConflictDoNothing().returning({ id: exerciseEntries.id }).all(),
    ).length;

    if (!hadRecords && data.settings !== null) {
      const s = data.settings;
      tx.update(settings)
        .set({
          weightUnit: s.weightUnit,
          goalWeightG: s.goalWeightG,
          language: s.language,
          energyGoalKcal: s.energyGoalKcal,
          proteinGoalG: s.proteinGoalG,
          waterGoalMl: s.waterGoalMl,
          waterServingMl: s.waterServingMl,
          updatedAt: now,
        })
        .where(eq(settings.id, 1))
        .run();
    }
    return {
      weights: weightsAdded,
      injections: injectionsAdded,
      sideEffects: sideEffectsAdded,
      medications: medicationsAdded.length,
      planSteps: planStepsAdded,
      inactiveMedications: medicationsAdded.filter((id) => demoted.has(id)).length,
      customFoods: customFoodsAdded,
      foodEntries: foodEntriesAdded,
      waterEntries: waterAdded,
      measurements: measurementsAdded,
      exercises: exercisesAdded,
    };
  });
}

/**
 * Inserts Health Connect readings not stored yet and moves the sync cursor, together: the cursor
 * never passes readings that were not saved.
 */
export function insertImportedWeights(database: SyncDb, rows: readonly ImportedWeight[], cursor: number, now: number): number {
  return database.transaction((tx) => {
    let added = 0;
    for (const chunk of chunks(rows)) {
      added += tx
        .insert(weightEntries)
        .values(
          chunk.map((w) => ({
            id: ulid(w.measuredAt),
            measuredAt: w.measuredAt,
            localDate: w.localDate,
            weightG: w.weightG,
            source: "health_connect" as const,
            healthConnectId: w.healthConnectId,
            note: null,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: weightEntries.id })
        .all().length;
    }
    tx.update(settings).set({ healthConnectSyncedAt: cursor, updatedAt: now }).where(eq(settings.id, 1)).run();
    return added;
  });
}

