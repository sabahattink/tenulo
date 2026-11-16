import { describe, expect, it } from "vitest";
import { EXERCISE_KINDS, INTENSITIES, MET, estimateExerciseKcal, isDuration } from "./exercise";

describe("estimateExerciseKcal", () => {
  it("is MET x body weight (kg) x hours, rounded", () => {
    // Running, moderate: 8.3 MET x 80 kg x 0.5 h = 332 kcal.
    expect(estimateExerciseKcal("running", "moderate", 30, 80_000)).toBe(332);
    // Walking, moderate: 3.5 MET x 70 kg x 1 h = 245 kcal.
    expect(estimateExerciseKcal("walking", "moderate", 60, 70_000)).toBe(245);
  });

  it("is undefined without a body weight", () => {
    expect(estimateExerciseKcal("running", "moderate", 30, undefined)).toBeUndefined();
  });

  it("has a MET value for every kind and intensity, rising with intensity", () => {
    for (const kind of EXERCISE_KINDS) {
      const values = INTENSITIES.map((i) => MET[kind][i]);
      for (const v of values) expect(v).toBeGreaterThan(1);
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });
});

describe("isDuration", () => {
  it("accepts whole minutes within a day", () => {
    expect(isDuration(1)).toBe(true);
    expect(isDuration(1440)).toBe(true);
    expect(isDuration(0)).toBe(false);
    expect(isDuration(1441)).toBe(false);
    expect(isDuration(12.5)).toBe(false);
  });
});
