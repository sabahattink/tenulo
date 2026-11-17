import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { waterEntries } from "@/db/schema";
import type { LocalDate } from "@/domain/date";
import { ulid } from "@/domain/id";
import { isWaterAmount } from "@/domain/water";

export type WaterEntry = typeof waterEntries.$inferSelect;

export function useWaterDay(date: LocalDate): readonly WaterEntry[] {
  const { data } = useLiveQuery(
    db.select().from(waterEntries).where(eq(waterEntries.localDate, date)).orderBy(asc(waterEntries.loggedAt)),
    [date],
  );
  return data;
}

export interface WaterDayTotal {
  readonly localDate: string;
  readonly amountMl: number;
}

/** Millilitres per day between two dates (inclusive). */
export function useWaterTotals(from: LocalDate, to: LocalDate): readonly WaterDayTotal[] {
  const { data } = useLiveQuery(
    db
      .select({
        localDate: waterEntries.localDate,
        amountMl: sql<number>`sum(${waterEntries.amountMl})`.mapWith(Number),
      })
      .from(waterEntries)
      .where(and(gte(waterEntries.localDate, from), lte(waterEntries.localDate, to)))
      .groupBy(waterEntries.localDate)
      .orderBy(asc(waterEntries.localDate)),
    [from, to],
  );
  return data;
}

export async function addWater(amountMl: number, date: LocalDate, now: Date = new Date()): Promise<string> {
  if (!isWaterAmount(amountMl)) throw new RangeError(`Invalid water amount: ${amountMl}`);
  const ms = now.getTime();
  const id = ulid(ms);
  await db.insert(waterEntries).values({ id, localDate: date, loggedAt: ms, amountMl, createdAt: ms, updatedAt: ms });
  return id;
}

/** Undoes the last glass of the day: the quick fix for a mistaken tap. */
export async function removeLastWater(date: LocalDate): Promise<void> {
  const [last] = await db
    .select({ id: waterEntries.id })
    .from(waterEntries)
    .where(eq(waterEntries.localDate, date))
    .orderBy(desc(waterEntries.loggedAt))
    .limit(1);
  if (last !== undefined) await db.delete(waterEntries).where(eq(waterEntries.id, last.id));
}

export async function deleteWater(id: string): Promise<void> {
  await db.delete(waterEntries).where(eq(waterEntries.id, id));
}
