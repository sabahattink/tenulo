import { describe, expect, it } from "vitest";
import { i18nFor } from "../../i18n";
import { exerciseDayText, exerciseEnergyText, exerciseRowTexts, litresText, mlText, ringTexts } from "./texts";

const en = i18nFor("en");
const tr = i18nFor("tr");

describe("ringTexts", () => {
  it("shows the value and the user's own goal, with the language's number marks", () => {
    const ring = { value: 1240, goal: 1800, fraction: 1240 / 1800 };
    expect(ringTexts(en, "energy", ring)).toEqual({
      label: "Energy",
      value: "1,240",
      unit: "kcal",
      goal: "of 1,800",
      a11y: "Energy: 1,240 kcal of your 1,800 kcal goal",
    });
    expect(ringTexts(tr, "energy", ring)).toEqual({
      label: "Enerji",
      value: "1.240",
      unit: "kcal",
      goal: "Hedef: 1.800",
      a11y: "Enerji: 1.240 kcal, hedefin 1.800 kcal",
    });
  });

  it("shows water in litres with the language's decimal mark", () => {
    const ring = { value: 1750, goal: 2000, fraction: 0.875 };
    expect(ringTexts(tr, "water", ring)).toMatchObject({ label: "Su", value: "1,75", unit: "L", goal: "Hedef: 2" });
    expect(ringTexts(en, "water", ring)).toMatchObject({ value: "1.75", goal: "of 2" });
  });

  it("shows just the value when there is no goal", () => {
    const ring = { value: 62, goal: null, fraction: undefined };
    expect(ringTexts(en, "protein", ring)).toEqual({ label: "Protein", value: "62", unit: "g", goal: undefined, a11y: "Protein: 62 g" });
  });
});

describe("amounts", () => {
  it("writes millilitres and litres", () => {
    expect(mlText(en, 250)).toBe("250 ml");
    expect(mlText(tr, 1250)).toBe("1.250 ml");
    expect(litresText(tr, 1750)).toBe("1,75 L");
    expect(litresText(en, 2000)).toBe("2 L");
  });
});

describe("exercise texts", () => {
  const walk = { kind: "walking", intensity: "moderate", durationMin: 30, energyKcal: null } as const;

  it("marks an estimate as one, in both languages", () => {
    expect(exerciseEnergyText(en, { kcal: 1245, estimated: true })).toBe("≈ 1,245 kcal (estimate)");
    expect(exerciseEnergyText(tr, { kcal: 1245, estimated: true })).toBe("≈ 1.245 kcal (tahmini)");
    expect(exerciseEnergyText(en, { kcal: 300, estimated: false })).toBe("300 kcal");
  });

  it("describes one entry", () => {
    expect(exerciseRowTexts(en, walk, { kcal: 175, estimated: true })).toEqual({
      title: "Walking · 30 min",
      detail: "Moderate · ≈ 175 kcal (estimate)",
    });
    expect(exerciseRowTexts(tr, { ...walk, kind: "strength", intensity: "vigorous" }, { kcal: 200, estimated: false })).toEqual({
      title: "Kuvvet antrenmanı · 30 dk",
      detail: "Yoğun · 200 kcal",
    });
    expect(exerciseRowTexts(en, walk, undefined)).toEqual({ title: "Walking · 30 min", detail: "Moderate" });
  });

  it("sums up the day", () => {
    expect(exerciseDayText(en, { minutes: 45, kcal: 310, estimated: false, complete: true })).toBe("45 min · 310 kcal");
    expect(exerciseDayText(tr, { minutes: 45, kcal: 310, estimated: true, complete: true })).toBe("45 dk · ≈ 310 kcal");
    expect(exerciseDayText(en, { minutes: 45, kcal: 120, estimated: false, complete: false })).toBe("45 min");
    expect(exerciseDayText(en, { minutes: 0, kcal: 0, estimated: false, complete: true })).toBeUndefined();
  });
});
