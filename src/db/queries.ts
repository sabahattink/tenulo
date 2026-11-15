/**
 * Reads whose logic is worth testing against the real driver (queries.test.ts). Synchronous, and
 * read with `.all()`: see purgeDeletedData in ops.ts for why no statement may stay half-read.
 */
import { and, desc, eq, lte } from "drizzle-orm";
import type { LocalDate } from "../domain/date";
import type { SyncDb } from "./ops";
import { injections } from "./schema";

/**
 * The medication's latest injection on or before `date` (later `takenAt` wins within a day), to
 * link a side effect to the shot it followed. Null when there is none. Filtered in SQL, so a
 * daily-shot user's older side effects still find their shot.
 */
export function injectionOnOrBefore(database: SyncDb, medicationId: string, date: LocalDate): string | null {
  const [row] = database
    .select({ id: injections.id })
    .from(injections)
    .where(and(eq(injections.medicationId, medicationId), lte(injections.localDate, date)))
    .orderBy(desc(injections.localDate), desc(injections.takenAt))
    .limit(1)
    .all();
  return row?.id ?? null;
}
