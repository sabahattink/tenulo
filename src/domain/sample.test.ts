import { describe, expect, it } from "vitest";
import { addDays, diffDays, parseLocalDate as d } from "./date";
import { EXERCISE_KINDS, INTENSITIES, isDuration } from "./exercise";
import { MEALS } from "./food-log";
import { findCatalogFood } from "./foods/catalog";
import { nutritionFor, portionGrams } from "./foods/nutrition";
import { MEASUREMENT_SITES, isPlausibleLength } from "./measurement";
import {
  SAMPLE_MEALS,
  mulberry32,
  sampleExercise,
  sampleFoodLog,
  sampleMeasurements,
  sampleWater,
  sampleWeights,
} from "./sample";
import { isWaterAmount } from "./water";

const endDate = d("2026-11-17");
const period = { endDate, days: 28, seed: 11 };

const inPeriod = (date: string, days: number) => {
  const back = diffDays(d(date), endDate);
  return back >= 0 && back < days;
};

describe("mulberry32", () => {
  it("repeats the same numbers for a seed, all in [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const first = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(first);
    for (const x of first) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(8)()).not.toBe(first[0]);
  });
});

describe("sampleWeights", () => {
  const options = { endDate, days: 63, startG: 96_400, rateGPerDay: -85, noiseG: 650, skipChance: 0.12, seed: 7 };

  it("ends today, skips some days and rounds to 100 g", () => {
    const w = sampleWeights(options);
    expect(w.at(-1)?.date).toBe(endDate);
    expect(w.length).toBeLessThan(63);
    expect(w.length).toBeGreaterThan(40);
    expect(w.every((r) => r.weightG % 100 === 0 && inPeriod(r.date, 63))).toBe(true);
    expect(sampleWeights(options)).toEqual(w);
  });
});

describe("sampleFoodLog", () => {
  const log = sampleFoodLog({ ...period, lang: "tr" });

  it("is the same on every run", () => {
    expect(sampleFoodLog({ ...period, lang: "tr" })).toEqual(log);
  });

  it("uses only foods and portions from the bundled list, every meal plate included", () => {
    for (const plates of Object.values(SAMPLE_MEALS)) {
      for (const plate of plates) {
        for (const p of plate) {
          expect(findCatalogFood(p.id)?.portions.some((portion) => portion.id === p.portion), `${p.id} ${p.portion}`).toBe(true);
        }
      }
    }
  });

  it("computes every entry's nutrients the way the diary does, in whole numbers", () => {
    for (const e of log) {
      const food = findCatalogFood(e.catalogFoodId);
      const portion = food?.portions.find((p) => p.id === e.portionId);
      expect(portion).toBeDefined();
      if (food === undefined || portion === undefined) continue;
      expect(e.grams).toBe(portionGrams(portion.grams, e.quantityMilli));
      expect({ energyKcal: e.energyKcal, proteinMg: e.proteinMg, carbMg: e.carbMg, fatMg: e.fatMg, fiberMg: e.fiberMg }).toEqual(
        nutritionFor(food.per100g, e.grams),
      );
      expect(Number.isInteger(e.quantityMilli)).toBe(true);
    }
  });

  it("names foods and portions in the user's language", () => {
    expect(log.some((e) => e.name === "Haşlanmış yumurta")).toBe(true);
    expect(log.some((e) => e.portionLabel === "adet")).toBe(true);
    const english = sampleFoodLog({ ...period, lang: "en" });
    expect(english.map((e) => e.catalogFoodId)).toEqual(log.map((e) => e.catalogFoodId));
    expect(english.some((e) => e.name === "Boiled egg")).toBe(true);
  });

  it("stays inside the period, with today only partly logged and plausible days before it", () => {
    expect(log.every((e) => inPeriod(e.date, 28) && MEALS.includes(e.meal) && e.minuteOfDay < 24 * 60)).toBe(true);
    expect(new Set(log.filter((e) => e.date === endDate).map((e) => e.meal))).toEqual(new Set(["breakfast", "lunch"]));
    const byDay = new Map<string, number>();
    for (const e of log) if (e.date !== endDate) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.energyKcal);
    expect(byDay.size).toBeGreaterThan(18);
    expect(byDay.size).toBeLessThan(28);
    for (const kcal of byDay.values()) {
      expect(kcal).toBeGreaterThan(150);
      expect(kcal).toBeLessThan(2600);
    }
  });
});

describe("sampleWater", () => {
  it("logs valid amounts on most days, a few glasses so far today", () => {
    const water = sampleWater(period);
    expect(sampleWater(period)).toEqual(water);
    expect(water.every((w) => isWaterAmount(w.amountMl) && inPeriod(w.date, 28))).toBe(true);
    expect(water.filter((w) => w.date === endDate)).toHaveLength(3);
    const days = new Set(water.map((w) => w.date));
    expect(days.size).toBeGreaterThan(18);
    expect(days.size).toBeLessThanOrEqual(28);
  });
});

describe("sampleMeasurements", () => {
  const readings = sampleMeasurements({ endDate, days: 63, seed: 5 });

  it("measures once a week from the first day: waist and hip every time, the rest every other week", () => {
    const dates = [...new Set(readings.map((r) => r.date))];
    expect(dates).toEqual(Array.from({ length: 9 }, (_, i) => addDays(endDate, -62 + i * 7)));
    expect(readings.filter((r) => r.site === "waist")).toHaveLength(9);
    expect(readings.filter((r) => r.site === "neck")).toHaveLength(5);
    expect(new Set(readings.map((r) => r.site))).toEqual(new Set(MEASUREMENT_SITES));
  });

  it("reads to half a centimetre, within plausible lengths, and comes down over the weeks", () => {
    expect(readings.every((r) => isPlausibleLength(r.lengthMm) && r.lengthMm % 5 === 0)).toBe(true);
    for (const site of MEASUREMENT_SITES) {
      const series = readings.filter((r) => r.site === site).map((r) => r.lengthMm);
      expect(series.at(-1) ?? 0, site).toBeLessThan(series[0] ?? 0);
    }
  });
});

describe("sampleExercise", () => {
  it("logs valid sessions of several kinds inside the period", () => {
    const sessions = sampleExercise({ endDate, days: 42, seed: 3 });
    expect(sampleExercise({ endDate, days: 42, seed: 3 })).toEqual(sessions);
    expect(sessions.length).toBeGreaterThan(20);
    for (const s of sessions) {
      expect(EXERCISE_KINDS).toContain(s.kind);
      expect(INTENSITIES).toContain(s.intensity);
      expect(isDuration(s.durationMin)).toBe(true);
      expect(inPeriod(s.date, 42)).toBe(true);
    }
    expect(new Set(sessions.map((s) => s.kind))).toEqual(new Set(["walking", "strength", "yoga"]));
  });
});
