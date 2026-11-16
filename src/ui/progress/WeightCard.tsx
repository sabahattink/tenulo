import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import type { LocalDate } from "@/domain/date";
import type { WeightSummary } from "@/domain/summary";
import type { WeightUnit } from "@/domain/weight";
import { useI18n } from "@/i18n/provider";
import { TrendChart } from "../TrendChart";
import { Button, Card } from "../kit";
import { type Theme, space, type } from "../theme";

/**
 * The weight trend in full: the chart with its ranges and the goal line, and the one calm sentence
 * about where the trend is heading. Until there are two weigh-ins there is no line to draw.
 */
export function WeightCard({
  theme,
  summary,
  goalG,
  unit,
  today,
}: {
  theme: Theme;
  summary: WeightSummary | undefined;
  goalG: number | null;
  unit: WeightUnit;
  today: LocalDate;
}) {
  const { t, f } = useI18n();
  if (summary === undefined || summary.trend.length < 2) {
    return (
      <Card theme={theme} style={styles.card}>
        <Text style={[type.body, { color: theme.muted }]}>
          {summary === undefined ? t.progress.weightEmpty : f.forecast(summary.forecast, unit, today)}
        </Text>
        <Button theme={theme} kind="quiet" icon="plus" label={t.progress.logWeight} onPress={() => router.push("/add-weight")} />
      </Card>
    );
  }
  return (
    <Card theme={theme} style={styles.card}>
      <TrendChart trend={summary.trend} goalG={goalG} unit={unit} theme={theme} today={today} />
      <Text style={[type.body, { color: theme.text }]}>{f.forecast(summary.forecast, unit, today)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
});
