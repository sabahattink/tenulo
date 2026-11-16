import type { Nutrients, NutrientsPer100g } from "./types";

/**
 * Integer arithmetic for logged food. Amounts are thousandths of a portion (`quantityMilli`,
 * 1.5 pieces = 1500), weights are whole grams, energy whole kcal, nutrients whole milligrams.
 * Every result is rounded once, half away from zero (0.5 -> 1), so no float ever leaves here.
 */

const MILLI = 1000;
const PER_100_G = 100;

const NUTRIENT_KEYS = ["energyKcal", "proteinMg", "carbMg", "fatMg", "fiberMg"] as const;

function assertCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${value}`);
  }
}

/** numerator / denominator for non-negative safe integers, rounded half away from zero. */
function divideRounded(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator)) throw new RangeError(`Value too large: ${numerator}`);
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  return 2 * remainder >= denominator ? quotient + 1 : quotient;
}

/** Grams eaten: `quantityMilli` thousandths of a portion of `gramsPerPortion` grams. */
export function portionGrams(gramsPerPortion: number, quantityMilli: number): number {
  assertCount(gramsPerPortion, "gramsPerPortion");
  assertCount(quantityMilli, "quantityMilli");
  return divideRounded(gramsPerPortion * quantityMilli, MILLI);
}

/**
 * Energy and nutrients in `grams` of a food. Logged entries keep these as a snapshot, so they are
 * computed from the stored whole grams and can always be recomputed from them.
 */
export function nutritionFor(per100g: NutrientsPer100g, grams: number): Nutrients {
  assertCount(grams, "grams");
  for (const key of NUTRIENT_KEYS) assertCount(per100g[key], key);
  return {
    energyKcal: divideRounded(per100g.energyKcal * grams, PER_100_G),
    proteinMg: divideRounded(per100g.proteinMg * grams, PER_100_G),
    carbMg: divideRounded(per100g.carbMg * grams, PER_100_G),
    fatMg: divideRounded(per100g.fatMg * grams, PER_100_G),
    fiberMg: divideRounded(per100g.fiberMg * grams, PER_100_G),
  };
}

/**
 * What one logged entry holds. Energy is always known; a nutrient is null when the user saved a
 * custom food without it.
 */
export interface NutrientSnapshot {
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly carbMg: number | null;
  readonly fatMg: number | null;
  readonly fiberMg: number | null;
}

/** The sum of the known values; `hasMissing` when at least one entry did not know this one. */
export interface NutrientSum {
  readonly sum: number;
  readonly hasMissing: boolean;
}

export interface NutrientTotals {
  readonly energyKcal: number;
  readonly proteinMg: NutrientSum;
  readonly carbMg: NutrientSum;
  readonly fatMg: NutrientSum;
  readonly fiberMg: NutrientSum;
}

function sumOf(values: readonly (number | null)[], name: string): NutrientSum {
  let sum = 0;
  let hasMissing = false;
  for (const value of values) {
    if (value === null) {
      hasMissing = true;
      continue;
    }
    assertCount(value, name);
    sum += value;
  }
  return { sum, hasMissing };
}

/** Totals for a meal or a day. An unknown nutrient counts as missing, never as zero. */
export function sumNutrients(entries: readonly NutrientSnapshot[]): NutrientTotals {
  const total = (key: keyof NutrientSnapshot): NutrientSum => sumOf(entries.map((e) => e[key]), key);
  return {
    energyKcal: total("energyKcal").sum,
    proteinMg: total("proteinMg"),
    carbMg: total("carbMg"),
    fatMg: total("fatMg"),
    fiberMg: total("fiberMg"),
  };
}
