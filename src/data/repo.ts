import { desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { type Db, db } from "@/db/client";
import { settings, weightEntries } from "@/db/schema";
import { ALL_TABLES_DELETE_ORDER } from "@/db/tables";
import { type LocalDate, localDateOf } from "@/domain/date";
import { ulid } from "@/domain/id";
import { isMinuteOfDay } from "@/domain/reminder";
import { type WeightUnit, isPlausibleWeight } from "@/domain/weight";
import { cancelAllReminders } from "@/platform/reminders";

export type Settings = typeof settings.$inferSelect;

/** Creates the single settings row on first launch. Safe to call on every start. */
export async function ensureSettings(database: Db = db): Promise<void> {
  await database
    .insert(settings)
    .values({ id: 1, updatedAt: Date.now() })
    .onConflictDoNothing({ target: settings.id });
}

export function useSettings(): Settings | undefined {
  const { data } = useLiveQuery(db.select().from(settings).where(eq(settings.id, 1)));
  return data[0];
}

export async function setWeightUnit(unit: WeightUnit): Promise<void> {
  await db.update(settings).set({ weightUnit: unit, updatedAt: Date.now() }).where(eq(settings.id, 1));
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
 * Erases every record in every table and resets settings, in one transaction, then cancels every
 * scheduled reminder. This is the "Delete all data" promised in the privacy policy.
 */
export async function deleteAllData(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of ALL_TABLES_DELETE_ORDER) await tx.delete(table);
    await tx.insert(settings).values({ id: 1, updatedAt: Date.now() });
  });
  // Scheduled reminders carry what they are about; they go with the data.
  cancelAllReminders();
}

export function today(): LocalDate {
  return localDateOf(new Date());
}
