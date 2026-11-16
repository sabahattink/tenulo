import type { Href } from "expo-router";
import type { LocalDate } from "@/domain/date";
import { type Meal, defaultMealFor } from "@/domain/food-log";
import { minuteOfDayAt } from "./amounts";

/** Where Today and its modals link to; typed routes check every path. */
const foodAdd = (meal: Meal, date: LocalDate): Href => ({ pathname: "/food/add", params: { meal, date } });

export const routes = {
  /** The Food tab. */
  food: (): Href => "/food",
  foodAdd,
  /** Food search for the meal that fits the clock when tapped; the food screen lets the user pick another. */
  foodAddNow: (date: LocalDate): Href => foodAdd(defaultMealFor(minuteOfDayAt(Date.now())), date),
  /** The user's own daily goals. */
  goals: (): Href => "/goals",
  addMeasurement: (date: LocalDate): Href => ({ pathname: "/add-measurement", params: { date } }),
  /** The Progress tab, where the full trend chart lives. */
  progress: (): Href => "/progress",
  water: (date: LocalDate): Href => ({ pathname: "/water", params: { date } }),
  logExercise: (date: LocalDate): Href => ({ pathname: "/log-exercise", params: { date } }),
  addWeight: (): Href => "/add-weight",
  logSideEffect: (): Href => "/log-side-effect",
};
