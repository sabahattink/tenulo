import { type LocalDate, addDays } from "./date";
import type { ExerciseKind, Intensity } from "./exercise";
import type { Meal } from "./food-log";
import { findCatalogFood } from "./foods/catalog";
import { nutritionFor, portionGrams } from "./foods/nutrition";
import type { FoodLocale } from "./foods/types";
import { MEASUREMENT_SITES, type MeasurementSite } from "./measurement";
import type { WeightReading } from "./trend";

/** Small deterministic PRNG (mulberry32), so sample data is identical on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleOptions {
  readonly endDate: LocalDate;
  readonly days: number;
  readonly startG: number;
  /** Underlying change per day, e.g. -90 for about -0.6 kg a week. */
  readonly rateGPerDay: number;
  /** Day-to-day water-weight noise amplitude. */
  readonly noiseG: number;
  /** Probability of skipping a day, like a real person does. */
  readonly skipChance: number;
  readonly seed: number;
}

/**
 * Realistic-looking weigh-ins for development and store screenshots: a steady underlying change
 * plus water-weight noise and a few missed days. Never used in release builds.
 */
export function sampleWeights(o: SampleOptions): WeightReading[] {
  const random = mulberry32(o.seed);
  const out: WeightReading[] = [];
  for (let i = o.days - 1; i >= 0; i--) {
    const skip = random() < o.skipChance && i !== 0;
    const noise = (random() * 2 - 1) * o.noiseG;
    if (skip) continue;
    const dayIndex = o.days - 1 - i;
    out.push({
      date: addDays(o.endDate, -i),
      weightG: Math.round((o.startG + o.rateGPerDay * dayIndex + noise) / 100) * 100,
    });
  }
  return out;
}

/** The period every daily-log sample covers: `days` days ending `endDate`. */
export interface SamplePeriod {
  readonly endDate: LocalDate;
  readonly days: number;
  readonly seed: number;
}

/** A whole number from `lo` to `hi`, both included. */
const between = (random: () => number, lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new RangeError("Nothing to pick from");
  return item;
}

/** A food as the diary logs it: a bundled-list id, one of its portions and the amount in thousandths. */
interface PlateItem {
  readonly id: string;
  readonly portion: string;
  readonly milli: number;
}
const item = (id: string, portion: string, milli = 1000): PlateItem => ({ id, portion, milli });

/**
 * Everyday Turkish meals from the bundled list, in modest portions: a few weeks of a plausible diary
 * for someone whose appetite is smaller than it used to be. Generic foods only, no brands.
 */
export const SAMPLE_MEALS: Readonly<Record<Meal, readonly (readonly PlateItem[])[]>> = {
  breakfast: [
    [
      item("egg-boiled", "piece", 2000),
      item("cheese-white", "slice"),
      item("olives-black", "piece", 5000),
      item("tomato", "slice", 3000),
      item("cucumber", "slice", 4000),
      item("bread-wholewheat", "slice"),
      item("tea", "tea-glass", 2000),
    ],
    [item("menemen", "serving"), item("bread-wholewheat", "slice", 2000), item("cheese-white", "slice"), item("tea", "tea-glass")],
    [item("oats", "serving"), item("milk-semi", "glass"), item("banana", "piece", 500), item("walnuts", "piece", 3000)],
    [item("yogurt-strained-nonfat", "bowl"), item("strawberries", "bowl"), item("honey", "tsp"), item("walnuts", "piece", 3000)],
  ],
  lunch: [
    [item("soup-lentil", "bowl"), item("bread-wholewheat", "slice", 2000), item("shepherd-salad", "serving")],
    [item("chicken-breast-grilled", "serving"), item("bulgur-pilaf", "serving", 500), item("shepherd-salad", "serving"), item("ayran", "glass")],
    [item("tuna-in-water", "can"), item("shepherd-salad", "serving"), item("bread-wholewheat", "slice", 2000)],
    [item("chicken-wrap", "piece"), item("ayran", "glass")],
  ],
  dinner: [
    [item("kofte", "piece", 4000), item("bulgur-pilaf", "serving"), item("shepherd-salad", "serving"), item("yogurt-low-fat", "bowl", 500)],
    [
      item("green-beans-olive-oil", "serving"),
      item("bulgur-pilaf", "serving", 500),
      item("yogurt-whole", "bowl", 500),
      item("bread-wholewheat", "slice", 2000),
    ],
    [item("salmon", "serving"), item("rice-boiled", "serving", 500), item("shepherd-salad", "serving")],
    [item("chickpea-stew", "serving"), item("rice-pilaf", "serving", 500), item("ayran", "glass")],
    [item("chicken-saute", "serving"), item("bulgur-pilaf", "serving"), item("shepherd-salad", "serving")],
  ],
  snack: [
    [item("apple", "piece")],
    [item("almonds", "handful", 500)],
    [item("yogurt-strained-nonfat", "bowl", 500)],
    [item("mandarin", "piece", 2000)],
    [item("pear", "piece")],
  ],
};

/** When each meal is eaten (minute of the day) and how often it is logged on a past day. */
const MEAL_TIMES: Readonly<Record<Meal, { readonly from: number; readonly spread: number; readonly chance: number }>> = {
  breakfast: { from: 8 * 60, spread: 90, chance: 0.9 },
  lunch: { from: 12 * 60 + 30, spread: 90, chance: 0.9 },
  snack: { from: 16 * 60, spread: 60, chance: 0.7 },
  dinner: { from: 19 * 60, spread: 90, chance: 0.95 },
};
/** Today is still going: only its first two meals are in. */
const TODAY_MEALS: readonly Meal[] = ["breakfast", "lunch"];
const MEAL_ORDER: readonly Meal[] = ["breakfast", "lunch", "snack", "dinner"];

export interface SampleFoodEntry {
  readonly date: LocalDate;
  readonly meal: Meal;
  readonly minuteOfDay: number;
  readonly catalogFoodId: string;
  readonly name: string;
  readonly portionId: string;
  readonly portionLabel: string;
  readonly quantityMilli: number;
  readonly grams: number;
  readonly energyKcal: number;
  readonly proteinMg: number;
  readonly carbMg: number;
  readonly fatMg: number;
  readonly fiberMg: number;
}

/** A plate item as a diary entry, with nutrients computed the way the food diary computes them. */
function logged(plate: PlateItem, date: LocalDate, meal: Meal, minuteOfDay: number, lang: FoodLocale): SampleFoodEntry {
  const food = findCatalogFood(plate.id);
  const portion = food?.portions.find((p) => p.id === plate.portion);
  if (food === undefined || portion === undefined) throw new RangeError(`Not in the food list: ${plate.id} ${plate.portion}`);
  const grams = portionGrams(portion.grams, plate.milli);
  return {
    date,
    meal,
    minuteOfDay,
    catalogFoodId: food.id,
    name: food.name[lang],
    portionId: portion.id,
    portionLabel: portion.label[lang],
    quantityMilli: plate.milli,
    grams,
    ...nutritionFor(food.per100g, grams),
  };
}

/** A food diary over the period, with some meals and a few whole days not logged. */
export function sampleFoodLog(o: SamplePeriod & { readonly lang: FoodLocale }): SampleFoodEntry[] {
  const random = mulberry32(o.seed);
  const out: SampleFoodEntry[] = [];
  for (let i = o.days - 1; i >= 0; i--) {
    const date = addDays(o.endDate, -i);
    const skipDay = random() < 0.1 && i !== 0;
    for (const meal of MEAL_ORDER) {
      const time = MEAL_TIMES[meal];
      const eaten = i === 0 ? TODAY_MEALS.includes(meal) : random() < time.chance;
      const plate = pick(random, SAMPLE_MEALS[meal]);
      const minute = time.from + between(random, 0, time.spread);
      if (skipDay || !eaten) continue;
      plate.forEach((p, n) => out.push(logged(p, date, meal, minute + n, o.lang)));
    }
  }
  return out;
}

export interface SampleWaterEntry {
  readonly date: LocalDate;
  readonly minuteOfDay: number;
  readonly amountMl: number;
}

const GLASS_ML = 250;
const BOTTLE_ML = 500;
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;

/** Glasses (and now and then a bottle) through the day; today has its first few. */
export function sampleWater(o: SamplePeriod): SampleWaterEntry[] {
  const random = mulberry32(o.seed);
  const out: SampleWaterEntry[] = [];
  for (let i = o.days - 1; i >= 0; i--) {
    const date = addDays(o.endDate, -i);
    const skip = random() < 0.15 && i !== 0;
    const count = i === 0 ? 3 : between(random, 4, 8);
    if (skip) continue;
    for (let n = 0; n < count; n++) {
      const minute = DAY_START + Math.round(((n + random()) / count) * (DAY_END - DAY_START));
      out.push({ date, minuteOfDay: minute, amountMl: random() < 1 / 6 ? BOTTLE_ML : GLASS_ML });
    }
  }
  return out;
}

export interface SampleMeasurement {
  readonly date: LocalDate;
  readonly minuteOfDay: number;
  readonly site: MeasurementSite;
  readonly lengthMm: number;
}

/** Where each site starts and how much it changes a week, in millimetres. */
const SITE_START: Readonly<Record<MeasurementSite, { readonly mm: number; readonly perWeek: number; readonly everySitting: boolean }>> = {
  waist: { mm: 1060, perWeek: -7, everySitting: true },
  hip: { mm: 1150, perWeek: -5, everySitting: true },
  chest: { mm: 1080, perWeek: -5, everySitting: false },
  neck: { mm: 405, perWeek: -1.5, everySitting: false },
  arm: { mm: 345, perWeek: -2, everySitting: false },
  thigh: { mm: 640, perWeek: -4, everySitting: false },
};
const SITTING_MINUTE = 7 * 60 + 45;
/** A tape is read to half a centimetre. */
const TAPE_STEP_MM = 5;

/**
 * A tape-measure sitting once a week from the first day of the period: waist and hip every time,
 * the other sites every second week.
 */
export function sampleMeasurements(o: SamplePeriod): SampleMeasurement[] {
  const random = mulberry32(o.seed);
  const start = addDays(o.endDate, -(o.days - 1));
  const out: SampleMeasurement[] = [];
  for (let week = 0; week * 7 < o.days; week++) {
    const date = addDays(start, week * 7);
    for (const site of MEASUREMENT_SITES) {
      const s = SITE_START[site];
      const noise = (random() * 2 - 1) * 4;
      if (!s.everySitting && week % 2 === 1) continue;
      const mm = Math.round((s.mm + s.perWeek * week + noise) / TAPE_STEP_MM) * TAPE_STEP_MM;
      out.push({ date, minuteOfDay: SITTING_MINUTE, site, lengthMm: mm });
    }
  }
  return out;
}

export interface SampleExercise {
  readonly date: LocalDate;
  readonly minuteOfDay: number;
  readonly kind: ExerciseKind;
  readonly durationMin: number;
  readonly intensity: Intensity;
}

/** Walks on most days, strength training once a week from the third week, and some yoga. */
export function sampleExercise(o: SamplePeriod): SampleExercise[] {
  const random = mulberry32(o.seed);
  const out: SampleExercise[] = [];
  for (let i = o.days - 1; i >= 0; i--) {
    const date = addDays(o.endDate, -i);
    const day = o.days - 1 - i;
    const roll = random();
    if (day % 7 === 3 && day >= 14) {
      out.push({ date, minuteOfDay: 19 * 60, kind: "strength", durationMin: between(random, 30, 40), intensity: "moderate" });
    } else if (day % 7 === 5) {
      out.push({ date, minuteOfDay: 7 * 60 + 15, kind: "yoga", durationMin: between(random, 20, 30), intensity: "light" });
    }
    if (roll < 0.55 && i !== 0) {
      const brisk = random() < 0.7;
      out.push({
        date,
        minuteOfDay: 18 * 60 + between(random, 0, 45),
        kind: "walking",
        durationMin: 5 * between(random, 5, 10),
        intensity: brisk ? "moderate" : "light",
      });
    }
  }
  return out;
}
