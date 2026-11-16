/**
 * Units and number phrases of the food screens. The unit symbols are the same in Turkish and
 * English (as "kg" is for weight), so they live here rather than in the dictionaries.
 */
import { gramsText } from "../../domain/food-entry";
import type { I18n } from "../../i18n";

export const KCAL = "kcal";
export const GRAM = "g";
export const ML = "ml";

export function decimalMark(i18n: Pick<I18n, "t">): "." | "," {
  return i18n.t.number.decimalMark === "," ? "," : ".";
}

/** "1,850 kcal" / "1.850 kcal". */
export function kcalText(i18n: Pick<I18n, "f">, kcal: number): string {
  return `${i18n.f.integer(kcal)} ${KCAL}`;
}

/** "6.3 g" / "6,3 g" below 10 g, whole grams above. */
export function gramsFromMg(i18n: Pick<I18n, "t">, mg: number): string {
  return `${gramsText(mg, decimalMark(i18n))} ${GRAM}`;
}
