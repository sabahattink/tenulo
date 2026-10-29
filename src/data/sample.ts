import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { injections, medications, planSteps, settings, sideEffects, weightEntries } from "@/db/schema";
import { type LocalDate, addDays } from "@/domain/date";
import { ulid } from "@/domain/id";
import { INJECTION_SITES } from "@/domain/injection";
import { sampleWeights } from "@/domain/sample";
import type { SideEffectType } from "@/domain/side-effect";

const DAYS = 63;

/**
 * Development builds only: fills an empty log with realistic, deterministic sample data for trying
 * the app and taking store screenshots. Never reachable in a release build (the caller checks
 * __DEV__), and the medication name is generic: no brand names, even in sample data. One
 * synchronous transaction: see src/db/ops.ts for why.
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
  const medicationId = ulid(now - 1_000);
  const shots = Array.from({ length: Math.floor((DAYS - 1) / 7) + 1 }, (_, i) => addDays(start, i * 7));
  const effects: { day: number; type: SideEffectType; severity: number; note: string | null }[] = [
    { day: 1, type: "nausea", severity: 2, note: "after dinner" },
    { day: 2, type: "nausea", severity: 1, note: null },
    { day: 9, type: "fatigue", severity: 1, note: null },
    { day: 29, type: "nausea", severity: 2, note: "first week on the new dose" },
    { day: 30, type: "headache", severity: 1, note: null },
    { day: 44, type: "constipation", severity: 1, note: null },
  ];

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
    tx.insert(medications).values({ id: medicationId, name: "My weekly pen", active: true, createdAt: now, updatedAt: now }).run();
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
    tx.update(settings).set({ goalWeightG: 85_000, updatedAt: now }).where(eq(settings.id, 1)).run();
  });
}
