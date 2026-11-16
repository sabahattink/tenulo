/**
 * The words and numbers Today, water and exercise show, built from the pure day model
 * (src/domain/day-summary.ts) and the active language. No React Native, so it is unit-tested.
 */
import type { DayRings, ExerciseDay, ExerciseEnergy, ExerciseLike, Ring } from "../../domain/day-summary";
import type { I18n } from "../../i18n";
import { formatLitres } from "./amounts";

/** The same in Turkish and English, so they live here rather than in the dictionaries. */
export const UNITS = { kcal: "kcal", g: "g", ml: "ml", litre: "L" } as const;

export type RingKind = keyof DayRings;

export interface RingTexts {
  /** "Energy" / "Enerji". */
  readonly label: string;
  /** Inside the ring: "1,240" / "1.240", "1,75". */
  readonly value: string;
  readonly unit: string;
  /** Under the ring when there is a goal: "of 1,800" / "Hedef: 1.800". */
  readonly goal: string | undefined;
  /** For screen readers, with units: "Energy: 1,240 kcal of your 1,800 kcal goal". */
  readonly a11y: string;
}

const RING_UNITS: Readonly<Record<RingKind, string>> = { energy: UNITS.kcal, protein: UNITS.g, water: UNITS.litre };

export function ringTexts({ t, f }: I18n, kind: RingKind, ring: Ring): RingTexts {
  const number = (n: number) => (kind === "water" ? formatLitres(n, t.number.decimalMark) : f.integer(n));
  const unit = RING_UNITS[kind];
  const label = t.daily[kind];
  const value = number(ring.value);
  if (ring.goal === null) return { label, value, unit, goal: undefined, a11y: `${label}: ${value} ${unit}` };
  const goal = number(ring.goal);
  return {
    label,
    value,
    unit,
    goal: t.daily.ofGoal(goal),
    a11y: t.daily.ringGoalLabel(label, `${value} ${unit}`, `${goal} ${unit}`),
  };
}

/** "250 ml" / "1.250 ml". */
export function mlText({ f }: I18n, ml: number): string {
  return `${f.integer(ml)} ${UNITS.ml}`;
}

/** "1.75 L" / "1,75 L". */
export function litresText({ t }: I18n, ml: number): string {
  return `${formatLitres(ml, t.number.decimalMark)} ${UNITS.litre}`;
}

/** "310 kcal", or "≈ 310 kcal (estimate)" when Tenulo estimated it. */
export function exerciseEnergyText({ t, f }: I18n, energy: ExerciseEnergy): string {
  const kcal = `${f.integer(energy.kcal)} ${UNITS.kcal}`;
  return energy.estimated ? t.daily.estimate(kcal) : kcal;
}

/**
 * The day's exercise in one line: "45 min · 310 kcal", "45 min · ≈ 310 kcal" when part of it is an
 * estimate, just "45 min" when some entry has no energy at all. Undefined for a day without any.
 */
export function exerciseDayText({ t, f }: I18n, day: ExerciseDay): string | undefined {
  if (day.minutes === 0) return undefined;
  const minutes = t.daily.minutes(f.integer(day.minutes));
  if (!day.complete) return minutes;
  const kcal = `${f.integer(day.kcal)} ${UNITS.kcal}`;
  return `${minutes} · ${day.estimated ? `≈ ${kcal}` : kcal}`;
}

export interface ExerciseRowTexts {
  /** "Walking · 30 min". */
  readonly title: string;
  /** "Moderate · ≈ 175 kcal (estimate)", or just the intensity without any energy. */
  readonly detail: string;
}

export function exerciseRowTexts(i18n: I18n, e: ExerciseLike, energy: ExerciseEnergy | undefined): ExerciseRowTexts {
  const { t, f } = i18n;
  const title = `${t.exerciseLog.kinds[e.kind]} · ${t.daily.minutes(f.integer(e.durationMin))}`;
  const intensity = t.exerciseLog.intensities[e.intensity];
  return { title, detail: energy === undefined ? intensity : `${intensity} · ${exerciseEnergyText(i18n, energy)}` };
}
