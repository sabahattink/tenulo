import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { addWeight, useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type ParseWeightResult, parseWeightInput } from "@/domain/parse";
import type { WeightUnit } from "@/domain/weight";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Label } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";

const MAX_DAYS_BACK = 60;

/** A typical reading in each unit, for the placeholder and the "not a number" hint. */
const EXAMPLE_G: Record<WeightUnit, number> = { kg: 82_400, lb: 82_373 };

function errorText(r: ParseWeightResult, unit: WeightUnit, { t, f }: I18n): string | undefined {
  if (r.ok || r.reason === "empty") return undefined;
  if (r.reason === "not-a-number") return t.addWeight.notANumber(f.weightNumber(EXAMPLE_G.kg, "kg"));
  return t.addWeight.implausible(unit);
}

export default function AddWeight() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
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
  const message = errorText(parsed, unit, i18n);

  const save = async () => {
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      await addWeight(parsed.grams, date);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.body}>
        <Label theme={theme}>{t.addWeight.weight}</Label>
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
            placeholder={f.weightNumber(last ? last.weightG : EXAMPLE_G[unit], unit)}
            placeholderTextColor={theme.reading}
            accessibilityLabel={t.addWeight.weightIn(unit)}
            style={[styles.input, { color: theme.text }]}
          />
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
        <Text style={[type.small, styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {message ?? saveError ?? " "}
        </Text>

        <Label theme={theme}>{t.common.day}</Label>
        <DayPicker theme={theme} value={date} today={now} onChange={setDate} maxDaysBack={MAX_DAYS_BACK} />

        <View style={styles.save}>
          <Button theme={theme} label={saving ? t.common.saving : t.common.save} onPress={() => void save()} disabled={!parsed.ok || saving} />
        </View>
        <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.addWeight.hint}</Text>
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
