import { desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { type Db, db } from "@/db/client";
import { settings, weightEntries } from "@/db/schema";
import { wipeAll } from "@/db/ops";
import { type LocalDate, localDateOf } from "@/domain/date";
import { ulid } from "@/domain/id";
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

/** Whether the welcome screens are done, read once at start before the live query has data. */
export async function readWelcomed(database: Db = db): Promise<boolean> {
  const [row] = await database.select({ welcomedAt: settings.welcomedAt }).from(settings).where(eq(settings.id, 1));
  return row?.welcomedAt != null;
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
 * Erases every record in every table and resets settings in one transaction, then cancels every
 * scheduled reminder and deletes exported files left in the cache. This is the "Delete all data"
 * promised in the privacy policy.
 */
export async function deleteAllData(): Promise<void> {
  wipeAll(db, Date.now());
  // Scheduled reminders and exported files carry the same data; they go with it.
  cancelAllReminders();
  sweepExports(0);
}

export function today(): LocalDate {
  return localDateOf(new Date());
}
