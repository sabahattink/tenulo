import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { exerciseEntries } from "@/db/schema";
import type { LocalDate } from "@/domain/date";
import {
  EXERCISE_KINDS,
  type ExerciseKind,
  INTENSITIES,
  type Intensity,
  MAX_EXERCISE_KCAL,
  isDuration,
} from "@/domain/exercise";
import { ulid } from "@/domain/id";

export type ExerciseEntry = typeof exerciseEntries.$inferSelect;

const MAX_NOTE = 1_000;

export function useExerciseDay(date: LocalDate): readonly ExerciseEntry[] {
  const { data } = useLiveQuery(
    db.select().from(exerciseEntries).where(eq(exerciseEntries.localDate, date)).orderBy(asc(exerciseEntries.loggedAt)),
    [date],
  );
  return data;
}

export function useExerciseRange(from: LocalDate, to: LocalDate): readonly ExerciseEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(exerciseEntries)
      .where(and(gte(exerciseEntries.localDate, from), lte(exerciseEntries.localDate, to)))
      .orderBy(desc(exerciseEntries.localDate), desc(exerciseEntries.loggedAt)),
    [from, to],
  );
  return data;
}

export interface NewExercise {
  readonly date: LocalDate;
  readonly kind: ExerciseKind;
  readonly durationMin: number;
  readonly intensity: Intensity;
  /** Only what the user typed; null means "show an estimate". */
  readonly energyKcal: number | null;
  readonly note: string | null;
}

export async function addExercise(e: NewExercise, now: Date = new Date()): Promise<string> {
  if (!EXERCISE_KINDS.includes(e.kind)) throw new RangeError(`Unknown exercise: ${e.kind}`);
  if (!INTENSITIES.includes(e.intensity)) throw new RangeError(`Unknown intensity: ${e.intensity}`);
  if (!isDuration(e.durationMin)) throw new RangeError(`Invalid duration: ${e.durationMin}`);
  if (e.energyKcal !== null && (!Number.isInteger(e.energyKcal) || e.energyKcal < 0 || e.energyKcal > MAX_EXERCISE_KCAL)) {
    throw new RangeError(`Invalid energy: ${e.energyKcal}`);
  }
  const note = e.note?.trim() || null;
  if (note !== null && note.length > MAX_NOTE) throw new RangeError("Note too long");
  const ms = now.getTime();
  const id = ulid(ms);
  await db.insert(exerciseEntries).values({
    id,
    localDate: e.date,
    loggedAt: ms,
    kind: e.kind,
    durationMin: e.durationMin,
    intensity: e.intensity,
    energyKcal: e.energyKcal,
    note,
    createdAt: ms,
    updatedAt: ms,
  });
  return id;
}

export async function deleteExercise(id: string): Promise<void> {
  await db.delete(exerciseEntries).where(eq(exerciseEntries.id, id));
}
