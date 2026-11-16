/**
 * The text fields of the food screens, parsed into the integers the database stores. Pure, so the
 * rules are tested without a phone; the screens only map a problem to a message.
 */
import { MAX_ENTRY_KCAL, MAX_SERVING_KCAL, formatQuantity, parseGramsToMg } from "../../domain/food-log";
import {
  ENERGY_GOAL_KCAL,
  PROTEIN_GOAL_G,
  type Range,
  WATER_GOAL_ML,
  WATER_SERVING_ML,
  parseWholeNumber,
} from "../../domain/goals";

export type FieldProblem = "required" | "too-long" | "not-a-number" | "out-of-range";
export type Problems<F extends string> = Partial<Record<F, FieldProblem>>;
export type FormResult<F extends string, V> =
  | { readonly ok: true; readonly value: V }
  | { readonly ok: false; readonly problems: Problems<F> };

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: FieldProblem };

/** Limits of the stored text (schema checks on custom_food and food_entry). */
export const MAX_FOOD_NAME = 60;
export const MAX_SERVING_LABEL = 40;
export const MAX_ENTRY_NAME = 80;
export const SERVING_GRAMS = { min: 1, max: 5000 } as const satisfies Range;
export const SERVING_KCAL = { min: 0, max: MAX_SERVING_KCAL } as const satisfies Range;
export const ENTRY_KCAL = { min: 0, max: MAX_ENTRY_KCAL } as const satisfies Range;

function text(input: string, max: number, required: boolean): Parsed<string> {
  const value = input.trim();
  if (value === "" && required) return { ok: false, problem: "required" };
  if (value.length > max) return { ok: false, problem: "too-long" };
  return { ok: true, value };
}

function whole(input: string, range: Range, required: boolean): Parsed<number | null> {
  if (input.trim() === "" && !required) return { ok: true, value: null };
  const r = parseWholeNumber(input, range);
  if (r.ok) return { ok: true, value: r.value };
  return { ok: false, problem: r.reason === "empty" ? "required" : r.reason };
}

function grams(input: string): Parsed<number | null> {
  const r = parseGramsToMg(input);
  return r.ok ? { ok: true, value: r.mg } : { ok: false, problem: r.reason };
}

/** Every field's problem, keyed by field; empty when all parsed. */
function problemsOf<F extends string>(fields: Readonly<Record<F, Parsed<unknown>>>): Problems<F> {
  const problems: Problems<F> = {};
  for (const key of Object.keys(fields) as F[]) {
    const r = fields[key];
    if (!r.ok) problems[key] = r.problem;
  }
  return problems;
}

export interface CustomFoodForm {
  readonly name: string;
  readonly servingLabel: string;
  readonly servingGrams: string;
  readonly energyKcal: string;
  readonly protein: string;
  readonly carb: string;
  readonly fat: string;
  readonly fiber: string;
}
export type CustomFoodField = keyof CustomFoodForm;

/** What `createCustomFood` / `updateCustomFood` take. */
export interface CustomFoodFields {
  readonly name: string;
  readonly servingLabel: string;
  readonly servingGrams: number | null;
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly carbMg: number | null;
  readonly fatMg: number | null;
  readonly fiberMg: number | null;
}

export const EMPTY_CUSTOM_FOOD_FORM: CustomFoodForm = {
  name: "",
  servingLabel: "",
  servingGrams: "",
  energyKcal: "",
  protein: "",
  carb: "",
  fat: "",
  fiber: "",
};

const mgText = (mg: number | null, mark: "." | ",") => (mg === null ? "" : formatQuantity(mg, mark));

/** The form showing a saved food, numbers with the language's decimal mark. */
export function customFoodFormOf(food: CustomFoodFields, decimalMark: "." | ","): CustomFoodForm {
  return {
    name: food.name,
    servingLabel: food.servingLabel,
    servingGrams: food.servingGrams === null ? "" : String(food.servingGrams),
    energyKcal: String(food.energyKcal),
    protein: mgText(food.proteinMg, decimalMark),
    carb: mgText(food.carbMg, decimalMark),
    fat: mgText(food.fatMg, decimalMark),
    fiber: mgText(food.fiberMg, decimalMark),
  };
}

/** Name, serving and energy are required; serving grams and the four nutrients may stay empty. */
export function parseCustomFoodForm(form: CustomFoodForm): FormResult<CustomFoodField, CustomFoodFields> {
  const name = text(form.name, MAX_FOOD_NAME, true);
  const servingLabel = text(form.servingLabel, MAX_SERVING_LABEL, true);
  const servingGrams = whole(form.servingGrams, SERVING_GRAMS, false);
  const energyKcal = whole(form.energyKcal, SERVING_KCAL, true);
  const protein = grams(form.protein);
  const carb = grams(form.carb);
  const fat = grams(form.fat);
  const fiber = grams(form.fiber);
  if (
    !name.ok ||
    !servingLabel.ok ||
    !servingGrams.ok ||
    !energyKcal.ok ||
    energyKcal.value === null ||
    !protein.ok ||
    !carb.ok ||
    !fat.ok ||
    !fiber.ok
  ) {
    return {
      ok: false,
      problems: problemsOf<CustomFoodField>({ name, servingLabel, servingGrams, energyKcal, protein, carb, fat, fiber }),
    };
  }
  return {
    ok: true,
    value: {
      name: name.value,
      servingLabel: servingLabel.value,
      servingGrams: servingGrams.value,
      energyKcal: energyKcal.value,
      proteinMg: protein.value,
      carbMg: carb.value,
      fatMg: fat.value,
      fiberMg: fiber.value,
    },
  };
}

export interface QuickAddForm {
  readonly name: string;
  readonly energyKcal: string;
  readonly protein: string;
}
export type QuickAddField = keyof QuickAddForm;

export interface QuickAddFields {
  /** Empty when the user gave none; the screen then uses "Quick add". */
  readonly name: string;
  readonly energyKcal: number;
  readonly proteinMg: number | null;
}

/** Energy is required; the name and protein are optional. */
export function parseQuickAddForm(form: QuickAddForm): FormResult<QuickAddField, QuickAddFields> {
  const name = text(form.name, MAX_ENTRY_NAME, false);
  const energyKcal = whole(form.energyKcal, ENTRY_KCAL, true);
  const protein = grams(form.protein);
  if (!name.ok || !energyKcal.ok || energyKcal.value === null || !protein.ok) {
    return { ok: false, problems: problemsOf<QuickAddField>({ name, energyKcal, protein }) };
  }
  return { ok: true, value: { name: name.value, energyKcal: energyKcal.value, proteinMg: protein.value } };
}

export interface GoalsForm {
  readonly energy: string;
  readonly protein: string;
  readonly water: string;
  readonly glass: string;
}
export type GoalsField = keyof GoalsForm;

export interface GoalsFields {
  readonly energyGoalKcal: number | null;
  readonly proteinGoalG: number | null;
  readonly waterGoalMl: number | null;
  readonly waterServingMl: number;
}

/** The range each goal field accepts; the screen shows it in its message. */
export const GOAL_RANGES: Readonly<Record<GoalsField, Range>> = {
  energy: ENERGY_GOAL_KCAL,
  protein: PROTEIN_GOAL_G,
  water: WATER_GOAL_ML,
  glass: WATER_SERVING_ML,
};

export function goalsFormOf(goals: GoalsFields): GoalsForm {
  const show = (n: number | null) => (n === null ? "" : String(n));
  return {
    energy: show(goals.energyGoalKcal),
    protein: show(goals.proteinGoalG),
    water: show(goals.waterGoalMl),
    glass: String(goals.waterServingMl),
  };
}

/** Each goal may be left empty, which clears it; the glass size is always needed. */
export function parseGoalsForm(form: GoalsForm): FormResult<GoalsField, GoalsFields> {
  const energy = whole(form.energy, GOAL_RANGES.energy, false);
  const protein = whole(form.protein, GOAL_RANGES.protein, false);
  const water = whole(form.water, GOAL_RANGES.water, false);
  const glass = whole(form.glass, GOAL_RANGES.glass, true);
  if (!energy.ok || !protein.ok || !water.ok || !glass.ok || glass.value === null) {
    return { ok: false, problems: problemsOf<GoalsField>({ energy, protein, water, glass }) };
  }
  return {
    ok: true,
    value: { energyGoalKcal: energy.value, proteinGoalG: protein.value, waterGoalMl: water.value, waterServingMl: glass.value },
  };
}
