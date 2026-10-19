import { type WeightUnit, isPlausibleWeight, toGrams } from "./weight";

export type ParseWeightResult =
  | { readonly ok: true; readonly grams: number }
  | { readonly ok: false; readonly reason: "empty" | "not-a-number" | "implausible" };

/**
 * Parses what a person types into the weight field.
 *
 * Accepts a dot or a comma as the decimal separator ("82.4", "82,4"), because Turkish and
 * Azerbaijani keyboards default to a comma. Thousands separators are not accepted: a body weight
 * never needs one, and "1,234" would otherwise be ambiguous.
 */
export function parseWeightInput(input: string, unit: WeightUnit): ParseWeightResult {
  const text = input.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(text)) return { ok: false, reason: "not-a-number" };
  const grams = toGrams(Number(text.replace(",", ".")), unit);
  if (!isPlausibleWeight(grams)) return { ok: false, reason: "implausible" };
  return { ok: true, grams };
}

export type ParseDoseResult =
  | { readonly ok: true; readonly mcg: number }
  | { readonly ok: false; readonly reason: "empty" | "not-a-number" | "out-of-range" };

/** Doses are typed in mg ("0,25", "2.5", "15") and stored as integer micrograms. */
export const MIN_DOSE_MCG = 10;
export const MAX_DOSE_MCG = 50_000;

export function parseDoseInput(input: string): ParseDoseResult {
  const text = input.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^\d{1,2}([.,]\d{1,3})?$/.test(text)) return { ok: false, reason: "not-a-number" };
  const mcg = Math.round(Number(text.replace(",", ".")) * 1000);
  if (mcg < MIN_DOSE_MCG || mcg > MAX_DOSE_MCG) return { ok: false, reason: "out-of-range" };
  return { ok: true, mcg };
}

/** "0.25 mg", "2.5 mg", "15 mg": no trailing zeros. */
export function formatDose(mcg: number): string {
  return `${String(mcg / 1000)} mg`;
}
