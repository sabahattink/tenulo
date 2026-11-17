import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, type ListRenderItem, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMeasurements } from "@/data/body";
import { deleteExercise } from "@/data/exercise";
import { deleteMeasurements, deleteWaterEntries, useExerciseLog, useFoodLog, useWaterLog } from "@/data/history";
import { deleteInjection, deleteSideEffect, useAllInjections, useSideEffects } from "@/data/injections";
import { deleteWeight, useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { parseLocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { Illustration } from "@/ui/Illustration";
import { Icon } from "@/ui/icons";
import { Chip, ScreenTitle, raisedSurface } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";
import { TIMELINE_FILTERS, type TimelineFilter, type TimelineKind, timeline } from "@/ui/timeline";
import { TimelineRow } from "@/ui/timeline-row";
import {
  type TimelineRow as Row,
  exerciseRows,
  foodRows,
  injectionRows,
  measurementRows,
  sideEffectRows,
  waterRows,
  weightRows,
} from "@/ui/timeline-rows";

/** One calendar month of the timeline, drawn as one card. */
interface MonthSection {
  /** "YYYY-MM" */
  readonly month: string;
  readonly rows: readonly Row[];
}

/** Deletes the records behind one line. Meals are not deleted here: the food diary keeps them. */
async function removeRecords(kind: TimelineKind, ids: readonly string[]): Promise<void> {
  switch (kind) {
    case "weight":
      await Promise.all(ids.map(deleteWeight));
      return;
    case "injection":
      await Promise.all(ids.map(deleteInjection));
      return;
    case "side-effect":
      await Promise.all(ids.map(deleteSideEffect));
      return;
    case "exercise":
      await Promise.all(ids.map(deleteExercise));
      return;
    case "water":
      await deleteWaterEntries(ids);
      return;
    case "measurement":
      await deleteMeasurements(ids);
      return;
    case "food":
      return;
  }
}

export default function History() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
  const insets = useSafeAreaInsets();
  const now = useToday();
  const unit = useSettings()?.weightUnit ?? "kg";
  const weights = useWeightEntries();
  const injections = useAllInjections();
  const sideEffects = useSideEffects();
  const food = useFoodLog();
  const water = useWaterLog();
  const measurements = useMeasurements();
  const exercise = useExerciseLog();
  const [filter, setFilter] = useState<TimelineFilter>("all");

  // One memo per kind: logging a glass of water rebuilds the water lines, not years of meals.
  const weightLines = useMemo(() => weightRows(weights, unit, i18n), [weights, unit, i18n]);
  const injectionLines = useMemo(() => injectionRows(injections, i18n), [injections, i18n]);
  const sideEffectLines = useMemo(() => sideEffectRows(sideEffects, i18n), [sideEffects, i18n]);
  const foodLines = useMemo(() => foodRows(food, i18n), [food, i18n]);
  const waterLines = useMemo(() => waterRows(water, i18n), [water, i18n]);
  const measurementLines = useMemo(() => measurementRows(measurements, unit, i18n), [measurements, unit, i18n]);
  const exerciseLines = useMemo(() => exerciseRows(exercise, weights, i18n), [exercise, weights, i18n]);

  const sections = useMemo(() => {
    const rows = [
      ...weightLines,
      ...injectionLines,
      ...sideEffectLines,
      ...foodLines,
      ...waterLines,
      ...measurementLines,
      ...exerciseLines,
    ];
    return timeline(rows, filter).map((s): MonthSection => ({ month: s.month, rows: s.items }));
  }, [weightLines, injectionLines, sideEffectLines, foodLines, waterLines, measurementLines, exerciseLines, filter]);

  const confirmDelete = useCallback(
    (row: Row) => {
      const remove = row.remove;
      if (remove === undefined) return;
      Alert.alert(remove.question, `${row.title} · ${f.relativeDay(row.date, now)}`, [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.delete,
          style: "destructive",
          onPress: () =>
            void removeRecords(row.kind, remove.ids).catch((e: unknown) =>
              Alert.alert(t.common.didNotWork, e instanceof Error ? e.message : t.common.somethingWentWrong),
            ),
        },
      ]);
    },
    [t, f, now],
  );

  const open = useCallback((row: Row) => {
    if (row.open === undefined) return;
    // The Food tab and the water screen take the day to show.
    router.push({ pathname: row.open.screen === "food" ? "/food" : "/water", params: { date: row.open.date } });
  }, []);

  const renderMonth = useCallback<ListRenderItem<MonthSection>>(
    ({ item: section }) => (
      <View style={styles.section}>
        <Text style={[type.caption, styles.month, { color: theme.muted }]}>
          {f.upper(f.monthTitle(parseLocalDate(`${section.month}-01`)))}
        </Text>
        <View style={[styles.group, raisedSurface(theme)]}>
          {section.rows.map((row, i) => (
            <TimelineRow
              key={`${row.kind}-${row.id}`}
              theme={theme}
              row={row}
              now={now}
              last={i === section.rows.length - 1}
              onOpen={open}
              onDelete={confirmDelete}
            />
          ))}
        </View>
      </View>
    ),
    [theme, f, now, open, confirmDelete],
  );

  // A virtualized list of months: years of daily weigh-ins and meals would otherwise mount every row
  // at once. Each month is drawn whole, as one card. Splitting a card's border across row cells left
  // a one-pixel gap between rows on fractional pixel densities (1 dp = 2.625 px). A month of meals,
  // water and weigh-ins fills several screens, so one month is enough to start with.
  return (
    <FlatList<MonthSection>
      data={sections}
      keyExtractor={(section) => section.month}
      initialNumToRender={1}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle theme={theme} title={t.history.title} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
            {TIMELINE_FILTERS.map((value) => (
              <Chip key={value} theme={theme} label={t.history.filters[value]} selected={filter === value} onPress={() => setFilter(value)} />
            ))}
          </ScrollView>
        </View>
      }
      renderItem={renderMonth}
      ListEmptyComponent={
        <View style={styles.empty}>
          {filter === "all" ? (
            <>
              <Illustration name="journal" theme={theme} size={220} />
              <Text style={[type.heading, { color: theme.text }]}>{t.history.emptyTitle}</Text>
              <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>{t.history.emptyBody}</Text>
            </>
          ) : (
            <>
              <Icon name="calendar" color={theme.muted} size={32} />
              <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>{t.history.emptyFiltered}</Text>
            </>
          )}
        </View>
      }
      ListFooterComponent={
        sections.length > 0 ? (
          <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.history.longPressHint}</Text>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, paddingBottom: space.xxl },
  header: { gap: space.l },
  filters: { gap: space.s, paddingRight: space.l },
  empty: { alignItems: "center", gap: space.m, paddingVertical: space.xxl, paddingHorizontal: space.xl, marginTop: space.l },
  section: { gap: space.s, paddingTop: space.l },
  month: { paddingHorizontal: space.xs },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  hint: { textAlign: "center", paddingTop: space.l },
});
