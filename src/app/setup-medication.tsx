import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMedication } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { parseDoseInput } from "@/domain/parse";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const INTERVALS = [7, 14, 1] as const;
const INTERVAL_LABELS: Record<(typeof INTERVALS)[number], string> = { 7: "Weekly", 14: "Every 2 weeks", 1: "Daily" };

export default function SetupMedication() {
  const theme = useTheme();
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const [name, setName] = useState("");
  const [doseText, setDoseText] = useState("");
  const [interval, setIntervalDays] = useState<(typeof INTERVALS)[number]>(7);
  const [startDate, setStartDate] = useState(now);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const dose = parseDoseInput(doseText);
  const nameOk = name.trim().length >= 1 && name.trim().length <= 60;
  const doseMessage =
    !dose.ok && dose.reason === "not-a-number" ? "Enter the dose in mg, like 0.25 or 2.5"
    : !dose.ok && dose.reason === "out-of-range" ? "That dose is outside what Tenulo can record"
    : undefined;

  const save = async () => {
    if (!nameOk || !dose.ok || saving) return;
    setSaving(true);
    try {
      await createMedication({ name, doseMcg: dose.mcg, intervalDays: interval, startDate });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: theme.muted }]}>
        Enter your medication the way your prescription describes it. Tenulo only records what you enter; it never
        suggests doses.
      </Text>

      <Label theme={theme}>Medication name</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder="As written on your pen or prescription"
        placeholderTextColor={theme.muted}
        accessibilityLabel="Medication name"
        style={input}
      />

      <Label theme={theme}>Current dose (mg)</Label>
      <TextInput
        value={doseText}
        onChangeText={setDoseText}
        keyboardType="decimal-pad"
        maxLength={6}
        placeholder="e.g. 0.25"
        placeholderTextColor={theme.muted}
        accessibilityLabel="Current dose in milligrams"
        style={input}
      />
      <Text style={[styles.message, { color: theme.danger }]}>{doseMessage ?? error ?? " "}</Text>

      <Label theme={theme}>How often</Label>
      <View style={styles.segment}>
        <Segmented
          theme={theme}
          label="How often"
          options={INTERVALS.map((i) => ({ value: i, label: INTERVAL_LABELS[i] }))}
          value={interval}
          onChange={setIntervalDays}
        />
      </View>

      <Label theme={theme}>On this dose since</Label>
      <DayPicker theme={theme} value={startDate} today={now} onChange={setStartDate} maxDaysBack={365} />

      <View style={styles.save}>
        <Button theme={theme} label={saving ? "Saving…" : "Save"} onPress={() => void save()} disabled={!nameOk || !dose.ok || saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.s },
  intro: { fontSize: 15, lineHeight: 21, marginBottom: space.m },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 18, marginBottom: space.m },
  message: { fontSize: 14, minHeight: 20 },
  segment: { marginBottom: space.l },
  save: { marginTop: space.xl },
});
