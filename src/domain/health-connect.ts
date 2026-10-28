/**
 * Turning Health Connect weight readings into Tenulo weight entries. Read-only: Tenulo never
 * writes to Health Connect. Each imported row keeps its Health Connect record id, and the database
 * keeps that id unique, so syncing the same window twice can never duplicate a reading.
 */
import { localDateOf } from "./date";
import { isPlausibleWeight } from "./weight";

const MS_PER_DAY = 86_400_000;

/** How far back the first sync reads. */
export const FIRST_SYNC_DAYS = 365;
/** Later syncs re-read this many days before the last one: scales often upload late. */
export const SYNC_OVERLAP_DAYS = 3;

/** The parts of a Health Connect WeightRecord that Tenulo reads. */
export interface HealthWeight {
  readonly id: string | undefined;
  /** ISO-8601 instant. */
  readonly time: string;
  readonly grams: number;
}

export interface ImportedWeight {
  readonly healthConnectId: string;
  readonly measuredAt: number;
  readonly localDate: string;
  readonly weightG: number;
}

/** Undefined for readings Tenulo cannot store: no id, unreadable time or an implausible weight. */
export function toImportedWeight(r: HealthWeight): ImportedWeight | undefined {
  if (r.id === undefined || r.id === "") return undefined;
  const measuredAt = Date.parse(r.time);
  if (!Number.isFinite(measuredAt)) return undefined;
  if (!Number.isFinite(r.grams)) return undefined;
  const weightG = Math.round(r.grams);
  if (!isPlausibleWeight(weightG)) return undefined;
  return { healthConnectId: r.id, measuredAt, localDate: localDateOf(new Date(measuredAt)), weightG };
}

/** The readings worth inserting: storable, not already imported, each id once. */
export function importableWeights(records: readonly HealthWeight[], known: ReadonlySet<string>): ImportedWeight[] {
  const seen = new Set(known);
  const out: ImportedWeight[] = [];
  for (const r of records) {
    const w = toImportedWeight(r);
    if (w === undefined || seen.has(w.healthConnectId)) continue;
    seen.add(w.healthConnectId);
    out.push(w);
  }
  return out;
}

/** The time window to read on this sync. */
export function syncRange(lastSyncedAt: number | null, now: number): { startMs: number; endMs: number } {
  const earliest = now - FIRST_SYNC_DAYS * MS_PER_DAY;
  if (lastSyncedAt === null) return { startMs: earliest, endMs: now };
  const from = Math.min(lastSyncedAt, now) - SYNC_OVERLAP_DAYS * MS_PER_DAY;
  return { startMs: Math.max(from, earliest), endMs: now };
}
