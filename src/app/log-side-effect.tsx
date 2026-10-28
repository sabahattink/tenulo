import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { type SideEffectType, injectionBefore, logSideEffect, useActiveMedication } from "@/data/injections";
import { today } from "@/data/repo";
import { SEVERITIES, SIDE_EFFECT_TYPES } from "@/domain/side-effect";
import { DayPicker } from "@/ui/DayPicker";
import { SEVERITY_LABELS, SIDE_EFFECT_LABELS } from "@/ui/copy";
import { Button, Label } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

export default function LogSideEffect() {
  const theme = useTheme();
  const now = today();
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
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Label theme={theme}>What did you notice?</Label>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {SIDE_EFFECT_TYPES.map((t) => {
          const selected = t === type;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setType(t)}
              style={[styles.chip, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : theme.card }]}
            >
              <Text style={[styles.chipText, { color: selected ? theme.accentText : theme.text }]}>{SIDE_EFFECT_LABELS[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label theme={theme}>How strong, for you?</Label>
      <View style={[styles.segment, { borderColor: theme.border }]} accessibilityRole="radiogroup">
        {SEVERITIES.map((s) => {
          const selected = s === severity;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setSeverity(s)}
              style={[styles.segmentItem, selected && { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.segmentText, { color: selected ? theme.accentText : theme.text }]}>{SEVERITY_LABELS[s]}</Text>
            </Pressable>
          );
        })}
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
  content: { padding: space.xl, gap: space.s, paddingBottom: space.xxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.l },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: space.l, minHeight: 44, justifyContent: "center" },
  chipText: { fontSize: 15, fontWeight: "600" },
  segment: { flexDirection: "row", borderWidth: 1.5, borderRadius: radius.m, overflow: "hidden", marginBottom: space.l },
  segmentItem: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 16 },
  safety: { fontSize: 13, lineHeight: 18, marginVertical: space.l },
});
