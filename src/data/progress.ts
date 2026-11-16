import { and, asc, gte, lte, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { foodEntries } from "@/db/schema";
import type { LocalDate } from "@/domain/date";

export interface FoodDay {
  readonly localDate: string;
  readonly energyKcal: number;
  /** Protein of the foods that have a value; null when none of the day's foods has one. */
  readonly proteinMg: number | null;
}

/**
 * Energy and protein per day between two dates (inclusive), for the weekly comparison. Unlike a
 * plain sum, a day whose foods all lack a protein value has no protein (null) rather than 0 g, so it
 * does not pull the protein average down.
 */
export function useFoodDays(from: LocalDate, to: LocalDate): readonly FoodDay[] {
  const { data } = useLiveQuery(
    db
      .select({
        localDate: foodEntries.localDate,
        energyKcal: sql<number>`sum(${foodEntries.energyKcal})`.mapWith(Number),
        // SQL sum() is null when every value is null, which is exactly "no protein known".
        proteinMg: sql<number | null>`sum(${foodEntries.proteinMg})`,
      })
      .from(foodEntries)
      .where(and(gte(foodEntries.localDate, from), lte(foodEntries.localDate, to)))
      .groupBy(foodEntries.localDate)
      .orderBy(asc(foodEntries.localDate)),
    [from, to],
  );
  return data;
}
