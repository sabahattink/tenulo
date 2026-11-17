/**
 * Exercise the user did. Energy is what they entered (from a watch, say); when they enter none,
 * the screens show an estimate marked as one, never stored.
 */

export const EXERCISE_KINDS = ["walking", "running", "cycling", "swimming", "strength", "yoga", "sports", "other"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export const INTENSITIES = ["light", "moderate", "vigorous"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const MAX_DURATION_MIN = 1440;
export const MAX_EXERCISE_KCAL = 10_000;

/**
 * Metabolic equivalents, rounded from the Compendium of Physical Activities (Ainsworth et al.,
 * 2011), one representative activity per kind and intensity. Good enough for an estimate labelled
 * as one; not a measurement.
 */
export const MET: Readonly<Record<ExerciseKind, Readonly<Record<Intensity, number>>>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5.0 },
  running: { light: 6.0, moderate: 8.3, vigorous: 11.0 },
  cycling: { light: 4.0, moderate: 6.8, vigorous: 10.0 },
  swimming: { light: 5.8, moderate: 7.0, vigorous: 9.8 },
  strength: { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  yoga: { light: 2.5, moderate: 3.0, vigorous: 4.0 },
  sports: { light: 4.0, moderate: 6.0, vigorous: 8.0 },
  other: { light: 2.5, moderate: 4.0, vigorous: 6.0 },
};

export function isDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_DURATION_MIN;
}

/** MET x body weight (kg) x hours, rounded to whole kcal; undefined without a body weight. */
export function estimateExerciseKcal(
  kind: ExerciseKind,
  intensity: Intensity,
  minutes: number,
  weightG: number | undefined,
): number | undefined {
  if (weightG === undefined) return undefined;
  return Math.round((MET[kind][intensity] * (weightG / 1000) * minutes) / 60);
}
