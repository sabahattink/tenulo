import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LocalDate } from "@/domain/date";
import type { LengthUnit, SiteSummary } from "@/domain/measurement";
import { useI18n } from "@/i18n/provider";
import { Illustration } from "../Illustration";
import { Button, Card, raisedSurface } from "../kit";
import { type Theme, radius, space, type } from "../theme";
import { Sparkline } from "./Sparkline";
import { formatLength, formatLengthChange } from "./length";

/** Two cards to a row; an odd last card keeps its half width. */
function pairs<T>(items: readonly T[]): (readonly [T, T | undefined])[] {
  const out: (readonly [T, T | undefined])[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const first = items[i];
    if (first !== undefined) out.push([first, items[i + 1]]);
  }
  return out;
}

/** One card per measured site, or a calm empty state; both end with "Add measurements". */
export function Measurements({
  theme,
  summaries,
  unit,
  today,
}: {
  theme: Theme;
  summaries: readonly SiteSummary[];
  unit: LengthUnit;
  today: LocalDate;
}) {
  const { t } = useI18n();
  const add = () => router.push({ pathname: "/add-measurement", params: { date: today } });
  if (summaries.length === 0) {
    return (
      <Card theme={theme} style={styles.empty}>
        <Illustration name="measure" theme={theme} size={150} />
        <Text style={[type.body, styles.emptyText, { color: theme.muted }]}>{t.progress.measurementsEmpty}</Text>
        <View style={styles.stretch}>
          <Button theme={theme} kind="quiet" tint={theme.kinds.measurement} icon="plus" label={t.progress.addMeasurements} onPress={add} />
        </View>
      </Card>
    );
  }
  return (
    <View style={styles.list}>
      {pairs(summaries).map(([left, right]) => (
        <View key={left.site} style={styles.row}>
          <SiteCard theme={theme} summary={left} unit={unit} today={today} />
          {right === undefined ? <View style={styles.cell} /> : <SiteCard theme={theme} summary={right} unit={unit} today={today} />}
        </View>
      ))}
      <Button theme={theme} kind="quiet" tint={theme.kinds.measurement} icon="plus" label={t.progress.addMeasurements} onPress={add} />
    </View>
  );
}

function SiteCard({ theme, summary, unit, today }: { theme: Theme; summary: SiteSummary; unit: LengthUnit; today: LocalDate }) {
  const { t, f } = useI18n();
  const name = t.measure.sites[summary.site];
  const value = formatLength(f, summary.latestMm, unit);
  const change =
    summary.changeMm === undefined ? t.progress.firstReading : t.progress.sinceFirst(formatLengthChange(f, summary.changeMm, unit));
  const measured = t.progress.measured(f.relativeDayInline(summary.latestDate, today));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${value}, ${change}, ${measured}`}
      accessibilityHint={t.progress.openReadings}
      onPress={() => router.push({ pathname: "/measurements", params: { site: summary.site } })}
      style={({ pressed }) => [styles.cell, styles.card, raisedSurface(theme), { opacity: pressed ? 0.8 : 1 }, pressed && styles.pressed]}
    >
      <Text style={[type.caption, { color: theme.kinds.measurement.ink }]} numberOfLines={1}>
        {f.upper(name)}
      </Text>
      <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[type.small, styles.tabular, { color: theme.muted }]} numberOfLines={2}>
        {change}
      </Text>
      <Sparkline points={summary.points.map((p) => ({ date: p.date, value: p.lengthMm }))} theme={theme} color={theme.kinds.measurement.ink} />
      <Text style={[type.small, { color: theme.muted }]} numberOfLines={1}>
        {measured}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s },
  row: { flexDirection: "row", gap: space.s },
  cell: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.xs, minHeight: 48 },
  pressed: { transform: [{ scale: 0.98 }] },
  value: { fontSize: 22, lineHeight: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tabular: { fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: space.m, padding: space.xl },
  emptyText: { textAlign: "center" },
  stretch: { alignSelf: "stretch" },
});
