import { desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { File, Paths } from "expo-file-system";
import { type Db, db } from "@/db/client";
import { settings, weightEntries } from "@/db/schema";
import { purgeDeletedData, wipeAll } from "@/db/ops";
import { type LocalDate, localDateOf } from "@/domain/date";
import { ulid } from "@/domain/id";
import { LANGUAGE_PREFERENCES, type LanguagePreference } from "@/domain/language";
import { isMinuteOfDay } from "@/domain/reminder";
import { type WeightUnit, isPlausibleWeight } from "@/domain/weight";
import { cancelAllReminders } from "@/platform/reminders";
import { sweepExports } from "./files";

export type Settings = typeof settings.$inferSelect;

/** Creates the single settings row on first launch. Safe to call on every start. */
export async function ensureSettings(database: Db = db): Promise<void> {
  await database
    .insert(settings)
    .values({ id: 1, updatedAt: Date.now() })
    .onConflictDoNothing({ target: settings.id });
}

export interface StartState {
  /** Whether the welcome screens are done. */
  readonly welcomed: boolean;
  readonly language: LanguagePreference;
}

/** Read once at start, before the live query has data, so the first screen is already right. */
export async function readStartState(database: Db = db): Promise<StartState> {
  const [row] = await database
    .select({ welcomedAt: settings.welcomedAt, language: settings.language })
    .from(settings)
    .where(eq(settings.id, 1));
  return { welcomed: row?.welcomedAt != null, language: row?.language ?? "system" };
}

export function useSettings(): Settings | undefined {
  const { data } = useLiveQuery(db.select().from(settings).where(eq(settings.id, 1)));
  return data[0];
}

export async function setWeightUnit(unit: WeightUnit): Promise<void> {
  await db.update(settings).set({ weightUnit: unit, updatedAt: Date.now() }).where(eq(settings.id, 1));
}

export async function setLanguage(language: LanguagePreference): Promise<void> {
  if (!LANGUAGE_PREFERENCES.includes(language)) throw new RangeError(`Not a language: ${String(language)}`);
  await db.update(settings).set({ language, updatedAt: Date.now() }).where(eq(settings.id, 1));
}

export async function setGoalWeight(goalG: number | null): Promise<void> {
  if (goalG !== null && !isPlausibleWeight(goalG)) throw new RangeError(`Implausible goal: ${goalG}`);
  await db.update(settings).set({ goalWeightG: goalG, updatedAt: Date.now() }).where(eq(settings.id, 1));
}

export async function setInjectionReminder(enabled: boolean, minute: number): Promise<void> {
  if (!isMinuteOfDay(minute)) throw new RangeError(`Not a minute of the day: ${minute}`);
  await db
    .update(settings)
    .set({ injectionReminderEnabled: enabled, injectionReminderMinute: minute, updatedAt: Date.now() })
    .where(eq(settings.id, 1));
}

export async function setWeighInReminder(enabled: boolean, minute: number): Promise<void> {
  if (!isMinuteOfDay(minute)) throw new RangeError(`Not a minute of the day: ${minute}`);
  await db
    .update(settings)
    .set({ weighInReminderEnabled: enabled, weighInReminderMinute: minute, updatedAt: Date.now() })
    .where(eq(settings.id, 1));
}

/** Ends the welcome screens with the unit the user chose. */
export async function finishWelcome(unit: WeightUnit): Promise<void> {
  const now = Date.now();
  await db.update(settings).set({ weightUnit: unit, welcomedAt: now, updatedAt: now }).where(eq(settings.id, 1));
}

export async function setHealthConnectEnabled(enabled: boolean): Promise<void> {
  await db.update(settings).set({ healthConnectEnabled: enabled, updatedAt: Date.now() }).where(eq(settings.id, 1));
}

export type WeightEntry = typeof weightEntries.$inferSelect;

export function useWeightEntries(): readonly WeightEntry[] {
  const { data } = useLiveQuery(
    db.select().from(weightEntries).orderBy(desc(weightEntries.localDate), desc(weightEntries.measuredAt)),
  );
  return data;
}

export async function addWeight(weightG: number, date: LocalDate, now: Date = new Date()): Promise<string> {
  if (!isPlausibleWeight(weightG)) throw new RangeError(`Implausible weight: ${weightG}`);
  const ms = now.getTime();
  const id = ulid(ms);
  // A reading for an earlier day keeps the current clock time; its calendar date is what counts.
  await db.insert(weightEntries).values({
    id,
    measuredAt: ms,
    localDate: date,
    weightG,
    source: "manual",
    healthConnectId: null,
    note: null,
    createdAt: ms,
    updatedAt: ms,
  });
  return id;
}

export async function deleteWeight(id: string): Promise<void> {
  await db.delete(weightEntries).where(eq(weightEntries.id, id));
}

/**
 * Exists while a "Delete all data" has not finished clearing the database files. It lives outside
 * the database (app-private storage, never backed up) so it survives a crash or a failed purge,
 * and the next start finishes the job: by then the user is on the welcome screens, where Settings
 * and its "Delete all data" are out of reach.
 */
const purgeMarker = () => new File(Paths.document, "tenulo-purge-pending");

export interface DeleteAllResult {
  /** False when old copies are still in the database files; the next start clears them. */
  readonly filesCleared: boolean;
}

/**
 * Erases every record in every table and resets settings in one transaction, then cancels every
 * scheduled reminder (and removes reminder notifications already shown), deletes exported files
 * left in the cache, and finally clears the deleted records' bytes from the database files. This is
 * the "Delete all data" promised in the privacy policy.
 */
export async function deleteAllData(): Promise<DeleteAllResult> {
  // First, so an interruption anywhere below is finished at the next start.
  purgeMarker().create({ overwrite: true });
  wipeAll(db, Date.now());
  // Reminders, their notifications and exported files carry the same data; they go with it.
  cancelAllReminders();
  sweepExports(0);
  return { filesCleared: finishPendingPurge() };
}

/**
 * Clears deleted records' bytes from the database files if a "Delete all data" left that
 * unfinished. Called by deleteAllData and at every start. True when nothing is left pending; on
 * failure the marker stays and the next start tries again.
 */
export function finishPendingPurge(): boolean {
  const marker = purgeMarker();
  if (!marker.exists) return true;
  try {
    purgeDeletedData(db);
  } catch {
    return false;
  }
  marker.delete();
  return true;
}

export function today(): LocalDate {
  return localDateOf(new Date());
}
