import { StyleSheet, Text, View } from "react-native";
import { type Direction, type LoggedAverage, type WeeklyComparison, direction } from "@/domain/weekly";
import { useI18n } from "@/i18n/provider";
import { Card } from "../kit";
import { type Kind, type Theme, space, type } from "../theme";

/** A neutral glyph for which way a number moved; "same" shows none. Drawn muted, never red or green. */
const ARROWS: Record<Direction, string> = { higher: "↑", lower: "↓", same: "" };

interface Side {
  readonly value: string;
  readonly sub: string;
  /** What the value is compared on; undefined when nothing was logged. */
  readonly amount: number | undefined;
}

interface Metric {
  readonly label: string;
  /** Whose color the label wears, as in the rings and the quick-log tiles. */
  readonly kind: Kind;
  readonly current: Side;
  readonly previous: Side;
}

/** The last 7 days next to the 7 before: numbers and the direction they moved, nothing more. */
export function WeekCard({ theme, week }: { theme: Theme; week: WeeklyComparison }) {
  const { t, f } = useI18n();
  const w = t.progress.week;

  const average = (a: LoggedAverage, symbol: string): Side => ({
    value: a.perDay === undefined ? w.notLogged : `${f.integer(a.perDay)} ${symbol}`,
    sub: a.daysLogged === 0 ? "" : w.daysLogged(a.daysLogged),
    amount: a.perDay,
  });
  const exercise = (e: WeeklyComparison["exercise"]["current"]): Side => ({
    value: e.sessions === 0 ? w.notLogged : t.historyLog.minutes(f.integer(e.minutes)),
    sub: e.sessions === 0 ? "" : w.times(e.sessions),
    amount: e.sessions === 0 ? undefined : e.minutes,
  });

  const metrics: Metric[] = [
    { label: w.energy, kind: "food", current: average(week.energyKcal.current, "kcal"), previous: average(week.energyKcal.previous, "kcal") },
    { label: w.protein, kind: "protein", current: average(week.proteinG.current, "g"), previous: average(week.proteinG.previous, "g") },
    { label: w.water, kind: "water", current: average(week.waterMl.current, "ml"), previous: average(week.waterMl.previous, "ml") },
    { label: w.exercise, kind: "exercise", current: exercise(week.exercise.current), previous: exercise(week.exercise.previous) },
  ];

  if (metrics.every((m) => m.current.amount === undefined && m.previous.amount === undefined)) {
    return (
      <Card theme={theme}>
        <Text style={[type.body, { color: theme.muted }]}>{w.empty}</Text>
      </Card>
    );
  }

  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.columns} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={[type.caption, styles.column, { color: theme.text }]}>{f.upper(w.current)}</Text>
        <Text style={[type.caption, styles.column, { color: theme.muted }]}>{f.upper(w.previous)}</Text>
      </View>
      {metrics.map((m, i) => (
        <MetricRow key={m.label} theme={theme} metric={m} last={i === metrics.length - 1} />
      ))}
      <Text style={[type.small, { color: theme.muted }]}>{w.footnote}</Text>
    </Card>
  );
}

function MetricRow({ theme, metric, last }: { theme: Theme; metric: Metric; last: boolean }) {
  const { t } = useI18n();
  const w = t.progress.week;
  const moved = direction(metric.current.amount, metric.previous.amount);
  const side = (s: Side) => (s.sub === "" ? s.value : `${s.value}, ${s.sub}`);
  const label = [
    metric.label,
    `${w.current}: ${side(metric.current)}`,
    moved === undefined ? undefined : w.directions[moved],
    `${w.previous}: ${side(metric.previous)}`,
  ]
    .filter((p) => p !== undefined)
    .join(". ");
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.metric, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <Text style={[type.small, styles.label, { color: theme.kinds[metric.kind].ink }]}>{metric.label}</Text>
      <View style={styles.columns}>
        <View style={styles.column}>
          <View style={styles.valueRow}>
            <Text style={[type.number, { color: theme.text }]}>{metric.current.value}</Text>
            {moved !== undefined && ARROWS[moved] !== "" && <Text style={[type.number, { color: theme.muted }]}>{ARROWS[moved]}</Text>}
          </View>
          {metric.current.sub !== "" && <Text style={[type.small, { color: theme.muted }]}>{metric.current.sub}</Text>}
        </View>
        <View style={styles.column}>
          <Text style={[type.number, { color: theme.muted }]}>{metric.previous.value}</Text>
          {metric.previous.sub !== "" && <Text style={[type.small, { color: theme.muted }]}>{metric.previous.sub}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
  columns: { flexDirection: "row", gap: space.m },
  column: { flex: 1, gap: 2 },
  metric: { gap: space.xs, paddingBottom: space.m },
  label: { fontWeight: "600" },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
});
