import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import { mealLines, measurementSittings, waterLines, weightOnOrBefore } from "./timeline-groups";

describe("mealLines", () => {
  it("makes one line per meal per day with its foods and energy added up", () => {
    const lines = mealLines([
      { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 100, energyKcal: 300 },
      { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 140, energyKcal: 240 },
      { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 120, energyKcal: 100 },
      { localDate: "2026-11-16", meal: "breakfast", foods: 1, loggedAt: 50, energyKcal: 410 },
      { localDate: "2026-11-17", meal: "dinner", foods: 1, loggedAt: 300, energyKcal: 520 },
    ]);
    expect(lines).toEqual([
      { id: "2026-11-17|dinner", date: "2026-11-17", meal: "dinner", foods: 1, energyKcal: 520, at: 300 },
      { id: "2026-11-16|breakfast", date: "2026-11-16", meal: "breakfast", foods: 1, energyKcal: 410, at: 50 },
      { id: "2026-11-16|lunch", date: "2026-11-16", meal: "lunch", foods: 3, energyKcal: 640, at: 140 },
    ]);
  });

  it("keeps the same meal on different days apart", () => {
    const lines = mealLines([
      { localDate: "2026-11-15", meal: "snack", foods: 1, loggedAt: 1, energyKcal: 90 },
      { localDate: "2026-11-16", meal: "snack", foods: 1, loggedAt: 2, energyKcal: 60 },
    ]);
    expect(lines.map((l) => l.id)).toEqual(["2026-11-16|snack", "2026-11-15|snack"]);
    expect(mealLines([])).toEqual([]);
  });

  it("takes meals the database already added up, counting their foods", () => {
    const lines = mealLines([
      { localDate: "2026-11-16", meal: "dinner", foods: 3, loggedAt: 70, energyKcal: 610 },
      { localDate: "2026-11-16", meal: "dinner", foods: 1, loggedAt: 90, energyKcal: 120 },
    ]);
    expect(lines).toEqual([{ id: "2026-11-16|dinner", date: "2026-11-16", meal: "dinner", foods: 4, energyKcal: 730, at: 90 }]);
  });
});

describe("waterLines", () => {
  it("adds up each day's water and keeps the entries behind the total", () => {
    const lines = waterLines([
      { id: "a", localDate: "2026-11-16", loggedAt: 10, amountMl: 250 },
      { id: "b", localDate: "2026-11-17", loggedAt: 30, amountMl: 500 },
      { id: "c", localDate: "2026-11-16", loggedAt: 20, amountMl: 330 },
    ]);
    expect(lines).toEqual([
      { id: "2026-11-17", date: "2026-11-17", totalMl: 500, entryIds: ["b"], at: 30 },
      { id: "2026-11-16", date: "2026-11-16", totalMl: 580, entryIds: ["a", "c"], at: 20 },
    ]);
  });
});

describe("measurementSittings", () => {
  it("groups readings saved together and lists them in body order", () => {
    const sittings = measurementSittings([
      { id: "h1", localDate: "2026-11-10", measuredAt: 500, site: "hip", lengthMm: 1040 },
      { id: "w1", localDate: "2026-11-10", measuredAt: 500, site: "waist", lengthMm: 925 },
      { id: "w2", localDate: "2026-11-10", measuredAt: 900, site: "waist", lengthMm: 920 },
      { id: "t1", localDate: "2026-11-03", measuredAt: 100, site: "thigh", lengthMm: 600 },
    ]);
    expect(sittings).toEqual([
      { id: "2026-11-10|900", date: "2026-11-10", at: 900, readings: [{ id: "w2", site: "waist", lengthMm: 920 }] },
      {
        id: "2026-11-10|500",
        date: "2026-11-10",
        at: 500,
        readings: [
          { id: "w1", site: "waist", lengthMm: 925 },
          { id: "h1", site: "hip", lengthMm: 1040 },
        ],
      },
      { id: "2026-11-03|100", date: "2026-11-03", at: 100, readings: [{ id: "t1", site: "thigh", lengthMm: 600 }] },
    ]);
  });
});

describe("weightOnOrBefore", () => {
  const weights = [
    { date: d("2026-11-01"), weightG: 90_000 },
    { date: d("2026-11-10"), weightG: 88_500 },
    { date: d("2026-11-05"), weightG: 89_200 },
  ];

  it("takes the latest weigh-in on or before the day, in any input order", () => {
    const on = weightOnOrBefore(weights);
    expect(on(d("2026-11-07"))).toBe(89_200);
    expect(on(d("2026-11-10"))).toBe(88_500);
    expect(on(d("2026-12-01"))).toBe(88_500);
    expect(on(d("2026-11-01"))).toBe(90_000);
    expect(on(d("2026-11-04"))).toBe(90_000);
  });

  it("knows no weight before the first weigh-in", () => {
    expect(weightOnOrBefore(weights)(d("2026-10-31"))).toBeUndefined();
    expect(weightOnOrBefore([])(d("2026-11-07"))).toBeUndefined();
  });
});
