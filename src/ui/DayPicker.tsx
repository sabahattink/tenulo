import { Pressable, StyleSheet, Text, View } from "react-native";
import { type LocalDate, addDays, diffDays } from "@/domain/date";
import { relativeDay } from "./copy";
import { type Theme, space } from "./theme";

/** Steps one day at a time between `maxDaysBack` days ago and `maxDaysAhead` days ahead (default: today). */
export function DayPicker({
  theme,
  value,
  today,
  onChange,
  maxDaysBack = 60,
  maxDaysAhead = 0,
}: {
  theme: Theme;
  value: LocalDate;
  today: LocalDate;
  onChange: (d: LocalDate) => void;
  maxDaysBack?: number;
  maxDaysAhead?: number;
}) {
  const back = diffDays(value, today);
  return (
    <View style={styles.row}>
      <Step theme={theme} label="‹" a11y="Previous day" disabled={back >= maxDaysBack} onPress={() => onChange(addDays(value, -1))} />
      <Text style={[styles.text, { color: theme.text }]} accessibilityLiveRegion="polite">
        {relativeDay(value, today)}
      </Text>
      <Step theme={theme} label="›" a11y="Next day" disabled={back <= -maxDaysAhead} onPress={() => onChange(addDays(value, 1))} />
    </View>
  );
}

function Step(p: { theme: Theme; label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.a11y}
      accessibilityState={{ disabled: p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      style={[styles.step, { borderColor: p.theme.border, opacity: p.disabled ? 0.3 : 1 }]}
    >
      <Text style={[styles.stepText, { color: p.theme.text }]}>{p.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.l },
  text: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
  step: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 24, lineHeight: 28 },
});
