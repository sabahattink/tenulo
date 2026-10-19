import { type LocalDate, diffDays } from "../domain/date";
import type { Forecast } from "../domain/forecast";
import { type WeightUnit, formatWeightChange } from "../domain/weight";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct", or "18 Oct 2027" when the year differs from `today`'s. */
export function shortDate(date: LocalDate, today: LocalDate): string {
  const [y, m, d] = date.split("-");
  const label = `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
  return y === today.slice(0, 4) ? label : `${label} ${y}`;
}

/** "Today", "Yesterday", "3 days ago", or a date further back. */
export function relativeDay(date: LocalDate, today: LocalDate): string {
  const days = diffDays(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return shortDate(date, today);
}

/**
 * One calm sentence about where the trend is heading. Never a promise, never advice: when the
 * data cannot support a date, it says so instead of inventing one.
 */
export function forecastText(f: Forecast, unit: WeightUnit, today: LocalDate): string {
  const perWeek = (rate: number) => `${formatWeightChange(rate * 7, unit)} per week`;
  switch (f.kind) {
    case "insufficient-data":
      return `Log ${f.needed - f.points} more ${f.needed - f.points === 1 ? "day" : "days"} to see where your trend is heading.`;
    case "no-goal":
      return `Trend: ${perWeek(f.rateGPerDay)}. Set a goal to see a projected date.`;
    case "reached":
      return "Your trend is at your goal.";
    case "steady":
      return "Your trend is holding steady.";
    case "away-from-goal":
      return `Trend: ${perWeek(f.rateGPerDay)}, moving away from your goal.`;
    case "beyond-horizon":
      return `Trend: ${perWeek(f.rateGPerDay)}. At this pace your goal is more than two years away.`;
    case "on-track":
      return `At ${perWeek(f.rateGPerDay)}, your trend would reach your goal around ${shortDate(f.goalDate, today)}.`;
  }
}
