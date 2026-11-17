import { describe, expect, it } from "vitest";
import { ENERGY_GOAL_KCAL, WATER_SERVING_ML, goalFraction, parseWholeNumber } from "./goals";

describe("parseWholeNumber", () => {
  it("accepts whole numbers inside the range", () => {
    expect(parseWholeNumber(" 1800 ", ENERGY_GOAL_KCAL)).toEqual({ ok: true, value: 1800 });
    expect(parseWholeNumber("500", ENERGY_GOAL_KCAL)).toEqual({ ok: true, value: 500 });
    expect(parseWholeNumber("6000", ENERGY_GOAL_KCAL)).toEqual({ ok: true, value: 6000 });
  });

  it("explains why input is rejected", () => {
    expect(parseWholeNumber("", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "empty" });
    expect(parseWholeNumber("18,5", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWholeNumber("1.800", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWholeNumber("-5", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWholeNumber("499", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseWholeNumber("6001", ENERGY_GOAL_KCAL)).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("keeps the default glass size inside its own range", () => {
    expect(WATER_SERVING_ML.default).toBeGreaterThanOrEqual(WATER_SERVING_ML.min);
    expect(WATER_SERVING_ML.default).toBeLessThanOrEqual(WATER_SERVING_ML.max);
  });
});

describe("goalFraction", () => {
  it("is the share of the goal reached, capped at 1", () => {
    expect(goalFraction(900, 1800)).toBe(0.5);
    expect(goalFraction(0, 1800)).toBe(0);
    expect(goalFraction(2500, 1800)).toBe(1);
  });

  it("is undefined without a goal", () => {
    expect(goalFraction(900, null)).toBeUndefined();
    expect(goalFraction(900, 0)).toBeUndefined();
  });
});
