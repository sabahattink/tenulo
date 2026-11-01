import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { type SideEffectType, injectionBefore, logSideEffect, useActiveMedication } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { SEVERITIES, SIDE_EFFECT_TYPES } from "@/domain/side-effect";
import { DayPicker } from "@/ui/DayPicker";
import { SEVERITY_LABELS, SIDE_EFFECT_LABELS } from "@/ui/copy";
import { Button, Chip, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

export default function LogSideEffect() {
  const theme = useTheme();
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const medication = useActiveMedication();
  const [type, setType] = useState<SideEffectType | undefined>();
  const [severity, setSeverity] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState(now);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    if (type === undefined || saving) return;
    setSaving(true);
    try {
      const injectionId = medication ? await injectionBefore(medication.id, date) : null;
      await logSideEffect({ type, severity, date, injectionId, note });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Label theme={theme}>What did you notice?</Label>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {SIDE_EFFECT_TYPES.map((t) => (
          <Chip key={t} theme={theme} label={SIDE_EFFECT_LABELS[t]} selected={t === type} onPress={() => setType(t)} />
        ))}
      </View>

      <Label theme={theme}>How strong, for you?</Label>
      <View style={styles.segment}>
        <Segmented
          theme={theme}
          label="How strong"
          options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
          value={severity}
          onChange={setSeverity}
        />
      </View>

      <Label theme={theme}>Day</Label>
      <DayPicker theme={theme} value={date} today={now} onChange={setDate} />

      <Label theme={theme}>Note (optional)</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder="e.g. after a large meal"
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      <Text style={[styles.safety, { color: theme.muted }]}>
        If a symptom is severe or worrying, contact your doctor or local emergency services. Tenulo only keeps a record.
      </Text>

      <Button theme={theme} label={saving ? "Saving…" : "Save"} onPress={() => void save()} disabled={type === undefined || saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.s },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.l },
  segment: { marginBottom: space.l },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 16 },
  safety: { fontSize: 13, lineHeight: 18, marginVertical: space.l },
});
