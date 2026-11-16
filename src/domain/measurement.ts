/**
 * Tape-measure readings. Stored as whole millimetres; shown in centimetres, or in inches for people
 * who weigh themselves in pounds.
 */
import type { LocalDate } from "./date";
import type { WeightUnit } from "./weight";

export const MEASUREMENT_SITES = ["waist", "hip", "chest", "neck", "arm", "thigh"] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

export const LENGTH_UNITS = ["cm", "in"] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** Plausible circumference of any measured site; anything outside is almost certainly a typo. */
export const MIN_LENGTH_MM = 100;
export const MAX_LENGTH_MM = 3000;

const MM_PER_INCH = 25.4;

export function lengthUnitFor(weightUnit: WeightUnit): LengthUnit {
  return weightUnit === "lb" ? "in" : "cm";
}

export function toMillimetres(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value)) throw new RangeError(`Length must be a finite number: ${value}`);
  return Math.round(unit === "cm" ? value * 10 : value * MM_PER_INCH);
}

/** Display value, unrounded; round at the edge. */
export function fromMillimetres(mm: number, unit: LengthUnit): number {
  return unit === "cm" ? mm / 10 : mm / MM_PER_INCH;
}

export function isPlausibleLength(mm: number): boolean {
  return Number.isInteger(mm) && mm >= MIN_LENGTH_MM && mm <= MAX_LENGTH_MM;
}

export type ParseLengthResult =
  | { readonly ok: true; readonly mm: number }
  | { readonly ok: false; readonly reason: "empty" | "not-a-number" | "implausible" };

/** "92,5" or "92.5": one decimal at most, no thousands separator (as for weight). */
export function parseLengthInput(input: string, unit: LengthUnit): ParseLengthResult {
  const text = input.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^\d{1,3}([.,]\d)?$/.test(text)) return { ok: false, reason: "not-a-number" };
  const mm = toMillimetres(Number(text.replace(",", ".")), unit);
  if (!isPlausibleLength(mm)) return { ok: false, reason: "implausible" };
  return { ok: true, mm };
}

export interface MeasurementPoint {
  readonly site: MeasurementSite;
  readonly date: LocalDate;
  /** When it was taken (epoch ms); orders readings on the same day. */
  readonly measuredAt: number;
  readonly lengthMm: number;
}

export interface SiteSummary {
  readonly site: MeasurementSite;
  /** Oldest first. */
  readonly points: readonly MeasurementPoint[];
  readonly latestMm: number;
  readonly latestDate: LocalDate;
  /** Latest minus first; undefined with a single reading. */
  readonly changeMm: number | undefined;
}

/** One summary per site that has readings, in MEASUREMENT_SITES order. */
export function siteSummaries(points: readonly MeasurementPoint[]): SiteSummary[] {
  const out: SiteSummary[] = [];
  for (const site of MEASUREMENT_SITES) {
    const sorted = points
      .filter((p) => p.site === site)
      .sort((a, b) => (a.date === b.date ? a.measuredAt - b.measuredAt : a.date < b.date ? -1 : 1));
    const first = sorted[0];
    const latest = sorted.at(-1);
    if (first === undefined || latest === undefined) continue;
    out.push({
      site,
      points: sorted,
      latestMm: latest.lengthMm,
      latestDate: latest.date,
      changeMm: sorted.length > 1 ? latest.lengthMm - first.lengthMm : undefined,
    });
  }
  return out;
}
