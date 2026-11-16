import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMeasurements } from "@/data/body";
import { useExerciseRange } from "@/data/exercise";
import { useFoodDays } from "@/data/progress";
import { useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { useWaterTotals } from "@/data/water";
import { parseLocalDate } from "@/domain/date";
import { lengthUnitFor, siteSummaries } from "@/domain/measurement";
import { summarizeWeights } from "@/domain/summary";
import { weekWindows, weeklyComparison } from "@/domain/weekly";
import { useI18n } from "@/i18n/provider";
import { Label, ScreenTitle } from "@/ui/kit";
import { Measurements } from "@/ui/progress/Measurements";
import { WeekCard } from "@/ui/progress/WeekCard";
import { WeightCard } from "@/ui/progress/WeightCard";
import { space, useTheme } from "@/ui/theme";

/** Where things are heading: the weight trend, tape measurements, and this week next to the last. */
export default function Progress() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const now = useToday();
  const settings = useSettings();
  const unit = settings?.weightUnit ?? "kg";
  const goalG = settings?.goalWeightG ?? null;

  const entries = useWeightEntries();
  const summary = useMemo(
    () => summarizeWeights(entries.map((e) => ({ date: parseLocalDate(e.localDate), weightG: e.weightG })), goalG, now),
    [entries, goalG, now],
  );

  const readings = useMeasurements();
  const sites = useMemo(
    () =>
      siteSummaries(
        readings.map((r) => ({ site: r.site, date: parseLocalDate(r.localDate), measuredAt: r.measuredAt, lengthMm: r.lengthMm })),
      ),
    [readings],
  );

  const { current, previous } = weekWindows(now);
  const food = useFoodDays(previous.from, current.to);
  const water = useWaterTotals(previous.from, current.to);
  const exercise = useExerciseRange(previous.from, current.to);
  const week = useMemo(
    () =>
      weeklyComparison({
        today: now,
        food: food.map((d) => ({ date: parseLocalDate(d.localDate), energyKcal: d.energyKcal, proteinMg: d.proteinMg })),
        water: water.map((d) => ({ date: parseLocalDate(d.localDate), amountMl: d.amountMl })),
        exercise: exercise.map((x) => ({ date: parseLocalDate(x.localDate), durationMin: x.durationMin })),
      }),
    [now, food, water, exercise],
  );

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}>
      <ScreenTitle theme={theme} title={t.progress.title} />
      <View style={styles.section}>
        <View style={styles.label}>
          <Label theme={theme}>{t.progress.weight}</Label>
        </View>
        <WeightCard theme={theme} summary={summary} goalG={goalG} unit={unit} today={now} />
      </View>
      <View style={styles.section}>
        <View style={styles.label}>
          <Label theme={theme}>{t.progress.measurements}</Label>
        </View>
        <Measurements theme={theme} summaries={sites} unit={lengthUnitFor(unit)} today={now} />
      </View>
      <View style={styles.section}>
        <View style={styles.label}>
          <Label theme={theme}>{t.progress.week.title}</Label>
        </View>
        <WeekCard theme={theme} week={week} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.xl, paddingBottom: space.xxl },
  section: { gap: space.s },
  label: { paddingHorizontal: space.xs },
});
