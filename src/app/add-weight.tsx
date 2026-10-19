import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addWeight, today, useSettings, useWeightEntries } from "@/data/repo";
import { addDays, diffDays } from "@/domain/date";
import { type ParseWeightResult, parseWeightInput } from "@/domain/parse";
import { weightNumber } from "@/domain/weight";
import { relativeDay } from "@/ui/copy";
import { Button, Label } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const MAX_DAYS_BACK = 60;

function errorText(r: ParseWeightResult, unit: string): string | undefined {
  if (r.ok || r.reason === "empty") return undefined;
  if (r.reason === "not-a-number") return "Enter a number like 82.4";
  return unit === "kg" ? "That doesn't look like a body weight in kg" : "That doesn't look like a body weight in lb";
}

export default function AddWeight() {
  const theme = useTheme();
  const settings = useSettings();
  const entries = useWeightEntries();
  const unit = settings?.weightUnit ?? "kg";
  const now = today();

  const last = entries[0];
  const [text, setText] = useState("");
  const [date, setDate] = useState(now);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();

  const parsed = parseWeightInput(text, unit);
  const message = errorText(parsed, unit);
  const back = diffDays(date, now);

  const save = async () => {
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      await addWeight(parsed.grams, date);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.body}>
        <Label theme={theme}>Weight</Label>
        <View style={[styles.inputRow, { borderColor: message ? theme.danger : theme.border, backgroundColor: theme.card }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void save()}
            keyboardType="decimal-pad"
            autoFocus
            maxLength={6}
            placeholder={last ? weightNumber(last.weightG, unit) : unit === "kg" ? "82.4" : "181.6"}
            placeholderTextColor={theme.muted}
            accessibilityLabel={`Weight in ${unit}`}
            style={[styles.input, { color: theme.text }]}
          />
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
        <Text style={[styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {message ?? saveError ?? " "}
        </Text>

        <Label theme={theme}>Day</Label>
        <View style={styles.dateRow}>
          <Stepper
            label="‹"
            accessibilityLabel="Previous day"
            disabled={back >= MAX_DAYS_BACK}
            onPress={() => setDate(addDays(date, -1))}
            theme={theme}
          />
          <Text style={[styles.dateText, { color: theme.text }]}>{relativeDay(date, now)}</Text>
          <Stepper
            label="›"
            accessibilityLabel="Next day"
            disabled={back <= 0}
            onPress={() => setDate(addDays(date, 1))}
            theme={theme}
          />
        </View>

        <View style={styles.save}>
          <Button
            theme={theme}
            label={saving ? "Saving…" : "Save"}
            onPress={() => void save()}
            disabled={!parsed.ok || saving}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stepper(props: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.stepper, { borderColor: props.theme.border, opacity: props.disabled ? 0.3 : 1 }]}
    >
      <Text style={[styles.stepperText, { color: props.theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: space.xl, gap: space.s },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  input: { flex: 1, fontSize: 44, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 20 },
  message: { fontSize: 14, minHeight: 20, marginBottom: space.l },
  dateRow: { flexDirection: "row", alignItems: "center", gap: space.l },
  dateText: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
  stepper: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepperText: { fontSize: 24, lineHeight: 28 },
  save: { marginTop: space.xl },
});
