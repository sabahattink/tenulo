/**
 * Today at a glance: what the day's entries add up to, measured against the user's own goals.
 * Pure, so the Today screen only draws it. A goal is only ever the user's own number (goals.ts);
 * without one, the screens show the value alone.
 */
import { type ExerciseKind, type Intensity, estimateExerciseKcal } from "./exercise";
import { type LoggedFood, type NutrientKey, totals } from "./food-log";
import { goalFraction } from "./goals";
import { totalMl } from "./water";

export interface Ring {
  /** What was logged, in the unit shown: kcal, whole grams of protein, millilitres of water. */
  readonly value: number;
  /** The user's own goal in the same unit; null when they have not set one. */
  readonly goal: number | null;
  /** Share of the goal reached, 0 to 1 (capped); undefined without a goal. */
  readonly fraction: number | undefined;
}

export interface DayGoals {
  readonly energyKcal: number | null;
  readonly proteinG: number | null;
  readonly waterMl: number | null;
}

export interface DayRings {
  readonly energy: Ring;
  readonly protein: Ring;
  readonly water: Ring;
}

const MG_PER_G = 1000;

export function dayRings(
  food: readonly Pick<LoggedFood, "energyKcal" | NutrientKey>[],
  water: readonly { readonly amountMl: number }[],
  goals: DayGoals,
): DayRings {
  const sum = totals(food);
  const waterMl = totalMl(water);
  return {
    energy: { value: sum.energyKcal, goal: goals.energyKcal, fraction: goalFraction(sum.energyKcal, goals.energyKcal) },
    protein: {
      value: Math.round(sum.proteinMg / MG_PER_G),
      goal: goals.proteinG,
      // Exact milligrams against the goal, so the ring does not jump with the rounding shown.
      fraction: goalFraction(sum.proteinMg, goals.proteinG === null ? null : goals.proteinG * MG_PER_G),
    },
    water: { value: waterMl, goal: goals.waterMl, fraction: goalFraction(waterMl, goals.waterMl) },
  };
}

export interface ExerciseLike {
  readonly kind: ExerciseKind;
  readonly intensity: Intensity;
  readonly durationMin: number;
  /** Only what the user entered; null means "show an estimate". */
  readonly energyKcal: number | null;
}

export interface ExerciseEnergy {
  readonly kcal: number;
  /** True when Tenulo estimated it (MET x weight x hours); shown with "≈", never stored. */
  readonly estimated: boolean;
}

/**
 * The user's own number when they entered one; otherwise an estimate from their latest weight.
 * Undefined when there is neither (no weigh-in yet).
 */
export function exerciseEnergy(e: ExerciseLike, latestWeightG: number | undefined): ExerciseEnergy | undefined {
  if (e.energyKcal !== null) return { kcal: e.energyKcal, estimated: false };
  const kcal = estimateExerciseKcal(e.kind, e.intensity, e.durationMin, latestWeightG);
  return kcal === undefined ? undefined : { kcal, estimated: true };
}

export interface ExerciseDay {
  readonly minutes: number;
  readonly kcal: number;
  /** Part of `kcal` is an estimate. */
  readonly estimated: boolean;
  /** False when an entry has no energy at all (no number and no weight to estimate from). */
  readonly complete: boolean;
}

export function exerciseDay(entries: readonly ExerciseLike[], latestWeightG: number | undefined): ExerciseDay {
  let minutes = 0;
  let kcal = 0;
  let estimated = false;
  let complete = true;
  for (const e of entries) {
    minutes += e.durationMin;
    const energy = exerciseEnergy(e, latestWeightG);
    if (energy === undefined) {
      complete = false;
      continue;
    }
    kcal += energy.kcal;
    estimated ||= energy.estimated;
  }
  return { minutes, kcal, estimated, complete };
}

export interface LogCounts {
  readonly weighIns: number;
  readonly foodToday: number;
  readonly waterToday: number;
  readonly exerciseToday: number;
}

/**
 * Nothing to show yet: no weigh-in ever and nothing logged today. Today then invites the first
 * weigh-in and the first meal instead of a row of empty cards.
 */
export function isFirstRun(c: LogCounts): boolean {
  return c.weighIns === 0 && c.foodToday === 0 && c.waterToday === 0 && c.exerciseToday === 0;
}
