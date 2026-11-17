import type { ExerciseKind } from "@/domain/exercise";
import type { IconName } from "../icons";

/** One line icon per kind of exercise, for the chips and Today's list. */
export const EXERCISE_ICONS: Readonly<Record<ExerciseKind, IconName>> = {
  walking: "walk",
  running: "run",
  cycling: "bike",
  swimming: "swim",
  strength: "dumbbell",
  yoga: "yoga",
  sports: "ball",
  other: "sparkle",
};
