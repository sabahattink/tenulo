import { type LocalDate, addDays, diffDays, toDayNumber } from "./date";

/**
 * Injection sites, in the fixed order used to break ties. The order is a display convention
 * only; Tenulo never tells the user which site is medically preferable.
 */
export const INJECTION_SITES = [
  "abdomen-left",
  "abdomen-right",
  "thigh-left",
  "thigh-right",
  "arm-left",
  "arm-right",
] as const;
export type InjectionSite = (typeof INJECTION_SITES)[number];

export interface InjectionRecord {
  readonly date: LocalDate;
  readonly site: InjectionSite;
}

/**
 * The site used longest ago, for a "you used this one least recently" hint.
 * Sites never used come first; ties keep the order of `INJECTION_SITES`.
 * `enabled` lets the user exclude sites they do not use.
 */
export function leastRecentSite(
  history: readonly InjectionRecord[],
  enabled: readonly InjectionSite[] = INJECTION_SITES,
): InjectionSite | undefined {
  const lastUsed = new Map<InjectionSite, number>();
  for (const { date, site } of history) {
    const day = toDayNumber(date);
    const prev = lastUsed.get(site);
    if (prev === undefined || day > prev) lastUsed.set(site, day);
  }
  let best: InjectionSite | undefined;
  let bestDay = Infinity;
  for (const site of INJECTION_SITES) {
    if (!enabled.includes(site)) continue;
    const day = lastUsed.get(site) ?? -Infinity;
    if (day < bestDay) {
      best = site;
      bestDay = day;
    }
  }
  return best;
}

/** A step of the user's own schedule, exactly as they entered it. */
export interface PlanStep {
  readonly startDate: LocalDate;
  readonly doseMcg: number;
  readonly intervalDays: number;
}

export interface PlanPosition {
  readonly step: PlanStep;
  /** 0-based index of the step in the date-sorted plan. */
  readonly stepIndex: number;
  /** 1-based count of intervals since this step began; "week 3" for a weekly step. */
  readonly period: number;
  /** Start date of the next step, if the user has entered one. */
  readonly nextStepDate: LocalDate | undefined;
}

/**
 * Where `today` falls in the user's schedule. Returns undefined before the first step.
 * Descriptive only: it reports the plan the user typed in and never proposes a dose.
 */
export function planPosition(steps: readonly PlanStep[], today: LocalDate): PlanPosition | undefined {
  for (const s of steps) {
    if (!Number.isInteger(s.intervalDays) || s.intervalDays < 1) {
      throw new RangeError(`intervalDays must be a positive integer: ${s.intervalDays}`);
    }
  }
  const sorted = [...steps].sort((a, b) => toDayNumber(a.startDate) - toDayNumber(b.startDate));
  let index = -1;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s !== undefined && diffDays(s.startDate, today) >= 0) index = i;
  }
  const step = sorted[index];
  if (step === undefined) return undefined;
  return {
    step,
    stepIndex: index,
    period: Math.floor(diffDays(step.startDate, today) / step.intervalDays) + 1,
    nextStepDate: sorted[index + 1]?.startDate,
  };
}

/** The date the next injection is due, counting from the last one actually logged. */
export function nextDueDate(lastInjection: LocalDate, intervalDays: number): LocalDate {
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new RangeError(`intervalDays must be a positive integer: ${intervalDays}`);
  }
  return addDays(lastInjection, intervalDays);
}

/** Positive: days until due. Zero: due today. Negative: days overdue. */
export function daysUntilDue(lastInjection: LocalDate, intervalDays: number, today: LocalDate): number {
  return diffDays(today, nextDueDate(lastInjection, intervalDays));
}

export interface LoggedInjection {
  readonly date: LocalDate;
  readonly site: InjectionSite | null;
  readonly doseMcg: number;
}

export interface InjectionStatus {
  readonly lastDate: LocalDate | undefined;
  readonly lastSite: InjectionSite | undefined;
  readonly lastDoseMcg: number | undefined;
  readonly intervalDays: number;
  /** Undefined until the first injection is logged. */
  readonly nextDue: LocalDate | undefined;
  /** Positive: days until due. 0: due today. Negative: overdue. */
  readonly daysUntilDue: number | undefined;
  readonly plan: PlanPosition | undefined;
  /** Dose for the next shot: the user's plan if they have one, else what they logged last. */
  readonly expectedDoseMcg: number | undefined;
  /** Hint only: the enabled site used longest ago. */
  readonly suggestedSite: InjectionSite | undefined;
}

export const DEFAULT_INTERVAL_DAYS = 7;

export function injectionStatus(
  history: readonly LoggedInjection[],
  steps: readonly PlanStep[],
  today: LocalDate,
): InjectionStatus {
  const sorted = [...history].sort((a, b) => toDayNumber(a.date) - toDayNumber(b.date));
  const last = sorted.at(-1);
  const plan = planPosition(steps, today);
  const intervalDays = plan?.step.intervalDays ?? DEFAULT_INTERVAL_DAYS;
  const withSite = sorted.flatMap((i) => (i.site === null ? [] : [{ date: i.date, site: i.site }]));
  return {
    lastDate: last?.date,
    lastSite: last?.site ?? undefined,
    lastDoseMcg: last?.doseMcg,
    intervalDays,
    nextDue: last ? nextDueDate(last.date, intervalDays) : undefined,
    daysUntilDue: last ? daysUntilDue(last.date, intervalDays, today) : undefined,
    plan,
    expectedDoseMcg: plan?.step.doseMcg ?? last?.doseMcg,
    suggestedSite: leastRecentSite(withSite),
  };
}

/**
 * Where today sits in the current injection interval, for a "day 5 of 7" ring.
 * `day` is 1-based; once the shot is due or overdue the ring is full.
 */
export function cycleProgress(daysUntil: number, intervalDays: number): { day: number; fraction: number } {
  const day = Math.min(intervalDays, Math.max(1, intervalDays - daysUntil));
  const fraction = daysUntil <= 0 ? 1 : (intervalDays - daysUntil) / intervalDays;
  return { day, fraction: Math.min(1, Math.max(0, fraction)) };
}
