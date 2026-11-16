import type { Href } from "expo-router";
import type { LocalDate } from "@/domain/date";
import { type Meal, defaultMealFor } from "@/domain/food-log";
import { minuteOfDayAt } from "./amounts";

/**
 * Where Today and its modals link to. Some of these screens are built by the other daily-log
 * slices (docs/specs/2026-11-16-daily-log.md, "Screen contract"): until they are merged, typed
 * routes do not know them, so the cast to Href is made here, in one place, and nowhere else.
 */
const builtElsewhere = (path: string): Href => path as Href;

/** Slice A: food search, saving to `meal` on `date`. */
const foodAdd = (meal: Meal, date: LocalDate): Href => builtElsewhere(`/food/add?meal=${meal}&date=${date}`);

export const routes = {
  /** Slice A: the Food tab. */
  food: (): Href => builtElsewhere("/food"),
  foodAdd,
  /** Food search for the meal that fits the clock when tapped; the food screen lets the user pick another. */
  foodAddNow: (date: LocalDate): Href => foodAdd(defaultMealFor(minuteOfDayAt(Date.now())), date),
  /** Slice A: the user's own daily goals. */
  goals: (): Href => builtElsewhere("/goals"),
  /** Slice C: a tape-measure entry. */
  addMeasurement: (date: LocalDate): Href => builtElsewhere(`/add-measurement?date=${date}`),
  /** Slice C: the Progress tab, where the full trend chart now lives. */
  progress: (): Href => builtElsewhere("/progress"),
  water: (date: LocalDate): Href => ({ pathname: "/water", params: { date } }),
  logExercise: (date: LocalDate): Href => ({ pathname: "/log-exercise", params: { date } }),
  addWeight: (): Href => "/add-weight",
  logSideEffect: (): Href => "/log-side-effect",
};
