import { and, asc, desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { createMedicationWithPlan } from "@/db/ops";
import { injections, medications, planSteps, sideEffects } from "@/db/schema";
import type { LocalDate } from "@/domain/date";
import { ulid } from "@/domain/id";
import type { InjectionSite } from "@/domain/injection";
import { MAX_DOSE_MCG, MIN_DOSE_MCG } from "@/domain/parse";
import type { SideEffectType } from "@/domain/side-effect";

export type Medication = typeof medications.$inferSelect;
export type Injection = typeof injections.$inferSelect;
export type PlanStepRow = typeof planSteps.$inferSelect;
export type SideEffect = typeof sideEffects.$inferSelect;
export type { SideEffectType };

function assertDose(mcg: number): void {
  if (!Number.isInteger(mcg) || mcg < MIN_DOSE_MCG || mcg > MAX_DOSE_MCG) throw new RangeError(`Invalid dose: ${mcg}`);
}

export function useActiveMedication(): Medication | undefined {
  const { data } = useLiveQuery(
    db.select().from(medications).where(eq(medications.active, true)).orderBy(asc(medications.createdAt)).limit(1),
  );
  return data[0];
}

/**
 * Creates the medication and, in the same transaction, the first step of the user's own plan:
 * the dose they say they are on now, repeating every `intervalDays`, starting `startDate`.
 */
export async function createMedication(input: {
  name: string;
  doseMcg: number;
  intervalDays: number;
  startDate: LocalDate;
}): Promise<string> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) throw new RangeError("Name must be 1-60 characters");
  assertDose(input.doseMcg);
  return createMedicationWithPlan(db, { ...input, name }, Date.now());
}

export async function renameMedication(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 60) throw new RangeError("Name must be 1-60 characters");
  await db.update(medications).set({ name: trimmed, updatedAt: Date.now() }).where(eq(medications.id, id));
}

export function usePlanSteps(medicationId: string | undefined): readonly PlanStepRow[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(planSteps)
      .where(eq(planSteps.medicationId, medicationId ?? ""))
      .orderBy(asc(planSteps.startDate)),
    [medicationId],
  );
  return data;
}

/** Adds or replaces the step starting on `startDate` (one step per medication per date). */
export async function upsertPlanStep(input: {
  medicationId: string;
  startDate: LocalDate;
  doseMcg: number;
  intervalDays: number;
}): Promise<void> {
  assertDose(input.doseMcg);
  const now = Date.now();
  await db
    .insert(planSteps)
    .values({ id: ulid(now), ...input, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [planSteps.medicationId, planSteps.startDate],
      set: { doseMcg: input.doseMcg, intervalDays: input.intervalDays, updatedAt: now },
    });
}

export async function deletePlanStep(id: string): Promise<void> {
  await db.delete(planSteps).where(eq(planSteps.id, id));
}

/** Every injection of every medication, newest first: the History log. */
export function useAllInjections(): readonly Injection[] {
  const { data } = useLiveQuery(
    db.select().from(injections).orderBy(desc(injections.localDate), desc(injections.takenAt)),
  );
  return data;
}

export function useInjections(medicationId: string | undefined): readonly Injection[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(injections)
      .where(eq(injections.medicationId, medicationId ?? ""))
      .orderBy(desc(injections.localDate), desc(injections.takenAt)),
    [medicationId],
  );
  return data;
}

export async function logInjection(input: {
  medicationId: string;
  doseMcg: number;
  site: InjectionSite | null;
  date: LocalDate;
  note?: string;
}): Promise<string> {
  assertDose(input.doseMcg);
  const now = Date.now();
  const id = ulid(now);
  await db.insert(injections).values({
    id,
    medicationId: input.medicationId,
    takenAt: now,
    localDate: input.date,
    doseMcg: input.doseMcg,
    site: input.site,
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function deleteInjection(id: string): Promise<void> {
  // Side effects linked to this shot keep their record; the link is cleared by the foreign key.
  await db.delete(injections).where(eq(injections.id, id));
}

export function useSideEffects(): readonly SideEffect[] {
  const { data } = useLiveQuery(
    db.select().from(sideEffects).orderBy(desc(sideEffects.localDate), desc(sideEffects.createdAt)),
  );
  return data;
}

export async function logSideEffect(input: {
  type: SideEffectType;
  severity: 1 | 2 | 3;
  date: LocalDate;
  injectionId: string | null;
  note?: string;
}): Promise<string> {
  const now = Date.now();
  const id = ulid(now);
  await db.insert(sideEffects).values({
    id,
    localDate: input.date,
    type: input.type,
    severity: input.severity,
    injectionId: input.injectionId,
    note: input.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function deleteSideEffect(id: string): Promise<void> {
  await db.delete(sideEffects).where(eq(sideEffects.id, id));
}

/** The latest injection on or before `date`, to link a side effect to the shot it followed. */
export async function injectionBefore(medicationId: string, date: LocalDate): Promise<string | null> {
  const rows = await db
    .select({ id: injections.id, localDate: injections.localDate })
    .from(injections)
    .where(and(eq(injections.medicationId, medicationId)))
    .orderBy(desc(injections.localDate))
    .limit(30);
  return rows.find((r) => r.localDate <= date)?.id ?? null;
}
