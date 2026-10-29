import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { addWeight, useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type ParseWeightResult, parseWeightInput } from "@/domain/parse";
import { weightNumber } from "@/domain/weight";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Label } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";

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
  const now = useToday();

  const last = entries[0];
  const [text, setText] = useState("");
  const [date, setDate] = useState(now);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();

  const parsed = parseWeightInput(text, unit);
  const message = errorText(parsed, unit);

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
        <View
          style={[
            styles.inputRow,
            { borderColor: message ? theme.danger : theme.accent, backgroundColor: theme.card },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void save()}
            keyboardType="decimal-pad"
            autoFocus
            maxLength={6}
            placeholder={last ? weightNumber(last.weightG, unit) : unit === "kg" ? "82.4" : "181.6"}
            placeholderTextColor={theme.reading}
            accessibilityLabel={`Weight in ${unit}`}
            style={[styles.input, { color: theme.text }]}
          />
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
        <Text style={[type.small, styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {message ?? saveError ?? " "}
        </Text>

        <Label theme={theme}>Day</Label>
        <DayPicker theme={theme} value={date} today={now} onChange={setDate} maxDaysBack={MAX_DAYS_BACK} />

        <View style={styles.save}>
          <Button theme={theme} label={saving ? "Saving…" : "Save"} onPress={() => void save()} disabled={!parsed.ok || saving} />
        </View>
        <Text style={[type.small, styles.hint, { color: theme.muted }]}>
          Weigh at the same time each day, ideally after waking. One reading a day is plenty.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: space.xl, gap: space.s },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderWidth: 2,
    borderRadius: radius.l,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
  },
  input: { flex: 1, fontSize: 52, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  unit: { fontSize: 22, fontWeight: "600" },
  message: { minHeight: 20, marginBottom: space.m },
  save: { marginTop: space.xl },
  hint: { textAlign: "center", marginTop: space.s },
});
