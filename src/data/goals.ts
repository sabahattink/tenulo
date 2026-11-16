import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { ENERGY_GOAL_KCAL, PROTEIN_GOAL_G, type Range, WATER_GOAL_ML, WATER_SERVING_ML } from "@/domain/goals";

/** The user's own daily goals; null clears one. Tenulo never fills these in. */
export interface DailyGoals {
  readonly energyGoalKcal: number | null;
  readonly proteinGoalG: number | null;
  readonly waterGoalMl: number | null;
}

function assertIn(value: number | null, range: Range, what: string): void {
  if (value === null) return;
  if (!Number.isInteger(value) || value < range.min || value > range.max) throw new RangeError(`Invalid ${what}: ${value}`);
}

export async function setDailyGoals(goals: DailyGoals): Promise<void> {
  assertIn(goals.energyGoalKcal, ENERGY_GOAL_KCAL, "energy goal");
  assertIn(goals.proteinGoalG, PROTEIN_GOAL_G, "protein goal");
  assertIn(goals.waterGoalMl, WATER_GOAL_ML, "water goal");
  await db.update(settings).set({ ...goals, updatedAt: Date.now() }).where(eq(settings.id, 1));
}

export async function setWaterServing(ml: number): Promise<void> {
  assertIn(ml, WATER_SERVING_ML, "glass size");
  await db.update(settings).set({ waterServingMl: ml, updatedAt: Date.now() }).where(eq(settings.id, 1));
}
