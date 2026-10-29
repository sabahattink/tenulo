import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMinuteOfDay, stepMinute } from "@/domain/reminder";
import { type Theme, radius, space } from "./theme";

const STEP_MINUTES = 15;

/** A time of day in 15-minute steps, wrapping around midnight. */
export function TimeStepper({
  theme,
  minute,
  onChange,
  label,
  disabled = false,
}: {
  theme: Theme;
  minute: number;
  onChange: (minute: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const time = formatMinuteOfDay(minute);
  return (
    <View
      style={[styles.row, { opacity: disabled ? 0.45 : 1 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: time }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        onChange(stepMinute(minute, e.nativeEvent.actionName === "increment" ? STEP_MINUTES : -STEP_MINUTES));
      }}
    >
      <Step theme={theme} glyph="−" disabled={disabled} onPress={() => onChange(stepMinute(minute, -STEP_MINUTES))} />
      <Text style={[styles.time, { color: theme.text }]}>{time}</Text>
      <Step theme={theme} glyph="+" disabled={disabled} onPress={() => onChange(stepMinute(minute, STEP_MINUTES))} />
    </View>
  );
}

function Step({ theme, glyph, disabled, onPress }: { theme: Theme; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      importantForAccessibility="no"
      hitSlop={6}
      style={({ pressed }) => [styles.step, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.glyph, { color: theme.text }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, paddingBottom: space.m },
  time: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 72, textAlign: "center" },
  step: { width: 44, height: 44, borderRadius: radius.m, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 22, fontWeight: "600", lineHeight: 26 },
});
