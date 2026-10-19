import { type LocalDate, addDays } from "./date";
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
