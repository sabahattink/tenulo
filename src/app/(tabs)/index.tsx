import { useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExerciseDay } from "@/data/exercise";
import { useFoodDay } from "@/data/food";
import { useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { useWaterDay } from "@/data/water";
import { dayRings, isFirstRun } from "@/domain/day-summary";
import { parseLocalDate } from "@/domain/date";
import { WATER_SERVING_ML } from "@/domain/goals";
import { summarizeWeights } from "@/domain/summary";
import { useI18n } from "@/i18n/provider";
import { InjectionCard } from "@/ui/InjectionCard";
import { ScreenTitle } from "@/ui/kit";
import { space, type, useTheme } from "@/ui/theme";
import { DayCard } from "@/ui/today/DayCard";
import { ExerciseCard } from "@/ui/today/ExerciseCard";
import { FirstRunCard } from "@/ui/today/FirstRunCard";
import { QuickActions } from "@/ui/today/QuickActions";
import { EmptyWeight, WeightCard } from "@/ui/today/WeightCard";
import { useWaterActions } from "@/ui/today/use-water-actions";

/**
 * The whole day at a glance, and every log one tap away: the day's rings, quick actions, the
 * weight trend in brief, the injection schedule and the day's exercise.
 */
export default function Today() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const weights = useWeightEntries();
  const now = useToday();
  const food = useFoodDay(now);
  const water = useWaterDay(now);
  const exercise = useExerciseDay(now);
  const unit = settings?.weightUnit ?? "kg";
  const goalG = settings?.goalWeightG ?? null;
  const servingMl = settings?.waterServingMl ?? WATER_SERVING_ML.default;

  const summary = useMemo(
    () =>
      summarizeWeights(
        weights.map((e) => ({ date: parseLocalDate(e.localDate), weightG: e.weightG })),
        goalG,
        now,
      ),
    [weights, goalG, now],
  );

  const rings = useMemo(
    () =>
      dayRings(food, water, {
        energyKcal: settings?.energyGoalKcal ?? null,
        proteinG: settings?.proteinGoalG ?? null,
        waterMl: settings?.waterGoalMl ?? null,
      }),
    [food, water, settings?.energyGoalKcal, settings?.proteinGoalG, settings?.waterGoalMl],
  );

  const waterActions = useWaterActions(now, rings.water.value);
  const firstRun = isFirstRun({
    weighIns: weights.length,
    foodToday: food.length,
    waterToday: water.length,
    exerciseToday: exercise.length,
  });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
    >
      <ScreenTitle theme={theme} eyebrow={f.longWeekday(now)} title={t.today.title} />
      <DayCard
        theme={theme}
        rings={rings}
        date={now}
        servingMl={servingMl}
        canUndo={water.length > 0}
        goalsKnown={settings !== undefined}
        water={waterActions}
      />
      <QuickActions theme={theme} date={now} servingMl={servingMl} water={waterActions} />
      {summary !== undefined ? (
        <WeightCard theme={theme} summary={summary} unit={unit} goalG={goalG} now={now} />
      ) : firstRun ? (
        <FirstRunCard theme={theme} date={now} />
      ) : (
        <EmptyWeight theme={theme} />
      )}
      <InjectionCard theme={theme} today={now} />
      {!firstRun && <ExerciseCard theme={theme} entries={exercise} latestWeightG={weights[0]?.weightG} date={now} />}
      <Text style={[type.small, styles.footnote, { color: theme.muted }]}>{t.today.footnote}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.l, paddingBottom: space.xxl },
  footnote: { textAlign: "center", paddingHorizontal: space.l },
});
