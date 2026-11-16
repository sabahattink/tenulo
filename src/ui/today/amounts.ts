/**
 * The small rules behind the water and exercise screens: how amounts are typed, stepped and
 * shown. Pure TypeScript (no React Native), so it is unit-tested like the domain.
 */
import { MAX_DURATION_MIN, MAX_EXERCISE_KCAL } from "../../domain/exercise";
import { type ParseWholeNumberResult, parseWholeNumber } from "../../domain/goals";
import { MAX_WATER_ENTRY_ML } from "../../domain/water";

/** One tap on the water screen: common glass and bottle sizes. Never a recommendation. */
export const WATER_CHIPS_ML = [200, 250, 330, 500] as const;

/** The duration stepper's step. */
export const DURATION_STEP_MIN = 5;

/** What a new exercise starts at; the user changes it with the stepper or by typing. */
export const DEFAULT_DURATION_MIN = 30;

const ML_PER_CENTILITRE = 10;

/**
 * Litres to two decimals at most, without trailing zeros: "1.75", "2", "0.33" (or "1,75" with a
 * comma). Rounded to the nearest 10 ml. The unit ("L") is added by the caller.
 */
export function formatLitres(ml: number, decimalMark: string): string {
  const centi = Math.round(ml / ML_PER_CENTILITRE);
  const whole = Math.trunc(centi / 100);
  const fraction = String(centi % 100).padStart(2, "0").replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${whole}${decimalMark}${fraction}`;
}

/**
 * The duration stepper: five-minute steps. A typed odd value ("23") snaps to the next step in the
 * direction pressed. Never below one step (a typed "3" stays as it is), never past a day.
 */
export function stepDuration(minutes: number, direction: 1 | -1): number {
  if (direction === 1) {
    return Math.min(MAX_DURATION_MIN, Math.floor(minutes / DURATION_STEP_MIN) * DURATION_STEP_MIN + DURATION_STEP_MIN);
  }
  const snapped = Math.ceil(minutes / DURATION_STEP_MIN) * DURATION_STEP_MIN - DURATION_STEP_MIN;
  return Math.max(Math.min(minutes, DURATION_STEP_MIN), snapped);
}

/** Whole minutes, 1 to a day. */
export function parseDuration(input: string): ParseWholeNumberResult {
  return parseWholeNumber(input, { min: 1, max: MAX_DURATION_MIN });
}

export type ParseOptionalResult = { readonly ok: true; readonly value: number | null } | Extract<ParseWholeNumberResult, { ok: false }>;

/** Energy the user knows (from a watch, say), in whole kcal; empty means "show an estimate". */
export function parseOptionalKcal(input: string): ParseOptionalResult {
  if (input.trim() === "") return { ok: true, value: null };
  return parseWholeNumber(input, { min: 0, max: MAX_EXERCISE_KCAL });
}

/** One water entry in whole millilitres (see isWaterAmount). */
export function parseWaterMl(input: string): ParseWholeNumberResult {
  return parseWholeNumber(input, { min: 1, max: MAX_WATER_ENTRY_ML });
}

/** The clock time of a stored instant (UTC ms) on this phone, as a minute of the day. */
export function minuteOfDayAt(instantMs: number): number {
  const at = new Date(instantMs);
  return at.getHours() * 60 + at.getMinutes();
}
