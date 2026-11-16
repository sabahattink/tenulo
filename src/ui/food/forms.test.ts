import { describe, expect, it } from "vitest";
import {
  type CustomFoodForm,
  EMPTY_CUSTOM_FOOD_FORM,
  customFoodFormOf,
  goalsFormOf,
  parseCustomFoodForm,
  parseGoalsForm,
  parseQuickAddForm,
} from "./forms";

const soupForm: CustomFoodForm = {
  name: "  Annemin çorbası ",
  servingLabel: "1 kase",
  servingGrams: "250",
  energyKcal: "181",
  protein: "7,5",
  carb: "",
  fat: "5.2",
  fiber: "",
};

describe("parseCustomFoodForm", () => {
  it("turns the fields into integers, empty nutrients into unknown", () => {
    expect(parseCustomFoodForm(soupForm)).toEqual({
      ok: true,
      value: {
        name: "Annemin çorbası",
        servingLabel: "1 kase",
        servingGrams: 250,
        energyKcal: 181,
        proteinMg: 7_500,
        carbMg: null,
        fatMg: 5_200,
        fiberMg: null,
      },
    });
  });

  it("allows a serving without grams", () => {
    const r = parseCustomFoodForm({ ...soupForm, servingGrams: " " });
    expect(r.ok && r.value.servingGrams).toBeNull();
  });

  it("names every field that needs attention", () => {
    expect(parseCustomFoodForm(EMPTY_CUSTOM_FOOD_FORM)).toEqual({
      ok: false,
      problems: { name: "required", servingLabel: "required", energyKcal: "required" },
    });
    expect(
      parseCustomFoodForm({ ...soupForm, servingGrams: "0", energyKcal: "5001", protein: "abc", fiber: "1,25" }),
    ).toEqual({ ok: false, problems: { servingGrams: "out-of-range", energyKcal: "out-of-range", protein: "not-a-number", fiber: "not-a-number" } });
    expect(parseCustomFoodForm({ ...soupForm, energyKcal: "1.800" })).toEqual({ ok: false, problems: { energyKcal: "not-a-number" } });
  });

  it("refuses text longer than the database keeps", () => {
    expect(parseCustomFoodForm({ ...soupForm, name: "x".repeat(61), servingLabel: "y".repeat(41) })).toEqual({
      ok: false,
      problems: { name: "too-long", servingLabel: "too-long" },
    });
  });

  it("round-trips a saved food through the form in either language", () => {
    const saved = { name: "Salata", servingLabel: "tabak", servingGrams: null, energyKcal: 0, proteinMg: 12_500, carbMg: 3_000, fatMg: null, fiberMg: 0 };
    const tr = customFoodFormOf(saved, ",");
    expect(tr).toMatchObject({ servingGrams: "", energyKcal: "0", protein: "12,5", carb: "3", fat: "", fiber: "0" });
    expect(parseCustomFoodForm(tr)).toEqual({ ok: true, value: saved });
    expect(parseCustomFoodForm(customFoodFormOf(saved, "."))).toEqual({ ok: true, value: saved });
  });
});

describe("parseQuickAddForm", () => {
  it("needs only the energy", () => {
    expect(parseQuickAddForm({ name: "", energyKcal: "850", protein: "" })).toEqual({
      ok: true,
      value: { name: "", energyKcal: 850, proteinMg: null },
    });
    expect(parseQuickAddForm({ name: " Pide ", energyKcal: "0", protein: "32,5" })).toEqual({
      ok: true,
      value: { name: "Pide", energyKcal: 0, proteinMg: 32_500 },
    });
  });

  it("says what is missing or wrong", () => {
    expect(parseQuickAddForm({ name: "", energyKcal: "", protein: "x" })).toEqual({
      ok: false,
      problems: { energyKcal: "required", protein: "not-a-number" },
    });
    expect(parseQuickAddForm({ name: "", energyKcal: "10001", protein: "" })).toEqual({
      ok: false,
      problems: { energyKcal: "out-of-range" },
    });
  });
});

describe("parseGoalsForm", () => {
  it("keeps the user's own numbers and clears empty goals", () => {
    expect(parseGoalsForm({ energy: "1800", protein: "", water: " 2000 ", glass: "250" })).toEqual({
      ok: true,
      value: { energyGoalKcal: 1800, proteinGoalG: null, waterGoalMl: 2000, waterServingMl: 250 },
    });
  });

  it("checks each goal against its range and needs a glass size", () => {
    expect(parseGoalsForm({ energy: "100", protein: "401", water: "abc", glass: "" })).toEqual({
      ok: false,
      problems: { energy: "out-of-range", protein: "out-of-range", water: "not-a-number", glass: "required" },
    });
  });

  it("shows saved goals back as text", () => {
    const goals = { energyGoalKcal: null, proteinGoalG: 90, waterGoalMl: null, waterServingMl: 200 };
    expect(goalsFormOf(goals)).toEqual({ energy: "", protein: "90", water: "", glass: "200" });
    expect(parseGoalsForm(goalsFormOf(goals))).toEqual({ ok: true, value: goals });
  });
});
