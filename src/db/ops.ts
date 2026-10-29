/**
 * Every multi-statement write, as one real transaction.
 *
 * Drizzle's expo-sqlite driver is synchronous: `transaction()` commits as soon as its callback
 * returns. An `async` callback returns at its first `await`, so the rest would run outside the
 * transaction and a failure would never roll back. Everything here therefore uses the synchronous
 * query API (`.run()`, `.all()`) inside a synchronous callback. Tested against the real driver in
 * ops.test.ts.
 */
import { eq } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite/driver";
import type { BackupData } from "../domain/backup";
import type { LocalDate } from "../domain/date";
import type { ImportedWeight } from "../domain/health-connect";
import { ulid } from "../domain/id";
import type * as schema from "./schema";
import { injections, medications, planSteps, settings, sideEffects, weightEntries } from "./schema";
import { ALL_TABLES_DELETE_ORDER } from "./tables";

export type SyncDb = ExpoSQLiteDatabase<typeof schema>;

/** Rows per INSERT: 200 rows x 10 columns stays far below SQLite's bound-variable limit. */
const INSERT_CHUNK = 200;

function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) out.push(rows.slice(i, i + INSERT_CHUNK));
  return out;
}

/** "Delete all data": every row of every table, then a fresh settings row. All or nothing. */
export function wipeAll(database: SyncDb, now: number): void {
  database.transaction((tx) => {
    for (const table of ALL_TABLES_DELETE_ORDER) tx.delete(table).run();
    tx.insert(settings).values({ id: 1, updatedAt: now }).run();
  });
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

export interface RestoreSummary {
  readonly weights: number;
  readonly injections: number;
  readonly sideEffects: number;
  readonly medications: number;
  readonly planSteps: number;
  /** Medications added as inactive because the phone already has an active one. */
  readonly inactiveMedications: number;
}

/**
 * Adds every record from a validated backup that is not on the phone yet. Nothing on the phone is
 * changed or removed: a row whose id (or Health Connect id, or plan date) exists is skipped. Unit
 * and goal come from the backup only on a phone with no records yet. If the phone already has an
 * active medication, the backup's other medications are added as inactive, so the phone keeps
 * exactly one current medication.
 */
export function restoreData(database: SyncDb, data: BackupData, now: number): RestoreSummary {
  return database.transaction((tx) => {
    const hadRecords =
      tx.select({ id: weightEntries.id }).from(weightEntries).limit(1).all().length > 0 ||
      tx.select({ id: medications.id }).from(medications).limit(1).all().length > 0;
    const activeIds = new Set(
      tx.select({ id: medications.id }).from(medications).where(eq(medications.active, true)).all().map((m) => m.id),
    );
    const keepActive = activeIds.size === 0;
    const meds = data.medications.map((m) => ({ ...m, active: m.active && (keepActive || activeIds.has(m.id)) }));
    const inactiveMedications = meds.filter((m, i) => !m.active && data.medications[i]?.active === true).length;

    const insertAll = <T>(rows: readonly T[], insert: (chunk: T[]) => { id: string }[]) =>
      chunks(rows).reduce((added, chunk) => added + insert(chunk).length, 0);

    // Parents before children, so every foreign key already resolves.
    const medicationsAdded = insertAll(meds, (c) =>
      tx.insert(medications).values(c).onConflictDoNothing().returning({ id: medications.id }).all(),
    );
    const planStepsAdded = insertAll(data.planSteps, (c) =>
      tx.insert(planSteps).values(c).onConflictDoNothing().returning({ id: planSteps.id }).all(),
    );
    const injectionsAdded = insertAll(data.injections, (c) =>
      tx.insert(injections).values(c).onConflictDoNothing().returning({ id: injections.id }).all(),
    );
    const sideEffectsAdded = insertAll(data.sideEffects, (c) =>
      tx.insert(sideEffects).values(c).onConflictDoNothing().returning({ id: sideEffects.id }).all(),
    );
    const weightsAdded = insertAll(data.weights, (c) =>
      tx.insert(weightEntries).values(c).onConflictDoNothing().returning({ id: weightEntries.id }).all(),
    );

    if (!hadRecords && data.settings !== null) {
      tx.update(settings)
        .set({ weightUnit: data.settings.weightUnit, goalWeightG: data.settings.goalWeightG, updatedAt: now })
        .where(eq(settings.id, 1))
        .run();
    }
    return {
      weights: weightsAdded,
      injections: injectionsAdded,
      sideEffects: sideEffectsAdded,
      medications: medicationsAdded,
      planSteps: planStepsAdded,
      inactiveMedications: medicationsAdded === 0 ? 0 : inactiveMedications,
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

