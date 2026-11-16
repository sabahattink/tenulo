import { describe, expect, it } from "vitest";
import { type DayGoals, dayRings, exerciseDay, exerciseEnergy, isFirstRun } from "./day-summary";

const food = (energyKcal: number, proteinMg: number | null) => ({
  energyKcal,
  proteinMg,
  carbMg: null,
  fatMg: null,
  fiberMg: null,
});

const NO_GOALS: DayGoals = { energyKcal: null, proteinG: null, waterMl: null };

describe("dayRings", () => {
  it("adds up the day against the user's own goals", () => {
    const rings = dayRings(
      [food(400, 20_000), food(840, 42_400)],
      [{ amountMl: 250 }, { amountMl: 500 }],
      { energyKcal: 1800, proteinG: 90, waterMl: 2000 },
    );
    expect(rings.energy).toEqual({ value: 1240, goal: 1800, fraction: 1240 / 1800 });
    expect(rings.protein.value).toBe(62);
    expect(rings.protein.goal).toBe(90);
    // The fraction uses the exact milligrams, not the rounded grams shown.
    expect(rings.protein.fraction).toBeCloseTo(62.4 / 90, 10);
    expect(rings.water).toEqual({ value: 750, goal: 2000, fraction: 0.375 });
  });

  it("shows just the value when there is no goal", () => {
    const rings = dayRings([food(300, null)], [{ amountMl: 330 }], NO_GOALS);
    expect(rings.energy).toEqual({ value: 300, goal: null, fraction: undefined });
    expect(rings.protein).toEqual({ value: 0, goal: null, fraction: undefined });
    expect(rings.water).toEqual({ value: 330, goal: null, fraction: undefined });
  });

  it("is zero on an empty day, and caps the ring at a full circle", () => {
    const empty = dayRings([], [], { energyKcal: 1800, proteinG: 90, waterMl: 2000 });
    expect(empty.energy.fraction).toBe(0);
    expect(empty.water.value).toBe(0);
    const over = dayRings([food(2500, 120_000)], [{ amountMl: 3000 }], { energyKcal: 1800, proteinG: 90, waterMl: 2000 });
    expect(over.energy.fraction).toBe(1);
    expect(over.protein.fraction).toBe(1);
    expect(over.water.fraction).toBe(1);
    // The value itself is never capped: it is what the user logged.
    expect(over.energy.value).toBe(2500);
  });

  it("rounds protein to whole grams for display", () => {
    expect(dayRings([food(0, 499)], [], NO_GOALS).protein.value).toBe(0);
    expect(dayRings([food(0, 500)], [], NO_GOALS).protein.value).toBe(1);
  });
});

describe("exerciseEnergy", () => {
  const walk = { kind: "walking", intensity: "moderate", durationMin: 60 } as const;

  it("uses the user's own number when they entered one", () => {
    expect(exerciseEnergy({ ...walk, energyKcal: 300 }, 70_000)).toEqual({ kcal: 300, estimated: false });
    expect(exerciseEnergy({ ...walk, energyKcal: 0 }, undefined)).toEqual({ kcal: 0, estimated: false });
  });

  it("estimates from the latest weight otherwise, marked as an estimate", () => {
    // Walking, moderate: 3.5 MET x 70 kg x 1 h = 245 kcal.
    expect(exerciseEnergy({ ...walk, energyKcal: null }, 70_000)).toEqual({ kcal: 245, estimated: true });
  });

  it("has nothing to show without a weight or a number", () => {
    expect(exerciseEnergy({ ...walk, energyKcal: null }, undefined)).toBeUndefined();
  });
});

describe("exerciseDay", () => {
  it("adds minutes and energy, and says when part of it is an estimate", () => {
    const day = exerciseDay(
      [
        { kind: "walking", intensity: "moderate", durationMin: 60, energyKcal: null },
        { kind: "strength", intensity: "light", durationMin: 20, energyKcal: 90 },
      ],
      70_000,
    );
    expect(day).toEqual({ minutes: 80, kcal: 245 + 90, estimated: true, complete: true });
  });

  it("is not an estimate when every entry has the user's own number", () => {
    const day = exerciseDay([{ kind: "running", intensity: "vigorous", durationMin: 30, energyKcal: 400 }], undefined);
    expect(day).toEqual({ minutes: 30, kcal: 400, estimated: false, complete: true });
  });

  it("marks the energy incomplete when an entry has neither a number nor a weight to estimate from", () => {
    const day = exerciseDay(
      [
        { kind: "yoga", intensity: "light", durationMin: 30, energyKcal: null },
        { kind: "cycling", intensity: "moderate", durationMin: 30, energyKcal: 200 },
      ],
      undefined,
    );
    expect(day).toEqual({ minutes: 60, kcal: 200, estimated: false, complete: false });
  });

  it("is empty for a day without exercise", () => {
    expect(exerciseDay([], 70_000)).toEqual({ minutes: 0, kcal: 0, estimated: false, complete: true });
  });
});

describe("isFirstRun", () => {
  it("is true only when nothing at all has been logged", () => {
    const none = { weighIns: 0, foodToday: 0, waterToday: 0, exerciseToday: 0 };
    expect(isFirstRun(none)).toBe(true);
    expect(isFirstRun({ ...none, weighIns: 1 })).toBe(false);
    expect(isFirstRun({ ...none, foodToday: 1 })).toBe(false);
    expect(isFirstRun({ ...none, waterToday: 2 })).toBe(false);
    expect(isFirstRun({ ...none, exerciseToday: 1 })).toBe(false);
  });
});
