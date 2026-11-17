import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  exerciseEntries,
  foodEntries,
  injections,
  measurementEntries,
  medications,
  planSteps,
  settings,
  sideEffects,
  waterEntries,
  weightEntries,
} from "@/db/schema";
import { type LocalDate, addDays } from "@/domain/date";
import { ulid } from "@/domain/id";
import { INJECTION_SITES } from "@/domain/injection";
import { type Language, resolveLanguage } from "@/domain/language";
import { sampleExercise, sampleFoodLog, sampleMeasurements, sampleWater, sampleWeights } from "@/domain/sample";
import type { SideEffectType } from "@/domain/side-effect";
import { deviceLocale } from "@/i18n/device";

const DAYS = 63;
/** The daily log is newer than the weight log: a few weeks of food and water, six of exercise. */
const FOOD_DAYS = 28;
const EXERCISE_DAYS = 42;

/**
 * What a person would have typed themselves, in the app's language: the medication is named the
 * way a user would name it (generic, no brand) and notes read as their own words.
 */
const SAMPLE_TEXT = {
  en: { medication: "My weekly pen", afterDinner: "after dinner", newDose: "first week on the new dose" },
  tr: { medication: "Haftalık kalemim", afterDinner: "akşam yemeğinden sonra", newDose: "yeni dozun ilk haftası" },
} as const satisfies Record<Language, { medication: string; afterDinner: string; newDose: string }>;

/** The instant of a minute of a local calendar day, in the phone's time zone. */
function instantOf(date: LocalDate, minuteOfDay: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, minuteOfDay).getTime();
}

/**
 * Development builds only: fills an empty log with realistic, deterministic sample data for trying
 * the app and taking store screenshots. Never reachable in a release build (the caller checks
 * __DEV__), and the medication name is generic: no brand names, even in sample data. Foods are
 * named in the app's current language, as a person logging them would see them, and so are the
 * medication name and notes. One synchronous transaction: see src/db/ops.ts for why.
 */
export function seedSampleData(today: LocalDate): void {
  if (!__DEV__) throw new Error("Sample data is for development builds only");
  const now = Date.now();
  const start = addDays(today, -(DAYS - 1));
  const weights = sampleWeights({
    endDate: today,
    days: DAYS,
    startG: 96_400,
    rateGPerDay: -85,
    noiseG: 650,
    skipChance: 0.12,
    seed: 7,
  });
  const [current] = db.select({ language: settings.language }).from(settings).where(eq(settings.id, 1)).all();
  const lang = resolveLanguage(current?.language ?? "system", deviceLocale());
  const text = SAMPLE_TEXT[lang];
  const medicationId = ulid(now - 1_000);
  const shots = Array.from({ length: Math.floor((DAYS - 1) / 7) + 1 }, (_, i) => addDays(start, i * 7));
  const effects: { day: number; type: SideEffectType; severity: number; note: string | null }[] = [
    { day: 1, type: "nausea", severity: 2, note: text.afterDinner },
    { day: 2, type: "nausea", severity: 1, note: null },
    { day: 9, type: "fatigue", severity: 1, note: null },
    { day: 29, type: "nausea", severity: 2, note: text.newDose },
    { day: 30, type: "headache", severity: 1, note: null },
    { day: 44, type: "constipation", severity: 1, note: null },
  ];

  const food = sampleFoodLog({ endDate: today, days: FOOD_DAYS, seed: 11, lang });
  const water = sampleWater({ endDate: today, days: FOOD_DAYS, seed: 12 });
  // Measured on injection days, from the first one: the same weeks as the weigh-ins.
  const measurements = sampleMeasurements({ endDate: today, days: DAYS, seed: 5 });
  const exercise = sampleExercise({ endDate: today, days: EXERCISE_DAYS, seed: 3 });

  db.transaction((tx) => {
    tx.insert(weightEntries).values(
      weights.map((w, i) => ({
        id: ulid(now - 100_000 + i),
        measuredAt: now,
        localDate: w.date,
        weightG: w.weightG,
        source: "manual" as const,
        healthConnectId: null,
        note: null,
        createdAt: now,
        updatedAt: now,
      })),
    ).run();
    tx.insert(medications).values({ id: medicationId, name: text.medication, active: true, createdAt: now, updatedAt: now }).run();
    tx.insert(planSteps).values([
      { id: ulid(now - 900), medicationId, startDate: start, doseMcg: 2_500, intervalDays: 7, createdAt: now, updatedAt: now },
      {
        id: ulid(now - 800),
        medicationId,
        startDate: addDays(start, 28),
        doseMcg: 5_000,
        intervalDays: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]).run();
    tx.insert(injections).values(
      shots.map((date, i) => ({
        id: ulid(now - 50_000 + i),
        medicationId,
        takenAt: now,
        localDate: date,
        doseMcg: i < 4 ? 2_500 : 5_000,
        site: i === 2 ? null : (INJECTION_SITES[i % INJECTION_SITES.length] ?? null),
        note: null,
        createdAt: now,
        updatedAt: now,
      })),
    ).run();
    tx.insert(sideEffects).values(
      effects.map((e, i) => ({
        id: ulid(now - 20_000 + i),
        localDate: addDays(start, e.day),
        type: e.type,
        severity: e.severity,
        injectionId: null,
        note: e.note,
        createdAt: now,
        updatedAt: now,
      })),
    ).run();
    tx.insert(foodEntries).values(
      food.map((f) => {
        const at = instantOf(f.date, f.minuteOfDay);
        return {
          id: ulid(at),
          localDate: f.date,
          loggedAt: at,
          meal: f.meal,
          catalogFoodId: f.catalogFoodId,
          customFoodId: null,
          name: f.name,
          portionId: f.portionId,
          portionLabel: f.portionLabel,
          quantityMilli: f.quantityMilli,
          grams: f.grams,
          energyKcal: f.energyKcal,
          proteinMg: f.proteinMg,
          carbMg: f.carbMg,
          fatMg: f.fatMg,
          fiberMg: f.fiberMg,
          createdAt: at,
          updatedAt: at,
        };
      }),
    ).run();
    tx.insert(waterEntries).values(
      water.map((w) => {
        const at = instantOf(w.date, w.minuteOfDay);
        return { id: ulid(at), localDate: w.date, loggedAt: at, amountMl: w.amountMl, createdAt: at, updatedAt: at };
      }),
    ).run();
    tx.insert(measurementEntries).values(
      measurements.map((m) => {
        const at = instantOf(m.date, m.minuteOfDay);
        return { id: ulid(at), localDate: m.date, measuredAt: at, site: m.site, lengthMm: m.lengthMm, note: null, createdAt: at, updatedAt: at };
      }),
    ).run();
    tx.insert(exerciseEntries).values(
      exercise.map((x) => {
        const at = instantOf(x.date, x.minuteOfDay);
        return {
          id: ulid(at),
          localDate: x.date,
          loggedAt: at,
          kind: x.kind,
          durationMin: x.durationMin,
          intensity: x.intensity,
          energyKcal: null,
          note: null,
          createdAt: at,
          updatedAt: at,
        };
      }),
    ).run();
    // Goals the made-up person set for themselves, so the screenshots show filled rings.
    tx.update(settings)
      .set({ goalWeightG: 85_000, energyGoalKcal: 1_600, proteinGoalG: 90, waterGoalMl: 2_000, updatedAt: now })
      .where(eq(settings.id, 1))
      .run();
  });
}
