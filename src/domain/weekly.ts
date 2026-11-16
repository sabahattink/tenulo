/**
 * The last 7 days next to the 7 days before, for the Progress tab. Plain arithmetic over what the
 * user logged: an average counts only the days with something logged, so a day left empty is not
 * read as a zero. Nothing here judges a number; `direction` only says which way it moved.
 */
import { type LocalDate, addDays, diffDays } from "./date";

export const WEEK_DAYS = 7;

/** Two dates, both included. */
export interface DayWindow {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/** Today and the six days before it, and the seven days before those. */
export function weekWindows(today: LocalDate): { readonly current: DayWindow; readonly previous: DayWindow } {
  return {
    current: { from: addDays(today, -(WEEK_DAYS - 1)), to: today },
    previous: { from: addDays(today, -(2 * WEEK_DAYS - 1)), to: addDays(today, -WEEK_DAYS) },
  };
}

export function inWindow(date: LocalDate, window: DayWindow): boolean {
  return diffDays(window.from, date) >= 0 && diffDays(date, window.to) >= 0;
}

export interface DayValue {
  readonly date: LocalDate;
  readonly value: number;
}

export interface LoggedAverage {
  /** Whole units per logged day; undefined when nothing was logged in the window. */
  readonly perDay: number | undefined;
  /** Days in the window with something logged. */
  readonly daysLogged: number;
}

/** Sum over the window divided by the days that have a value, rounded to a whole unit. */
export function averageOverLoggedDays(values: readonly DayValue[], window: DayWindow, divisor = 1): LoggedAverage {
  const days = new Set<LocalDate>();
  let sum = 0;
  for (const v of values) {
    if (!inWindow(v.date, window)) continue;
    days.add(v.date);
    sum += v.value;
  }
  return { perDay: days.size === 0 ? undefined : Math.round(sum / days.size / divisor), daysLogged: days.size };
}

export interface ExerciseTotals {
  readonly sessions: number;
  readonly minutes: number;
}

export function exerciseTotals(sessions: readonly { readonly date: LocalDate; readonly durationMin: number }[], window: DayWindow): ExerciseTotals {
  let count = 0;
  let minutes = 0;
  for (const s of sessions) {
    if (!inWindow(s.date, window)) continue;
    count += 1;
    minutes += s.durationMin;
  }
  return { sessions: count, minutes };
}

export type Direction = "higher" | "lower" | "same";

/** Which way a number moved. Undefined when either side is missing: there is nothing to compare. */
export function direction(current: number | undefined, previous: number | undefined): Direction | undefined {
  if (current === undefined || previous === undefined) return undefined;
  if (current === previous) return "same";
  return current > previous ? "higher" : "lower";
}

export interface Comparison<T> {
  readonly current: T;
  readonly previous: T;
}

export interface WeeklyComparison {
  readonly current: DayWindow;
  readonly previous: DayWindow;
  /** Average kcal per day with food logged. */
  readonly energyKcal: Comparison<LoggedAverage>;
  /** Average whole grams of protein per day with food logged. */
  readonly proteinG: Comparison<LoggedAverage>;
  /** Average millilitres per day with water logged. */
  readonly waterMl: Comparison<LoggedAverage>;
  readonly exercise: Comparison<ExerciseTotals>;
}

export interface WeeklyInput {
  readonly today: LocalDate;
  /** Per-day food totals; protein in milligrams. */
  readonly food: readonly { readonly date: LocalDate; readonly energyKcal: number; readonly proteinMg: number }[];
  readonly water: readonly { readonly date: LocalDate; readonly amountMl: number }[];
  readonly exercise: readonly { readonly date: LocalDate; readonly durationMin: number }[];
}

const MG_PER_G = 1000;

export function weeklyComparison(input: WeeklyInput): WeeklyComparison {
  const { current, previous } = weekWindows(input.today);
  const both = <T>(of: (w: DayWindow) => T): Comparison<T> => ({ current: of(current), previous: of(previous) });
  const energy = input.food.map((d) => ({ date: d.date, value: d.energyKcal }));
  const protein = input.food.map((d) => ({ date: d.date, value: d.proteinMg }));
  const water = input.water.map((d) => ({ date: d.date, value: d.amountMl }));
  return {
    current,
    previous,
    energyKcal: both((w) => averageOverLoggedDays(energy, w)),
    proteinG: both((w) => averageOverLoggedDays(protein, w, MG_PER_G)),
    waterMl: both((w) => averageOverLoggedDays(water, w)),
    exercise: both((w) => exerciseTotals(input.exercise, w)),
  };
}
