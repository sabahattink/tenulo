/**
 * Every History line as text, in the user's language: what it says, its icon, where a tap goes and
 * what a long press deletes. Pure, so both languages are tested without a screen.
 */
import { type LocalDate, parseLocalDate } from "../domain/date";
import { type ExerciseKind, type Intensity, estimateExerciseKcal } from "../domain/exercise";
import type { InjectionSite } from "../domain/injection";
import { lengthUnitFor } from "../domain/measurement";
import { type SideEffectType, isSeverity } from "../domain/side-effect";
import type { WeightUnit } from "../domain/weight";
import type { I18n } from "../i18n";
import type { IconName } from "./icons";
import { formatLength } from "./progress/length";
import type { TimelineFilter, TimelineItem, TimelineKind } from "./timeline";
import {
  type FoodLogRow,
  type MeasurementRow,
  type WaterLogRow,
  mealLines,
  measurementSittings,
  waterLines,
  weightOnOrBefore,
} from "./timeline-groups";

export interface TimelineRow extends TimelineItem {
  readonly title: string;
  readonly detail: string;
  readonly icon: IconName;
  /** Side effects are drawn in the warning tint, everything else in the accent. */
  readonly tint: "accent" | "warn";
  /** A tap opens the day where these records are kept. */
  readonly open?: { readonly screen: "food" | "water"; readonly date: LocalDate; readonly hint: string };
  /** A long press deletes these records, after asking `question`. */
  readonly remove?: { readonly ids: readonly string[]; readonly question: string };
}

export interface TimelineData {
  readonly weights: readonly {
    readonly id: string;
    readonly localDate: string;
    readonly measuredAt: number;
    readonly weightG: number;
    readonly source: string;
  }[];
  readonly injections: readonly {
    readonly id: string;
    readonly localDate: string;
    readonly takenAt: number;
    readonly doseMcg: number;
    readonly site: InjectionSite | null;
    readonly note: string | null;
  }[];
  readonly sideEffects: readonly {
    readonly id: string;
    readonly localDate: string;
    readonly createdAt: number;
    readonly type: SideEffectType;
    readonly severity: number;
    readonly note: string | null;
  }[];
  readonly food: readonly FoodLogRow[];
  readonly water: readonly WaterLogRow[];
  readonly measurements: readonly MeasurementRow[];
  readonly exercise: readonly {
    readonly id: string;
    readonly localDate: string;
    readonly loggedAt: number;
    readonly kind: ExerciseKind;
    readonly durationMin: number;
    readonly intensity: Intensity;
    readonly energyKcal: number | null;
    readonly note: string | null;
  }[];
}

const joined = (parts: readonly (string | null | undefined)[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");

/** The lines for `filter` (only those kinds are built), not yet sorted or grouped by month. */
export function timelineRows(data: TimelineData, filter: TimelineFilter, unit: WeightUnit, { t, f }: I18n): TimelineRow[] {
  const wants = (kind: TimelineKind) => filter === "all" || filter === kind;
  const ask = t.history.deleteTitle;
  const rows: TimelineRow[] = [];

  if (wants("weight")) {
    for (const w of data.weights) {
      rows.push({
        kind: "weight",
        id: w.id,
        date: parseLocalDate(w.localDate),
        at: w.measuredAt,
        title: f.weight(w.weightG, unit),
        detail: w.source === "health_connect" ? t.history.fromHealthConnect : t.history.weighIn,
        icon: "scale",
        tint: "accent",
        remove: { ids: [w.id], question: ask },
      });
    }
  }
  if (wants("injection")) {
    for (const s of data.injections) {
      rows.push({
        kind: "injection",
        id: s.id,
        date: parseLocalDate(s.localDate),
        at: s.takenAt,
        title: t.history.injection(f.dose(s.doseMcg)),
        detail: joined([s.site ? t.sites[s.site] : t.history.siteNotRecorded, s.note]),
        icon: "pen",
        tint: "accent",
        remove: { ids: [s.id], question: ask },
      });
    }
  }
  if (wants("side-effect")) {
    for (const e of data.sideEffects) {
      rows.push({
        kind: "side-effect",
        id: e.id,
        date: parseLocalDate(e.localDate),
        at: e.createdAt,
        title: t.sideEffects[e.type],
        detail: joined([isSeverity(e.severity) ? t.severity[e.severity] : "", e.note]),
        icon: "drop",
        tint: "warn",
        remove: { ids: [e.id], question: ask },
      });
    }
  }
  if (wants("food")) {
    // Single foods are changed and deleted in the food diary; History shows the meal and opens the day.
    for (const m of mealLines(data.food)) {
      rows.push({
        kind: "food",
        id: m.id,
        date: m.date,
        at: m.at,
        title: t.historyLog.meals[m.meal],
        detail: joined([t.historyLog.foods(m.foods), `${f.integer(m.energyKcal)} kcal`]),
        icon: "meal",
        tint: "accent",
        open: { screen: "food", date: m.date, hint: t.historyLog.openFood },
      });
    }
  }
  if (wants("water")) {
    for (const w of waterLines(data.water)) {
      rows.push({
        kind: "water",
        id: w.id,
        date: w.date,
        at: w.at,
        title: t.historyLog.water(`${f.integer(w.totalMl)} ml`),
        detail: t.historyLog.entries(w.entryIds.length),
        icon: "glass",
        tint: "accent",
        open: { screen: "water", date: w.date, hint: t.historyLog.openWater },
        remove: { ids: w.entryIds, question: t.historyLog.deleteWaterTitle },
      });
    }
  }
  if (wants("measurement")) {
    const lengthUnit = lengthUnitFor(unit);
    for (const s of measurementSittings(data.measurements)) {
      rows.push({
        kind: "measurement",
        id: s.id,
        date: s.date,
        at: s.at,
        title: t.historyLog.measurements,
        detail: joined(s.readings.map((r) => `${t.measure.sites[r.site]} ${formatLength(f, r.lengthMm, lengthUnit)}`)),
        icon: "tape",
        tint: "accent",
        remove: { ids: s.readings.map((r) => r.id), question: t.historyLog.deleteSittingTitle },
      });
    }
  }
  if (wants("exercise")) {
    const weights = data.weights.map((w) => ({ date: parseLocalDate(w.localDate), weightG: w.weightG }));
    for (const x of data.exercise) {
      const date = parseLocalDate(x.localDate);
      const estimate =
        x.energyKcal === null ? estimateExerciseKcal(x.kind, x.intensity, x.durationMin, weightOnOrBefore(weights, date)) : undefined;
      const energy =
        x.energyKcal !== null
          ? `${f.integer(x.energyKcal)} kcal`
          : estimate === undefined
            ? undefined
            : t.historyLog.estimate(`${f.integer(estimate)} kcal`);
      rows.push({
        kind: "exercise",
        id: x.id,
        date,
        at: x.loggedAt,
        title: joined([t.historyLog.exerciseKinds[x.kind], t.historyLog.minutes(f.integer(x.durationMin))]),
        detail: joined([t.historyLog.intensities[x.intensity], energy, x.note]),
        icon: "stopwatch",
        tint: "accent",
        remove: { ids: [x.id], question: ask },
      });
    }
  }
  return rows;
}
