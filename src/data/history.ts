/**
 * The daily-log records History shows, read with only the columns its lines need. Food is many rows
 * a day, so the database adds each meal up and History gets one row per meal per day
 * (src/ui/timeline-groups.ts draws the line).
 */
import { count, desc, inArray, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { exerciseEntries, foodEntries, measurementEntries, waterEntries } from "@/db/schema";
import type { FoodLogRow, WaterLogRow } from "@/ui/timeline-groups";
import type { ExerciseEntry } from "./exercise";

export function useFoodLog(): readonly FoodLogRow[] {
  const { data } = useLiveQuery(
    db
      .select({
        localDate: foodEntries.localDate,
        meal: foodEntries.meal,
        foods: count(),
        loggedAt: sql<number>`max(${foodEntries.loggedAt})`.mapWith(Number),
        energyKcal: sql<number>`sum(${foodEntries.energyKcal})`.mapWith(Number),
      })
      .from(foodEntries)
      .groupBy(foodEntries.localDate, foodEntries.meal)
      .orderBy(desc(foodEntries.localDate)),
  );
  return data;
}

export function useWaterLog(): readonly WaterLogRow[] {
  const { data } = useLiveQuery(
    db
      .select({ id: waterEntries.id, localDate: waterEntries.localDate, loggedAt: waterEntries.loggedAt, amountMl: waterEntries.amountMl })
      .from(waterEntries)
      .orderBy(desc(waterEntries.localDate)),
  );
  return data;
}

export function useExerciseLog(): readonly ExerciseEntry[] {
  const { data } = useLiveQuery(
    db.select().from(exerciseEntries).orderBy(desc(exerciseEntries.localDate), desc(exerciseEntries.loggedAt)),
  );
  return data;
}

/** A day of water, or a measuring sitting, deleted as the one line History shows for it. */
export async function deleteWaterEntries(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(waterEntries).where(inArray(waterEntries.id, [...ids]));
}

export async function deleteMeasurements(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(measurementEntries).where(inArray(measurementEntries.id, [...ids]));
}
