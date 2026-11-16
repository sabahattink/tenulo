import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type WaterEntry, useWaterDay } from "@/data/water";
import { goalFraction } from "@/domain/goals";
import { MAX_WATER_ENTRY_ML, isWaterAmount, totalMl } from "@/domain/water";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Illustration } from "@/ui/Illustration";
import { ProgressRing } from "@/ui/ProgressRing";
import { Icon } from "@/ui/icons";
import { Button, Card, Label, useScrollEndPadding } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";
import { WATER_CHIPS_ML, formatLitres, loggedMinuteOn, parseWaterMl } from "@/ui/today/amounts";
import { dateFromParam } from "@/ui/today/params";
import { routes } from "@/ui/today/routes";
import { UNITS, mlText } from "@/ui/today/texts";
import { useWaterActions } from "@/ui/today/use-water-actions";

const RING = 148;
const EXAMPLE_ML = 400;

/** One day's water: its total against the user's own goal, quick amounts, a typed amount, and every entry. */
export default function Water() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
  const endPadding = useScrollEndPadding();
  const today = useToday();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(() => dateFromParam(params.date, today));
  const entries = useWaterDay(date);
  const goalMl = useSettings()?.waterGoalMl ?? null;
  const total = totalMl(entries);
  const actions = useWaterActions(date, total);
  const [text, setText] = useState("");
  const parsed = parseWaterMl(text);
  const invalid = !parsed.ok && parsed.reason !== "empty";

  const addTyped = () => {
    if (!parsed.ok || !isWaterAmount(parsed.value)) return;
    actions.add(parsed.value);
    setText("");
    Keyboard.dismiss();
  };

  const confirmDelete = (entry: WaterEntry, time: string | undefined) =>
    Alert.alert(t.waterLog.deleteTitle, [mlText(i18n, entry.amountMl), time ?? f.relativeDay(date, today)].join(" · "), [
      { text: t.common.cancel, style: "cancel" },
      { text: t.common.delete, style: "destructive", onPress: () => actions.remove(entry.id) },
    ]);

  const litres = formatLitres(total, t.number.decimalMark);
  const goalText = goalMl === null ? undefined : `${formatLitres(goalMl, t.number.decimalMark)} ${UNITS.litre}`;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}
      keyboardShouldPersistTaps="handled"
    >
      <DayPicker theme={theme} value={date} today={today} onChange={setDate} />

      <Card theme={theme} style={styles.summary}>
        <View
          accessible
          accessibilityLabel={
            goalText === undefined
              ? `${t.daily.water}: ${litres} ${UNITS.litre}`
              : t.daily.ringGoalLabel(t.daily.water, `${litres} ${UNITS.litre}`, goalText)
          }
          style={styles.summaryBody}
        >
          <ProgressRing
            size={RING}
            stroke={10}
            fraction={goalFraction(total, goalMl) ?? 0}
            color={theme.accent}
            track={theme.surfaceAlt}
          >
            <Text style={[styles.total, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {litres}
            </Text>
            <Text style={[styles.unit, { color: theme.muted }]}>{UNITS.litre}</Text>
          </ProgressRing>
          <Text style={[type.small, { color: theme.muted }]}>{goalText === undefined ? t.waterLog.noGoal : t.waterLog.goal(goalText)}</Text>
        </View>
        {goalText === undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t.daily.setGoalHint}
            onPress={() => router.push(routes.goals())}
            hitSlop={space.m}
            style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.linkText, { color: theme.accent }]}>{t.daily.setGoal}</Text>
          </Pressable>
        )}
      </Card>

      <Label theme={theme}>{t.waterLog.quickAdd}</Label>
      <View style={styles.chips}>
        {WATER_CHIPS_ML.map((ml) => (
          <Pressable
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={t.waterLog.addAmount(mlText(i18n, ml))}
            onPress={() => actions.add(ml)}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.accentSoft, backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="plus" color={theme.accent} size={16} />
            <Text style={[styles.chipText, { color: theme.accent }]}>{mlText(i18n, ml)}</Text>
          </Pressable>
        ))}
      </View>

      <Label theme={theme}>{t.waterLog.other}</Label>
      <View style={styles.customRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={addTyped}
          keyboardType="number-pad"
          maxLength={4}
          placeholder={t.waterLog.placeholder(String(EXAMPLE_ML))}
          placeholderTextColor={theme.muted}
          accessibilityLabel={t.waterLog.otherLabel}
          style={[
            styles.input,
            { color: theme.text, borderColor: invalid ? theme.danger : theme.border, backgroundColor: theme.card },
          ]}
        />
        <View style={styles.addButton}>
          <Button theme={theme} label={t.waterLog.add} onPress={addTyped} disabled={!parsed.ok} />
        </View>
      </View>
      <Text style={[type.small, styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
        {invalid ? t.waterLog.invalid(f.integer(MAX_WATER_ENTRY_ML)) : " "}
      </Text>

      <Label theme={theme}>{t.waterLog.entries}</Label>
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Illustration name="water" theme={theme} size={120} />
          <Text style={[type.small, { color: theme.muted, textAlign: "center" }]}>{t.waterLog.empty}</Text>
        </View>
      ) : (
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[...entries].reverse().map((entry, i) => {
            const minute = loggedMinuteOn(entry.loggedAt, date);
            const time = minute === undefined ? undefined : f.time(minute);
            const amount = mlText(i18n, entry.amountMl);
            return (
              <View
                key={entry.id}
                style={[styles.row, i < entries.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="drop" color={theme.accent} size={20} />
                </View>
                <View
                  style={styles.rowText}
                  accessible
                  accessibilityLabel={time === undefined ? amount : t.waterLog.entryLabel(amount, time)}
                >
                  <Text style={[type.bodyStrong, styles.tabular, { color: theme.text }]}>{amount}</Text>
                  {time !== undefined && <Text style={[type.small, styles.tabular, { color: theme.muted }]}>{time}</Text>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={time === undefined ? t.waterLog.deleteAmount(amount) : t.waterLog.deleteEntry(amount, time)}
                  onPress={() => confirmDelete(entry, time)}
                  hitSlop={space.xs}
                  style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="trash" color={theme.muted} size={20} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.s },
  summary: { alignItems: "center", gap: space.s, paddingVertical: space.xl, marginVertical: space.m },
  summaryBody: { alignItems: "center", gap: space.m },
  total: { fontSize: 36, lineHeight: 42, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"], paddingHorizontal: space.m },
  unit: { fontSize: 14, fontWeight: "600" },
  link: { paddingVertical: space.xs, paddingHorizontal: space.m },
  linkText: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.l },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.l,
    minHeight: 48,
  },
  chipText: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  customRow: { flexDirection: "row", gap: space.s, alignItems: "center" },
  input: { flex: 1, borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 16 },
  addButton: { minWidth: 96 },
  message: { minHeight: 20, marginBottom: space.s },
  empty: { alignItems: "center", gap: space.m, paddingVertical: space.l },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.s },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
  delete: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});
