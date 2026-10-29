import { type LocalDate, toDayNumber } from "../domain/date";

export type TimelineKind = "weight" | "injection" | "side-effect";
export type TimelineFilter = "all" | TimelineKind;

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

/** Newest first, filtered, grouped into calendar months. */
export function timeline<T extends TimelineItem>(items: readonly T[], filter: TimelineFilter): TimelineSection<T>[] {
  const sorted = items
    .filter((i) => filter === "all" || i.kind === filter)
    .sort((a, b) => toDayNumber(b.date) - toDayNumber(a.date) || b.at - a.at);
  const sections: { month: string; items: T[] }[] = [];
  for (const item of sorted) {
    const month = item.date.slice(0, 7);
    const last = sections.at(-1);
    if (last?.month === month) last.items.push(item);
    else sections.push({ month, items: [item] });
  }
  return sections;
}
