/**
 * Body weight is stored as an integer number of grams. Floats never reach the database, so
 * repeated unit conversions and edits cannot drift. Conversion to display units happens at the
 * edge, once.
 */

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** Where a reading came from. Health Connect readings keep their Health Connect record id. */
export const WEIGHT_SOURCES = ["manual", "health_connect"] as const;
export type WeightSource = (typeof WEIGHT_SOURCES)[number];

/** Exact by definition (international avoirdupois pound, 1959). */
export const GRAMS_PER_POUND = 453.59237;

/** Plausible human body weight; anything outside is almost certainly a typo. */
export const MIN_WEIGHT_G = 20_000;
export const MAX_WEIGHT_G = 400_000;

export function toGrams(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value)) throw new RangeError(`Weight must be a finite number: ${value}`);
  const grams = unit === "kg" ? value * 1000 : value * GRAMS_PER_POUND;
  return Math.round(grams);
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  return unit === "kg" ? grams / 1000 : grams / GRAMS_PER_POUND;
}

export function isPlausibleWeight(grams: number): boolean {
  return Number.isInteger(grams) && grams >= MIN_WEIGHT_G && grams <= MAX_WEIGHT_G;
}

/** Display value rounded to one decimal, e.g. 82.4 kg or 181.7 lb. */
export function formatWeight(grams: number, unit: WeightUnit): string {
  return `${fromGrams(grams, unit).toFixed(1)} ${unit}`;
}

/** Signed change for display, with a true minus sign: "−0.6 kg", "+1.2 lb", "0.0 kg". */
export function formatWeightChange(grams: number, unit: WeightUnit): string {
  const value = fromGrams(Math.abs(grams), unit).toFixed(1);
  if (value === "0.0") return `0.0 ${unit}`;
  return `${grams < 0 ? "\u2212" : "+"}${value} ${unit}`;
}

/** Number only, for input fields and big headline figures. */
export function weightNumber(grams: number, unit: WeightUnit): string {
  return fromGrams(grams, unit).toFixed(1);
}
