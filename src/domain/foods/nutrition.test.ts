import { describe, expect, it } from "vitest";
import { type NutrientSnapshot, nutritionFor, portionGrams, sumNutrients } from "./nutrition";
import type { NutrientsPer100g } from "./types";

const boiledEgg: NutrientsPer100g = {
  energyKcal: 155,
  proteinMg: 12_580,
  carbMg: 1_120,
  fatMg: 10_610,
  fiberMg: 0,
};

describe("portionGrams", () => {
  it("multiplies the portion by the amount in thousandths", () => {
    expect(portionGrams(50, 1_000)).toBe(50);
    expect(portionGrams(50, 1_500)).toBe(75);
    expect(portionGrams(1, 150_000)).toBe(150);
    expect(portionGrams(200, 250)).toBe(50);
  });

  it("rounds half away from zero, once", () => {
    expect(portionGrams(33, 1_500)).toBe(50); // 49.5
    expect(portionGrams(46, 250)).toBe(12); // 11.5
    expect(portionGrams(100, 5)).toBe(1); // 0.5
    expect(portionGrams(100, 4)).toBe(0); // 0.4
    expect(portionGrams(7, 333)).toBe(2); // 2.331
  });

  it("allows a zero amount", () => {
    expect(portionGrams(50, 0)).toBe(0);
  });

  it("refuses fractions, negatives and unsafe sizes", () => {
    expect(() => portionGrams(50.5, 1_000)).toThrow(RangeError);
    expect(() => portionGrams(50, 1.5)).toThrow(RangeError);
    expect(() => portionGrams(-50, 1_000)).toThrow(RangeError);
    expect(() => portionGrams(50, -1)).toThrow(RangeError);
    expect(() => portionGrams(Number.NaN, 1_000)).toThrow(RangeError);
    expect(() => portionGrams(Number.MAX_SAFE_INTEGER, 1_000)).toThrow(RangeError);
  });
});

describe("nutritionFor", () => {
  it("scales per-100 g values to the eaten grams", () => {
    expect(nutritionFor(boiledEgg, 100)).toEqual(boiledEgg);
    expect(nutritionFor(boiledEgg, 200)).toEqual({
      energyKcal: 310,
      proteinMg: 25_160,
      carbMg: 2_240,
      fatMg: 21_220,
      fiberMg: 0,
    });
  });

  it("rounds each value half away from zero", () => {
    // 77.5 kcal, 6290 mg, 560 mg, 5305 mg.
    expect(nutritionFor(boiledEgg, 50)).toEqual({
      energyKcal: 78,
      proteinMg: 6_290,
      carbMg: 560,
      fatMg: 5_305,
      fiberMg: 0,
    });
    // 1 tbsp olive oil: 884 kcal x 14 / 100 = 123.76.
    const oil: NutrientsPer100g = { energyKcal: 884, proteinMg: 0, carbMg: 0, fatMg: 100_000, fiberMg: 0 };
    expect(nutritionFor(oil, 14)).toEqual({ energyKcal: 124, proteinMg: 0, carbMg: 0, fatMg: 14_000, fiberMg: 0 });
    // 1 g of an apple: 0.52 kcal, 2.6 mg protein, 138.1 mg carbohydrate, 1.7 mg fat, 24 mg fibre.
    const apple: NutrientsPer100g = { energyKcal: 52, proteinMg: 260, carbMg: 13_810, fatMg: 170, fiberMg: 2_400 };
    expect(nutritionFor(apple, 1)).toEqual({ energyKcal: 1, proteinMg: 3, carbMg: 138, fatMg: 2, fiberMg: 24 });
  });

  it("returns only integers", () => {
    for (let grams = 0; grams <= 1_000; grams += 7) {
      for (const value of Object.values(nutritionFor(boiledEgg, grams))) {
        expect(Number.isInteger(value), `${grams} g`).toBe(true);
      }
    }
  });

  it("refuses fractional or negative grams and per-100 g values", () => {
    expect(() => nutritionFor(boiledEgg, 1.5)).toThrow(RangeError);
    expect(() => nutritionFor(boiledEgg, -1)).toThrow(RangeError);
    expect(() => nutritionFor({ ...boiledEgg, fatMg: 10.5 }, 100)).toThrow(RangeError);
    expect(() => nutritionFor({ ...boiledEgg, energyKcal: -1 }, 100)).toThrow(RangeError);
  });
});

describe("sumNutrients", () => {
  const known = (energyKcal: number, mg: number): NutrientSnapshot => ({
    energyKcal,
    proteinMg: mg,
    carbMg: mg,
    fatMg: mg,
    fiberMg: mg,
  });

  it("is zero and complete for no entries", () => {
    expect(sumNutrients([])).toEqual({
      energyKcal: 0,
      proteinMg: { sum: 0, hasMissing: false },
      carbMg: { sum: 0, hasMissing: false },
      fatMg: { sum: 0, hasMissing: false },
      fiberMg: { sum: 0, hasMissing: false },
    });
  });

  it("adds every nutrient", () => {
    expect(sumNutrients([known(155, 1_000), known(52, 250)])).toEqual({
      energyKcal: 207,
      proteinMg: { sum: 1_250, hasMissing: false },
      carbMg: { sum: 1_250, hasMissing: false },
      fatMg: { sum: 1_250, hasMissing: false },
      fiberMg: { sum: 1_250, hasMissing: false },
    });
  });

  it("sums the known values and flags a nutrient some entries lack", () => {
    // A custom food the user saved with energy and protein only.
    const custom: NutrientSnapshot = { energyKcal: 300, proteinMg: 20_000, carbMg: null, fatMg: null, fiberMg: null };
    const totals = sumNutrients([known(100, 500), custom, { ...custom, fiberMg: 100 }]);
    expect(totals.energyKcal).toBe(700);
    expect(totals.proteinMg).toEqual({ sum: 40_500, hasMissing: false });
    expect(totals.carbMg).toEqual({ sum: 500, hasMissing: true });
    expect(totals.fatMg).toEqual({ sum: 500, hasMissing: true });
    expect(totals.fiberMg).toEqual({ sum: 600, hasMissing: true });
  });

  it("refuses values that are not non-negative integers", () => {
    expect(() => sumNutrients([known(10.5, 0)])).toThrow(RangeError);
    expect(() => sumNutrients([known(10, -1)])).toThrow(RangeError);
  });
});
