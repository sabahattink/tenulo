import { describe, expect, it } from "vitest";
import { CATALOG_FOODS, findCatalogFood } from "./catalog";
import { FOOD_CATEGORIES, FOOD_LOCALES } from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isTrimmedText = (s: string): boolean => s.length > 0 && s.trim() === s;

/**
 * The energy SR Legacy states for a food comes from food-specific Atwater factors, so it differs
 * from the general 4/4/9 kcal per gram of protein/carbohydrate/fat. The specific factors range
 * from about 3.6 to 4.4 for carbohydrate and protein and 8.4 to 9.0 for fat, which puts a food up
 * to about 10 % away from the general estimate (honey: 3.68 vs 4 for sugars, 8 %; walnuts: 8.37
 * vs 9 for fat, 5 %). SR's "carbohydrate by difference" includes fibre, which yields about
 * 2 kcal/g rather than 4, so fibre is counted at 2 here. The 20 kcal floor covers foods so lean
 * that rounding or energy outside the three macronutrients (acetic acid in vinegar) dominates.
 * There is no alcohol in the list. Anything outside this band is a data-entry error: a wrong SR
 * row, kJ taken for kcal, a recipe yield off by a factor.
 */
function atwaterKcal(p: { proteinMg: number; carbMg: number; fatMg: number; fiberMg: number }): number {
  return (4 * p.proteinMg + 4 * (p.carbMg - p.fiberMg) + 2 * p.fiberMg + 9 * p.fatMg) / 1000;
}
const ATWATER_TOLERANCE_KCAL = 20;
const ATWATER_TOLERANCE_RATIO = 0.1;

describe("bundled food list", () => {
  it("has a few hundred foods with unique kebab-case ids", () => {
    expect(CATALOG_FOODS.length).toBeGreaterThanOrEqual(220);
    const ids = CATALOG_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(ID_PATTERN);
  });

  it("names every food, and every alias, in Turkish and English", () => {
    for (const food of CATALOG_FOODS) {
      for (const locale of FOOD_LOCALES) {
        expect(isTrimmedText(food.name[locale]), `${food.id} ${locale}`).toBe(true);
        for (const alias of food.aliases?.[locale] ?? []) {
          expect(isTrimmedText(alias), `${food.id} alias ${alias}`).toBe(true);
        }
      }
    }
  });

  it("uses only known categories, and every category has foods", () => {
    const used = new Set(CATALOG_FOODS.map((f) => f.category));
    for (const category of used) expect(FOOD_CATEGORIES).toContain(category);
    for (const category of FOOD_CATEGORIES) expect(used.has(category), category).toBe(true);
  });

  it("stores per-100 g values as plausible non-negative integers", () => {
    for (const { id, per100g } of CATALOG_FOODS) {
      for (const [key, value] of Object.entries(per100g)) {
        expect(Number.isInteger(value) && value >= 0, `${id} ${key}=${value}`).toBe(true);
      }
      expect(per100g.energyKcal, id).toBeLessThanOrEqual(900);
      // 100 g of food cannot hold more than 100 g of nutrients; fibre is part of carbohydrate.
      expect(per100g.proteinMg + per100g.carbMg + per100g.fatMg, id).toBeLessThanOrEqual(100_000);
      expect(per100g.fiberMg, id).toBeLessThanOrEqual(per100g.carbMg);
    }
  });

  it("states energy that agrees with protein, carbohydrate and fat", () => {
    for (const { id, per100g } of CATALOG_FOODS) {
      const estimate = atwaterKcal(per100g);
      const tolerance = Math.max(ATWATER_TOLERANCE_KCAL, ATWATER_TOLERANCE_RATIO * estimate);
      expect(Math.abs(per100g.energyKcal - estimate), `${id}: ${per100g.energyKcal} vs ${estimate}`).toBeLessThanOrEqual(
        tolerance,
      );
    }
  });

  it("gives every food a natural default portion, then 100 g and 1 g", () => {
    for (const { id, portions } of CATALOG_FOODS) {
      expect(portions.length, id).toBeGreaterThanOrEqual(3);
      const [first] = portions;
      expect(first?.id === "100g" || first?.id === "g", `${id} default`).toBe(false);
      expect(portions.find((p) => p.id === "100g")?.grams, id).toBe(100);
      expect(portions.find((p) => p.id === "g")?.grams, id).toBe(1);
      expect(new Set(portions.map((p) => p.id)).size, id).toBe(portions.length);
      for (const portion of portions) {
        expect(Number.isInteger(portion.grams) && portion.grams > 0, `${id} ${portion.id}`).toBe(true);
        for (const locale of FOOD_LOCALES) {
          expect(isTrimmedText(portion.label[locale]), `${id} ${portion.id} ${locale}`).toBe(true);
        }
      }
    }
  });
});

describe("findCatalogFood", () => {
  it("finds a food by id", () => {
    expect(findCatalogFood("egg-boiled")?.name.tr).toBe("Haşlanmış yumurta");
  });

  it("returns undefined for an unknown id, such as one removed from a later list", () => {
    expect(findCatalogFood("no-such-food")).toBeUndefined();
  });
});
