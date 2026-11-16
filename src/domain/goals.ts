/**
 * Daily goals are the user's own numbers. Tenulo stores and shows them back; it never computes or
 * suggests one (the same rule as the dose plan). The ranges only catch typos.
 */

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const ENERGY_GOAL_KCAL = { min: 500, max: 6000 } as const satisfies Range;
export const PROTEIN_GOAL_G = { min: 10, max: 400 } as const satisfies Range;
export const WATER_GOAL_ML = { min: 250, max: 10_000 } as const satisfies Range;
/** What one tap of "+ glass" adds. */
export const WATER_SERVING_ML = { min: 50, max: 2000, default: 250 } as const satisfies Range & { default: number };

export type ParseWholeNumberResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: "empty" | "not-a-number" | "out-of-range" };

/** A whole number typed into a goal field. No separators: "1800", never "1.800". */
export function parseWholeNumber(input: string, range: Range): ParseWholeNumberResult {
  const text = input.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^\d{1,6}$/.test(text)) return { ok: false, reason: "not-a-number" };
  const value = Number(text);
  if (value < range.min || value > range.max) return { ok: false, reason: "out-of-range" };
  return { ok: true, value };
}

/** Share of the goal reached, 0 to 1 (capped); undefined when there is no goal. */
export function goalFraction(value: number, goal: number | null): number | undefined {
  if (goal === null || goal <= 0) return undefined;
  return Math.min(1, Math.max(0, value / goal));
}
