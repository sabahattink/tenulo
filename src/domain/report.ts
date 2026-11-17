/**
 * The facts behind the PDF report a user can hand to their doctor. Everything here is a count,
 * a range or a value the user logged; nothing is interpreted or judged.
 */
import { type LocalDate, addDays, diffDays, toDayNumber } from "./date";
import { EXERCISE_KINDS, type ExerciseKind } from "./exercise";
import { INJECTION_SITES, type InjectionSite, type PlanStep } from "./injection";
import { type MeasurementPoint, type MeasurementSite, siteSummaries } from "./measurement";
import { SIDE_EFFECT_TYPES, type Severity, type SideEffectType } from "./side-effect";
import { type TrendPoint, type WeightReading, smoothedTrend } from "./trend";

export type ReportPeriod = 30 | 90 | 180 | "all";
export const REPORT_PERIODS: readonly ReportPeriod[] = [30, 90, 180, "all"];

/** A weekly rate over a shorter span would mostly be water weight. */
const MIN_RATE_SPAN_DAYS = 14;

export interface ReportInjection {
  readonly date: LocalDate;
  readonly doseMcg: number;
  readonly site: InjectionSite | null;
}

export interface ReportSideEffect {
  readonly date: LocalDate;
  readonly type: SideEffectType;
  readonly severity: Severity;
  readonly note: string | null;
}

/** What was eaten on one day, added up from the entries the user logged. */
export interface ReportFoodDay {
  readonly date: LocalDate;
  readonly energyKcal: number;
  /** Protein of the entries that have a value; null when none of them has one. */
  readonly proteinMg: number | null;
  /** Entries that day without a protein value (custom foods may leave it empty). */
  readonly proteinUnknown: number;
}

export interface ReportWaterDay {
  readonly date: LocalDate;
  readonly amountMl: number;
}

/** Only what the user logged; Tenulo's energy estimates are left out of the report. */
export interface ReportExercise {
  readonly date: LocalDate;
  readonly kind: ExerciseKind;
  readonly durationMin: number;
}

export interface ReportInput {
  readonly from: LocalDate;
  readonly to: LocalDate;
  /** Every reading, also before `from`: the trend needs that history to start in the right place. */
  readonly weights: readonly WeightReading[];
  readonly medicationName: string | undefined;
  readonly planSteps: readonly PlanStep[];
  readonly injections: readonly ReportInjection[];
  readonly sideEffects: readonly ReportSideEffect[];
  /** One row per day with food logged (several rows of a day are added together). */
  readonly foodDays: readonly ReportFoodDay[];
  readonly waterDays: readonly ReportWaterDay[];
  readonly measurements: readonly MeasurementPoint[];
  readonly exercises: readonly ReportExercise[];
}

export interface LengthReading {
  readonly date: LocalDate;
  readonly lengthMm: number;
}

export interface MeasurementRow {
  readonly site: MeasurementSite;
  readonly first: LengthReading;
  readonly last: LengthReading;
  readonly readings: number;
  /** Last minus first; undefined with one reading. */
  readonly changeMm: number | undefined;
}

export interface WeightSection {
  readonly trend: readonly TrendPoint[];
  readonly firstDate: LocalDate;
  readonly lastDate: LocalDate;
  /** Days with at least one weigh-in. */
  readonly weighIns: number;
  readonly startTrendG: number;
  readonly endTrendG: number;
  readonly changeG: number;
  /** Trend change per 7 days; undefined over less than two weeks. */
  readonly perWeekG: number | undefined;
  readonly lowestG: number;
  readonly highestG: number;
}

export interface Report {
  readonly from: LocalDate;
  readonly to: LocalDate;
  readonly days: number;
  readonly weight: WeightSection | undefined;
  readonly medicationName: string | undefined;
  readonly planSteps: readonly PlanStep[];
  readonly injections: {
    readonly count: number;
    readonly rows: readonly ReportInjection[];
    readonly gaps: { readonly minDays: number; readonly maxDays: number; readonly meanDays: number } | undefined;
    readonly sites: readonly { readonly site: InjectionSite; readonly count: number }[];
  };
  readonly sideEffects: {
    readonly total: number;
    readonly byType: readonly { readonly type: SideEffectType; readonly count: number; readonly strongest: Severity }[];
    readonly rows: readonly ReportSideEffect[];
  };
  /** Averages are per day with food logged, rounded to whole kcal and milligrams. */
  readonly nutrition: {
    readonly daysLogged: number;
    readonly energyKcalPerDay: number | undefined;
    readonly proteinMgPerDay: number | undefined;
    /**
     * Some entry had no protein value, so the protein average counts only the foods that had one
     * (and only the days with at least one such food).
     */
    readonly proteinIncomplete: boolean;
  };
  readonly water: {
    readonly daysLogged: number;
    readonly mlPerDay: number | undefined;
  };
  /** First and last reading of each measured site within the period, in body order. */
  readonly measurements: readonly MeasurementRow[];
  readonly exercise: {
    readonly sessions: number;
    readonly minutes: number;
    /** Most minutes first. */
    readonly byKind: readonly { readonly kind: ExerciseKind; readonly sessions: number; readonly minutes: number }[];
  };
}

/** First day of a report ending `to`. "all" starts at the earliest record, if there is one. */
export function reportStart(period: ReportPeriod, to: LocalDate, earliest: LocalDate | undefined): LocalDate {
  if (period !== "all") return addDays(to, -(period - 1));
  if (earliest === undefined || diffDays(earliest, to) < 0) return to;
  return earliest;
}

const byDate = <T extends { date: LocalDate }>(a: T, b: T) => toDayNumber(a.date) - toDayNumber(b.date);

export function buildReport(input: ReportInput): Report {
  const inPeriod = (date: LocalDate) => diffDays(input.from, date) >= 0 && diffDays(date, input.to) >= 0;
  return {
    from: input.from,
    to: input.to,
    days: diffDays(input.from, input.to) + 1,
    weight: weightSection(input.weights, inPeriod),
    medicationName: input.medicationName,
    planSteps: [...input.planSteps]
      .filter((s) => diffDays(s.startDate, input.to) >= 0)
      .sort((a, b) => toDayNumber(a.startDate) - toDayNumber(b.startDate)),
    injections: injectionSection(input.injections.filter((i) => inPeriod(i.date))),
    sideEffects: sideEffectSection(input.sideEffects.filter((e) => inPeriod(e.date))),
    nutrition: nutritionSection(input.foodDays.filter((d) => inPeriod(d.date))),
    water: waterSection(input.waterDays.filter((d) => inPeriod(d.date))),
    measurements: measurementSection(input.measurements.filter((m) => inPeriod(m.date))),
    exercise: exerciseSection(input.exercises.filter((e) => inPeriod(e.date))),
  };
}

/** Sum of the day's values over the number of distinct days, rounded; undefined without days. */
function perDay<T extends { readonly date: LocalDate }>(rows: readonly T[], value: (row: T) => number): number | undefined {
  const days = new Set(rows.map((r) => r.date)).size;
  if (days === 0) return undefined;
  return Math.round(rows.reduce((sum, r) => sum + value(r), 0) / days);
}

/** A day whose foods all lack a protein value counts for energy, not for protein. */
function nutritionSection(days: readonly ReportFoodDay[]): Report["nutrition"] {
  const withProtein = days.flatMap((d) => (d.proteinMg === null ? [] : [{ date: d.date, proteinMg: d.proteinMg }]));
  return {
    daysLogged: new Set(days.map((d) => d.date)).size,
    energyKcalPerDay: perDay(days, (d) => d.energyKcal),
    proteinMgPerDay: perDay(withProtein, (d) => d.proteinMg),
    proteinIncomplete: days.some((d) => d.proteinUnknown > 0),
  };
}

function waterSection(days: readonly ReportWaterDay[]): Report["water"] {
  return { daysLogged: new Set(days.map((d) => d.date)).size, mlPerDay: perDay(days, (d) => d.amountMl) };
}

function measurementSection(points: readonly MeasurementPoint[]): Report["measurements"] {
  return siteSummaries(points).flatMap((s) => {
    const first = s.points[0];
    const last = s.points.at(-1);
    if (first === undefined || last === undefined) return [];
    return [
      {
        site: s.site,
        first: { date: first.date, lengthMm: first.lengthMm },
        last: { date: last.date, lengthMm: last.lengthMm },
        readings: s.points.length,
        changeMm: s.changeMm,
      },
    ];
  });
}

function exerciseSection(sessions: readonly ReportExercise[]): Report["exercise"] {
  const kinds = new Map<ExerciseKind, { sessions: number; minutes: number }>();
  for (const s of sessions) {
    const k = kinds.get(s.kind) ?? { sessions: 0, minutes: 0 };
    kinds.set(s.kind, { sessions: k.sessions + 1, minutes: k.minutes + s.durationMin });
  }
  const order = (k: ExerciseKind) => EXERCISE_KINDS.indexOf(k);
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((sum, s) => sum + s.durationMin, 0),
    byKind: [...kinds.entries()]
      .map(([kind, k]) => ({ kind, ...k }))
      .sort((a, b) => b.minutes - a.minutes || order(a.kind) - order(b.kind)),
  };
}

function weightSection(readings: readonly WeightReading[], inPeriod: (d: LocalDate) => boolean): WeightSection | undefined {
  const trend = smoothedTrend(readings).filter((p) => inPeriod(p.date));
  const first = trend[0];
  const last = trend.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const span = diffDays(first.date, last.date);
  const changeG = last.trendG - first.trendG;
  const values = trend.map((p) => p.valueG);
  return {
    trend,
    firstDate: first.date,
    lastDate: last.date,
    weighIns: trend.length,
    startTrendG: Math.round(first.trendG),
    endTrendG: Math.round(last.trendG),
    changeG: Math.round(changeG),
    perWeekG: span >= MIN_RATE_SPAN_DAYS ? Math.round((changeG / span) * 7) : undefined,
    lowestG: Math.min(...values),
    highestG: Math.max(...values),
  };
}

function injectionSection(shots: readonly ReportInjection[]): Report["injections"] {
  const rows = [...shots].sort(byDate);
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (prev !== undefined && cur !== undefined) gaps.push(diffDays(prev.date, cur.date));
  }
  const counts = new Map<InjectionSite, number>();
  for (const r of rows) if (r.site !== null) counts.set(r.site, (counts.get(r.site) ?? 0) + 1);
  return {
    count: rows.length,
    rows,
    gaps:
      gaps.length === 0
        ? undefined
        : {
            minDays: Math.min(...gaps),
            maxDays: Math.max(...gaps),
            meanDays: Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10,
          },
    sites: INJECTION_SITES.flatMap((site) => {
      const count = counts.get(site);
      return count === undefined ? [] : [{ site, count }];
    }),
  };
}

function sideEffectSection(effects: readonly ReportSideEffect[]): Report["sideEffects"] {
  const rows = [...effects].sort(byDate);
  const groups = new Map<SideEffectType, { count: number; strongest: Severity }>();
  for (const e of rows) {
    const g = groups.get(e.type);
    groups.set(e.type, {
      count: (g?.count ?? 0) + 1,
      strongest: g === undefined || e.severity > g.strongest ? e.severity : g.strongest,
    });
  }
  const order = (t: SideEffectType) => SIDE_EFFECT_TYPES.indexOf(t);
  const byType = [...groups.entries()]
    .map(([type, g]) => ({ type, count: g.count, strongest: g.strongest }))
    .sort((a, b) => b.count - a.count || order(a.type) - order(b.type));
  return { total: rows.length, byType, rows };
}
