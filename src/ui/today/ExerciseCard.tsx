import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { type ExerciseEntry, deleteExercise } from "@/data/exercise";
import { exerciseDay, exerciseEnergy } from "@/domain/day-summary";
import type { LocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { Icon } from "../icons";
import { Button, Card, KindLabel } from "../kit";
import { type Theme, space, type } from "../theme";
import { EXERCISE_ICONS } from "./exercise-icons";
import { routes } from "./routes";
import { exerciseDayText, exerciseRowTexts } from "./texts";

/**
 * The day's exercise: what, how long, how hard, and its energy: the user's own number, or an
 * estimate from their latest weight marked as one. Long press an entry to delete it.
 */
export function ExerciseCard({
  theme,
  entries,
  latestWeightG,
  date,
}: {
  theme: Theme;
  entries: readonly ExerciseEntry[];
  latestWeightG: number | undefined;
  date: LocalDate;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const summary = exerciseDayText(i18n, exerciseDay(entries, latestWeightG));

  const confirmDelete = (entry: ExerciseEntry, title: string) =>
    Alert.alert(t.daily.deleteExercise, title, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () => {
          deleteExercise(entry.id).catch((e: unknown) =>
            Alert.alert(t.common.didNotWork, e instanceof Error ? e.message : t.common.tryAgain),
          );
        },
      },
    ]);

  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.head}>
        <KindLabel theme={theme} kind="exercise" icon="run">
          {t.daily.exercise}
        </KindLabel>
        {summary !== undefined && <Text style={[type.small, styles.summary, { color: theme.muted }]}>{summary}</Text>}
      </View>
      {entries.length === 0 ? (
        <Text style={[type.small, { color: theme.muted }]}>{t.daily.exerciseEmpty}</Text>
      ) : (
        <View>
          {entries.map((entry, i) => {
            const texts = exerciseRowTexts(i18n, entry, exerciseEnergy(entry, latestWeightG));
            return (
              <Pressable
                key={entry.id}
                onLongPress={() => confirmDelete(entry, texts.title)}
                accessibilityLabel={`${texts.title}, ${texts.detail}`}
                accessibilityHint={t.daily.deleteHint}
                accessibilityActions={[{ name: "delete", label: t.common.delete }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "delete") confirmDelete(entry, texts.title);
                }}
                style={({ pressed }) => [
                  styles.row,
                  i < entries.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: theme.kinds.exercise.soft }]}>
                  <Icon name={EXERCISE_ICONS[entry.kind]} color={theme.kinds.exercise.ink} size={20} />
                </View>
                <View style={styles.text}>
                  <Text style={[type.bodyStrong, { color: theme.text }]}>{texts.title}</Text>
                  <Text style={[type.small, { color: theme.muted }]}>{texts.detail}</Text>
                  {entry.note !== null && (
                    <Text style={[type.small, { color: theme.muted }]} numberOfLines={2}>
                      {entry.note}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.daily.longPressHint}</Text>
        </View>
      )}
      <Button
        theme={theme}
        kind="quiet"
        tint={theme.kinds.exercise}
        icon="plus"
        label={t.daily.addExercise}
        onPress={() => router.push(routes.logExercise(date))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.m },
  summary: { fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.m },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  hint: { paddingTop: space.xs },
});
