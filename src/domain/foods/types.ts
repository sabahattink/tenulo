/**
 * The bundled food list (docs/adr/0005-bundled-food-list.md). Every value is per 100 g of the food
 * as eaten, and every value is an integer: energy in kcal, nutrients in milligrams. Liquids are
 * weighed at 1 g per ml.
 */

export const FOOD_LOCALES = ["tr", "en"] as const;
export type FoodLocale = (typeof FOOD_LOCALES)[number];

/** Order is the display order. scripts/foods/foods.json lists the same categories. */
export const FOOD_CATEGORIES = [
  "breakfast",
  "bakery",
  "soup",
  "main",
  "grain",
  "seafood",
  "side",
  "dairy",
  "protein",
  "fruit",
  "vegetable",
  "nuts",
  "dessert",
  "snack",
  "drink",
  "condiment",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface LocalizedText {
  readonly tr: string;
  readonly en: string;
}

/** Extra search words per language, such as "yumurta" for a boiled egg. */
export interface FoodAliases {
  readonly tr?: readonly string[];
  readonly en?: readonly string[];
}

/** Energy in kcal and nutrients in milligrams, all integers. */
export interface Nutrients {
  readonly energyKcal: number;
  readonly proteinMg: number;
  readonly carbMg: number;
  readonly fatMg: number;
  readonly fiberMg: number;
}

/** Nutrients in 100 g of a food as eaten. */
export type NutrientsPer100g = Nutrients;

export type PortionLabel = LocalizedText;

/** A way to measure a food: "adet" of 50 g, "su bardağı" of 200 g. `grams` is a positive integer. */
export interface CatalogPortion {
  readonly id: string;
  readonly label: PortionLabel;
  readonly grams: number;
}

export interface CatalogFood {
  /** Stable kebab-case id, stored in `food_entry.catalog_food_id`; never reused for another food. */
  readonly id: string;
  readonly name: LocalizedText;
  readonly aliases?: FoodAliases;
  readonly category: FoodCategory;
  readonly per100g: NutrientsPer100g;
  /** The default portion first; every food also has "100g" (100 g) and "g" (1 g). */
  readonly portions: readonly CatalogPortion[];
}
