import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate } from "./date";
import { DEFAULT_FORECAST, forecast, trendRate } from "./forecast";
import { type TrendPoint, smoothedTrend } from "./trend";
import { defaultWeightUnit, formatWeight, fromGrams, isPlausibleWeight, toGrams } from "./weight";

const start = parseLocalDate("2026-01-01");
const series = (n: number, f: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), weightG: f(i) }));

describe("weight units", () => {
  it("stores integer grams", () => {
    expect(toGrams(82.4, "kg")).toBe(82_400);
    expect(toGrams(181.7, "lb")).toBe(82_418);
    expect(Number.isInteger(toGrams(0.1 + 0.2, "kg"))).toBe(true);
  });

  it("survives a kg → lb → kg round trip within a gram", () => {
    const g = toGrams(95.3, "kg");
    expect(Math.abs(toGrams(fromGrams(g, "lb"), "lb") - g)).toBeLessThanOrEqual(1);
  });

  it("formats and validates", () => {
    expect(formatWeight(82_418, "kg")).toBe("82.4 kg");
    expect(isPlausibleWeight(82_400)).toBe(true);
    expect(isPlausibleWeight(8_240)).toBe(false);
    expect(() => toGrams(Number.NaN, "kg")).toThrow(RangeError);
  });
});

describe("defaultWeightUnit", () => {
  it("suggests pounds where people weigh themselves in pounds", () => {
    expect(defaultWeightUnit("en-US")).toBe("lb");
    expect(defaultWeightUnit("es-US")).toBe("lb");
    expect(defaultWeightUnit("en-LR")).toBe("lb");
    expect(defaultWeightUnit("my-MM")).toBe("lb");
  });

  it("suggests kilograms everywhere else and when the locale names no region", () => {
    expect(defaultWeightUnit("en-GB")).toBe("kg");
    expect(defaultWeightUnit("tr-TR")).toBe("kg");
    expect(defaultWeightUnit("az-Latn-AZ")).toBe("kg");
    expect(defaultWeightUnit("en")).toBe("kg");
    expect(defaultWeightUnit("")).toBe("kg");
  });

  it("finds the region in underscore and extended tags, never inside an extension", () => {
    expect(defaultWeightUnit("en_US")).toBe("lb");
    expect(defaultWeightUnit("en-us")).toBe("lb");
    expect(defaultWeightUnit("en-US-u-ca-gregory")).toBe("lb");
    expect(defaultWeightUnit("de-u-rg-uszzzz")).toBe("kg");
    expect(defaultWeightUnit("en-x-us")).toBe("kg");
  });
});

describe("smoothedTrend", () => {
  it("starts at the first reading and is order independent", () => {
    const readings = series(5, (i) => 90_000 - i * 100);
    const a = smoothedTrend(readings);
    const b = smoothedTrend([...readings].reverse());
    expect(a).toEqual(b);
    expect(a[0]?.trendG).toBe(90_000);
  });

  it("averages several readings on the same day", () => {
    const d = parseLocalDate("2026-01-01");
    const t = smoothedTrend([
      { date: d, weightG: 80_000 },
      { date: d, weightG: 81_001 },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]?.valueG).toBe(80_501);
  });

  it("damps a single-day spike", () => {
    const readings = series(20, (i) => (i === 10 ? 82_000 : 80_000));
    const spike = smoothedTrend(readings)[10];
    expect(spike?.valueG).toBe(82_000);
    expect(spike?.trendG).toBeCloseTo(80_200, 6);
  });

  it("treats a gap as several days of decay", () => {
    const d0 = parseLocalDate("2026-01-01");
    const gap = smoothedTrend([
      { date: d0, weightG: 90_000 },
      { date: addDays(d0, 7), weightG: 80_000 },
    ]);
    const expected = 90_000 + (1 - 0.9 ** 7) * (80_000 - 90_000);
    expect(gap[1]?.trendG).toBeCloseTo(expected, 6);
  });

  it("rejects invalid alpha", () => {
    expect(() => smoothedTrend([], 0)).toThrow(RangeError);
    expect(() => smoothedTrend([], 1.5)).toThrow(RangeError);
  });
});

describe("forecast", () => {
  const trendOf = (n: number, f: (i: number) => number): TrendPoint[] =>
    series(n, f).map((r) => ({ date: r.date, valueG: r.weightG, trendG: r.weightG }));

  it("computes an exact least-squares slope", () => {
    expect(trendRate([0, 1, 2, 3].map((day) => ({ day, trendG: 100 - 50 * day })))).toBeCloseTo(-50, 9);
  });

  it("waits for enough data", () => {
    expect(forecast(trendOf(5, () => 90_000), 80_000)).toEqual({
      kind: "insufficient-data",
      points: 5,
      needed: DEFAULT_FORECAST.minPoints,
    });
  });

  it("projects the goal date on a steady loss", () => {
    // 100 g/day for 21 days, last trend 88 000 g → 8 000 g to go → 80 days.
    const f = forecast(trendOf(21, (i) => 90_000 - i * 100), 80_000);
    expect(f.kind).toBe("on-track");
    if (f.kind === "on-track") {
      expect(f.rateGPerDay).toBeCloseTo(-100, 9);
      expect(f.goalDate).toBe(addDays(start, 20 + 80));
    }
  });

  it("does not invent a date when moving away, flat, or far off", () => {
    expect(forecast(trendOf(21, (i) => 80_000 + i * 50), 75_000).kind).toBe("away-from-goal");
    expect(forecast(trendOf(21, () => 80_000), 75_000).kind).toBe("steady");
    expect(forecast(trendOf(21, (i) => 150_000 - i * 11), 60_000).kind).toBe("beyond-horizon");
    expect(forecast(trendOf(21, () => 80_050), 80_000).kind).toBe("reached");
    expect(forecast(trendOf(21, () => 80_000), null).kind).toBe("no-goal");
  });
});
