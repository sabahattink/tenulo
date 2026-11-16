import { asc, desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "@/db/client";
import { measurementEntries } from "@/db/schema";
import type { LocalDate } from "@/domain/date";
import { ulid } from "@/domain/id";
import { MEASUREMENT_SITES, type MeasurementSite, isPlausibleLength } from "@/domain/measurement";

export type MeasurementEntry = typeof measurementEntries.$inferSelect;

/** Every tape-measure reading, oldest first. */
export function useMeasurements(): readonly MeasurementEntry[] {
  const { data } = useLiveQuery(
    db.select().from(measurementEntries).orderBy(asc(measurementEntries.localDate), asc(measurementEntries.measuredAt)),
  );
  return data;
}

export function useMeasurementsOn(date: LocalDate): readonly MeasurementEntry[] {
  const { data } = useLiveQuery(
    db.select().from(measurementEntries).where(eq(measurementEntries.localDate, date)).orderBy(desc(measurementEntries.measuredAt)),
    [date],
  );
  return data;
}

/** Several sites measured at one sitting, saved together. */
export async function addMeasurements(
  readings: readonly { readonly site: MeasurementSite; readonly lengthMm: number }[],
  date: LocalDate,
  now: Date = new Date(),
): Promise<void> {
  if (readings.length === 0) return;
  for (const r of readings) {
    if (!MEASUREMENT_SITES.includes(r.site)) throw new RangeError(`Unknown site: ${r.site}`);
    if (!isPlausibleLength(r.lengthMm)) throw new RangeError(`Implausible length: ${r.lengthMm}`);
  }
  const ms = now.getTime();
  await db.insert(measurementEntries).values(
    readings.map((r, i) => ({
      id: ulid(ms + i),
      localDate: date,
      measuredAt: ms,
      site: r.site,
      lengthMm: r.lengthMm,
      note: null,
      createdAt: ms,
      updatedAt: ms,
    })),
  );
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.delete(measurementEntries).where(eq(measurementEntries.id, id));
}
