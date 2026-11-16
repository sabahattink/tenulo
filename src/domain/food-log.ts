/**
 * The food diary's rules: meals, amounts and typed nutrient values. Amounts are integer thousandths
 * of a portion (1.5 slices = 1500), nutrients integer milligrams, energy integer kcal.
 */

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

/** 0.001 to 100 000 portions: a pinch up to 100 kg typed against a "1 g" portion. */
export const MIN_QUANTITY_MILLI = 1;
export const MAX_QUANTITY_MILLI = 100_000_000;
export const MAX_ENTRY_KCAL = 10_000;
/** Per entry, per nutrient: 2 kg of pure protein is beyond any meal. */
export const MAX_NUTRIENT_MG = 2_000_000;
/** A custom food's serving. */
export const MAX_SERVING_KCAL = 5000;
export const MAX_SERVING_NUTRIENT_G = 2000;

/** Suggested meal for a minute of the day; the user can always pick another. */
export function defaultMealFor(minuteOfDay: number): Meal {
  if (minuteOfDay >= 5 * 60 && minuteOfDay < 11 * 60) return "breakfast";
  if (minuteOfDay >= 11 * 60 && minuteOfDay < 16 * 60) return "lunch";
  if (minuteOfDay >= 17 * 60 + 30 && minuteOfDay < 22 * 60) return "dinner";
  return "snack";
}

export type ParseQuantityResult =
  | { readonly ok: true; readonly milli: number }
  | { readonly ok: false; readonly reason: "empty" | "not-a-number" | "out-of-range" };

/** "2", "1,5", "0.25", "250": up to three decimals, dot or comma. */
export function parseQuantity(input: string): ParseQuantityResult {
  const text = input.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^\d{1,6}([.,]\d{1,3})?$/.test(text)) return { ok: false, reason: "not-a-number" };
  const milli = Math.round(Number(text.replace(",", ".")) * 1000);
  if (milli < MIN_QUANTITY_MILLI || milli > MAX_QUANTITY_MILLI) return { ok: false, reason: "out-of-range" };
  return { ok: true, milli };
}

const HALF = 500;
const WHOLE = 1000;

/**
 * The amount stepper: halves below ten, whole units from ten. An odd amount ("1.25") snaps to the
 * next step in the direction pressed. Never goes below half a portion.
 */
export function stepQuantity(milli: number, direction: 1 | -1): number {
  const step = (direction === 1 ? milli : milli - 1) >= 10 * WHOLE ? WHOLE : HALF;
  const snapped = direction === 1 ? Math.floor(milli / step) * step + step : Math.ceil(milli / step) * step - step;
  return Math.max(HALF, snapped);
}

/** "2", "1,5", "0.25": thousandths without trailing zeros, with the locale's decimal mark. */
export function formatQuantity(milli: number, decimalMark: "." | ","): string {
  const whole = Math.trunc(milli / 1000);
  const fraction = String(milli % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${whole}${decimalMark}${fraction}`;
}

export type ParseGramsResult =
  | { readonly ok: true; readonly mg: number | null }
  | { readonly ok: false; readonly reason: "not-a-number" | "out-of-range" };

/** A nutrient typed in grams ("12,5") into milligrams. Empty means "unknown" (null). */
export function parseGramsToMg(input: string): ParseGramsResult {
  const text = input.trim();
  if (text === "") return { ok: true, mg: null };
  if (!/^\d{1,4}([.,]\d)?$/.test(text)) return { ok: false, reason: "not-a-number" };
  const mg = Math.round(Number(text.replace(",", ".")) * 1000);
  if (mg > MAX_SERVING_NUTRIENT_G * 1000) return { ok: false, reason: "out-of-range" };
  return { ok: true, mg };
}

/** What the diary needs from a logged entry to offer it again and to add up a day. */
export interface LoggedFood {
  readonly catalogFoodId: string | null;
  readonly customFoodId: string | null;
  readonly portionId: string | null;
  readonly quantityMilli: number;
  readonly loggedAt: number;
  readonly meal: Meal;
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly carbMg: number | null;
  readonly fatMg: number | null;
  readonly fiberMg: number | null;
}

/** "catalog:egg-boiled" or "custom:<ulid>": one key per food, whichever list it is in. */
export function sourceKey(f: Pick<LoggedFood, "catalogFoodId" | "customFoodId">): string | undefined {
  if (f.catalogFoodId !== null) return "catalog:" + f.catalogFoodId;
  if (f.customFoodId !== null) return "custom:" + f.customFoodId;
  return undefined;
}

/**
 * Each food once, most recently logged first, carrying the portion and amount used last time so it
 * can be logged again in one tap. Entries of a deleted custom food (no source left) are skipped.
 */
export function recentFoods<T extends LoggedFood>(entries: readonly T[], limit: number): T[] {
  const latest = new Map<string, T>();
  for (const e of entries) {
    const key = sourceKey(e);
    if (key === undefined) continue;
    const seen = latest.get(key);
    if (seen === undefined || e.loggedAt > seen.loggedAt) latest.set(key, e);
  }
  return [...latest.values()].sort((a, b) => b.loggedAt - a.loggedAt).slice(0, limit);
}

export type NutrientKey = "proteinMg" | "carbMg" | "fatMg" | "fiberMg";
const NUTRIENTS: readonly NutrientKey[] = ["proteinMg", "carbMg", "fatMg", "fiberMg"];

export interface Totals {
  readonly energyKcal: number;
  readonly proteinMg: number;
  readonly carbMg: number;
  readonly fatMg: number;
  readonly fiberMg: number;
  /** True where some entry did not know that nutrient, so the sum is a lower bound. */
  readonly incomplete: Readonly<Record<NutrientKey, boolean>>;
}

/** Sum of a meal or a day. Unknown nutrients count as zero and mark the total as incomplete. */
export function totals(entries: readonly Pick<LoggedFood, "energyKcal" | NutrientKey>[]): Totals {
  const sum = { energyKcal: 0, proteinMg: 0, carbMg: 0, fatMg: 0, fiberMg: 0 };
  const incomplete = { proteinMg: false, carbMg: false, fatMg: false, fiberMg: false };
  for (const e of entries) {
    sum.energyKcal += e.energyKcal;
    for (const k of NUTRIENTS) {
      const v = e[k];
      if (v === null) incomplete[k] = true;
      else sum[k] += v;
    }
  }
  return { ...sum, incomplete };
}
