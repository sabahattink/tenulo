import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { customFoods, foodEntries } from "@/db/schema";
import type { CustomFood, FoodEntry } from "./food";

/**
 * One row by id, for the edit screens. `loaded` is false until the first read finishes, so a screen
 * can tell "still reading" from "deleted" (a live query starts out empty).
 *
 * A live query keeps its last result while it re-reads for new inputs, so `loaded` describes the
 * current id only when the id never changes: key the component by it.
 */
export interface Lookup<T> {
  readonly row: T | undefined;
  readonly loaded: boolean;
}

function lookup<T extends { readonly id: string }>(id: string, data: readonly T[], updatedAt: Date | undefined): Lookup<T> {
  const row = data[0];
  return { row: row?.id === id ? row : undefined, loaded: updatedAt !== undefined };
}

export function useFoodEntry(id: string): Lookup<FoodEntry> {
  const { data, updatedAt } = useLiveQuery(db.select().from(foodEntries).where(eq(foodEntries.id, id)), [id]);
  return lookup(id, data, updatedAt);
}

export function useCustomFood(id: string): Lookup<CustomFood> {
  const { data, updatedAt } = useLiveQuery(db.select().from(customFoods).where(eq(customFoods.id, id)), [id]);
  return lookup(id, data, updatedAt);
}
