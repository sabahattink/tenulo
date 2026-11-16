import type { LocalDate } from "../domain/date";

/** Every kind of line in History, in the order the filters list them. */
export const TIMELINE_KINDS = ["weight", "injection", "side-effect", "food", "water", "measurement", "exercise"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];
export type TimelineFilter = "all" | TimelineKind;
export const TIMELINE_FILTERS: readonly TimelineFilter[] = ["all", ...TIMELINE_KINDS];

export interface TimelineItem {
  readonly kind: TimelineKind;
  readonly id: string;
  readonly date: LocalDate;
  /** Tie-break within a day: later first. */
  readonly at: number;
}

export interface TimelineSection<T extends TimelineItem> {
  /** "YYYY-MM" */
  readonly month: string;
  readonly items: readonly T[];
}

/**
 * Newest first, filtered, grouped into calendar months. A LocalDate is "YYYY-MM-DD", so comparing
 * the strings orders the days; that keeps a sort over years of meals and weigh-ins cheap.
 */
export function timeline<T extends TimelineItem>(items: readonly T[], filter: TimelineFilter): TimelineSection<T>[] {
  const sorted = items
    .filter((i) => filter === "all" || i.kind === filter)
    .sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1));
  const sections: { month: string; items: T[] }[] = [];
  for (const item of sorted) {
    const month = item.date.slice(0, 7);
    const last = sections.at(-1);
    if (last?.month === month) last.items.push(item);
    else sections.push({ month, items: [item] });
  }
  return sections;
}
