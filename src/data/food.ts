import { and, asc, desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { customFoods, foodEntries } from "@/db/schema";
import { CATALOG_FOOD_ID } from "@/domain/backup";
import { type LocalDate, isLocalDate } from "@/domain/date";
import {
  MAX_ENTRY_KCAL,
  MAX_NUTRIENT_MG,
  MAX_QUANTITY_MILLI,
  MAX_SERVING_KCAL,
  MAX_SERVING_NUTRIENT_G,
  MEALS,
  MIN_QUANTITY_MILLI,
  type Meal,
} from "@/domain/food-log";
import { ulid } from "@/domain/id";

export type FoodEntry = typeof foodEntries.$inferSelect;
export type CustomFood = typeof customFoods.$inferSelect;

/** How far back "recent foods" look: enough for weeks of meals, cheap to scan. */
const RECENT_WINDOW = 400;

export interface Nutrients {
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly carbMg: number | null;
  readonly fatMg: number | null;
  readonly fiberMg: number | null;
}

export interface NewFoodEntry extends Nutrients {
  readonly date: LocalDate;
  readonly meal: Meal;
  readonly catalogFoodId: string | null;
  readonly customFoodId: string | null;
  readonly name: string;
  readonly portionId: string | null;
  readonly portionLabel: string;
  readonly quantityMilli: number;
  readonly grams: number | null;
}

function inRange(n: number | null, min: number, max: number): boolean {
  return n === null || (Number.isInteger(n) && n >= min && n <= max);
}

function assertNutrients(n: Nutrients, maxKcal: number, maxMg: number): void {
  if (!inRange(n.energyKcal, 0, maxKcal)) throw new RangeError(`Invalid energy: ${n.energyKcal}`);
  for (const v of [n.proteinMg, n.carbMg, n.fatMg, n.fiberMg]) {
    if (!inRange(v, 0, maxMg)) throw new RangeError(`Invalid nutrient amount: ${v}`);
  }
}

function assertEntry(e: NewFoodEntry): void {
  if (!MEALS.includes(e.meal)) throw new RangeError(`Unknown meal: ${e.meal}`);
  if (e.catalogFoodId !== null && e.customFoodId !== null) throw new RangeError("A food has one source");
  if (e.catalogFoodId !== null && !CATALOG_FOOD_ID.test(e.catalogFoodId)) throw new RangeError("Bad food id");
  const name = e.name.trim();
  if (name.length < 1 || name.length > 80) throw new RangeError("Name must be 1-80 characters");
  const portion = e.portionLabel.trim();
  if (portion.length < 1 || portion.length > 40) throw new RangeError("Portion must be 1-40 characters");
  if (!inRange(e.quantityMilli, MIN_QUANTITY_MILLI, MAX_QUANTITY_MILLI)) throw new RangeError("Invalid amount");
  if (!inRange(e.grams, 0, 100_000)) throw new RangeError("Invalid grams");
  assertNutrients(e, MAX_ENTRY_KCAL, MAX_NUTRIENT_MG);
}

export function useFoodDay(date: LocalDate): readonly FoodEntry[] {
  const { data } = useLiveQuery(
    db.select().from(foodEntries).where(eq(foodEntries.localDate, date)).orderBy(asc(foodEntries.loggedAt)),
    [date],
  );
  return data;
}

/** The latest entries, newest first, for "recent foods" (see recentFoods in the domain). */
export function useRecentFoodEntries(): readonly FoodEntry[] {
  const { data } = useLiveQuery(db.select().from(foodEntries).orderBy(desc(foodEntries.loggedAt)).limit(RECENT_WINDOW));
  return data;
}


export async function addFoodEntry(entry: NewFoodEntry, now: Date = new Date()): Promise<string> {
  assertEntry(entry);
  const ms = now.getTime();
  const id = ulid(ms);
  await db.insert(foodEntries).values({
    id,
    localDate: entry.date,
    loggedAt: ms,
    meal: entry.meal,
    catalogFoodId: entry.catalogFoodId,
    customFoodId: entry.customFoodId,
    name: entry.name.trim(),
    portionId: entry.portionId,
    portionLabel: entry.portionLabel.trim(),
    quantityMilli: entry.quantityMilli,
    grams: entry.grams,
    energyKcal: entry.energyKcal,
    proteinMg: entry.proteinMg,
    carbMg: entry.carbMg,
    fatMg: entry.fatMg,
    fiberMg: entry.fiberMg,
    createdAt: ms,
    updatedAt: ms,
  });
  return id;
}

/** Moves an entry to another meal, or changes its amount with the nutrients that follow from it. */
export async function updateFoodEntry(
  id: string,
  change: { readonly meal: Meal; readonly portionId: string | null; readonly portionLabel: string; readonly quantityMilli: number; readonly grams: number | null } & Nutrients,
): Promise<void> {
  if (!MEALS.includes(change.meal)) throw new RangeError(`Unknown meal: ${change.meal}`);
  if (!inRange(change.quantityMilli, MIN_QUANTITY_MILLI, MAX_QUANTITY_MILLI)) throw new RangeError("Invalid amount");
  assertNutrients(change, MAX_ENTRY_KCAL, MAX_NUTRIENT_MG);
  await db
    .update(foodEntries)
    .set({ ...change, portionLabel: change.portionLabel.trim(), updatedAt: Date.now() })
    .where(eq(foodEntries.id, id));
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await db.delete(foodEntries).where(eq(foodEntries.id, id));
}

/** Copies every entry of one meal on `from` to the same meal on `to`, as new entries. */
export async function copyMeal(from: LocalDate, to: LocalDate, meal: Meal, now: Date = new Date()): Promise<number> {
  if (!isLocalDate(from) || !isLocalDate(to)) throw new RangeError("Not a calendar date");
  if (!MEALS.includes(meal)) throw new RangeError("Unknown meal: " + meal);
  const rows = await db
    .select()
    .from(foodEntries)
    .where(and(eq(foodEntries.localDate, from), eq(foodEntries.meal, meal)))
    .orderBy(asc(foodEntries.loggedAt));
  if (rows.length === 0) return 0;
  const ms = now.getTime();
  await db.insert(foodEntries).values(
    rows.map((r, i) => ({ ...r, id: ulid(ms + i), localDate: to, loggedAt: ms + i, createdAt: ms, updatedAt: ms })),
  );
  return rows.length;
}

export function useCustomFoods(): readonly CustomFood[] {
  const { data } = useLiveQuery(db.select().from(customFoods).orderBy(asc(customFoods.name)));
  return data;
}

export interface CustomFoodInput extends Nutrients {
  readonly name: string;
  readonly servingLabel: string;
  readonly servingGrams: number | null;
}

function assertCustomFood(f: CustomFoodInput): void {
  const name = f.name.trim();
  if (name.length < 1 || name.length > 60) throw new RangeError("Name must be 1-60 characters");
  const serving = f.servingLabel.trim();
  if (serving.length < 1 || serving.length > 40) throw new RangeError("Serving must be 1-40 characters");
  if (!inRange(f.servingGrams, 1, 5000)) throw new RangeError("Invalid serving grams");
  assertNutrients(f, MAX_SERVING_KCAL, MAX_SERVING_NUTRIENT_G * 1000);
}

export async function createCustomFood(f: CustomFoodInput): Promise<string> {
  assertCustomFood(f);
  const ms = Date.now();
  const id = ulid(ms);
  await db.insert(customFoods).values({
    id,
    ...f,
    name: f.name.trim(),
    servingLabel: f.servingLabel.trim(),
    createdAt: ms,
    updatedAt: ms,
  });
  return id;
}

/** Changes the food for future entries; entries already logged keep the values they were logged with. */
export async function updateCustomFood(id: string, f: CustomFoodInput): Promise<void> {
  assertCustomFood(f);
  await db
    .update(customFoods)
    .set({ ...f, name: f.name.trim(), servingLabel: f.servingLabel.trim(), updatedAt: Date.now() })
    .where(eq(customFoods.id, id));
}

/** Logged entries stay, with their own copy of the values; they only lose the link. */
export async function deleteCustomFood(id: string): Promise<void> {
  await db.delete(customFoods).where(eq(customFoods.id, id));
}
