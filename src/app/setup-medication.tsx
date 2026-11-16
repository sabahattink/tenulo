import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMedication } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { parseDoseInput } from "@/domain/parse";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const INTERVALS = [7, 14, 1] as const;

export default function SetupMedication() {
  const theme = useTheme();
  const { t, f } = useI18n();
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
    !dose.ok && dose.reason === "not-a-number" ? t.setupMedication.doseNotANumber(f.doseNumber(250), f.doseNumber(2500))
    : !dose.ok && dose.reason === "out-of-range" ? t.setupMedication.doseOutOfRange
    : undefined;

  const save = async () => {
    if (!nameOk || !dose.ok || saving) return;
    setSaving(true);
    try {
      await createMedication({ name, doseMcg: dose.mcg, intervalDays: interval, startDate });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: theme.muted }]}>{t.setupMedication.intro}</Text>

      <Label theme={theme}>{t.common.medicationName}</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder={t.setupMedication.namePlaceholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={t.common.medicationName}
        style={input}
      />

      <Label theme={theme}>{t.setupMedication.currentDose}</Label>
      <TextInput
        value={doseText}
        onChangeText={setDoseText}
        keyboardType="decimal-pad"
        maxLength={6}
        placeholder={t.setupMedication.dosePlaceholder(f.doseNumber(250))}
        placeholderTextColor={theme.muted}
        accessibilityLabel={t.setupMedication.currentDoseLabel}
        style={input}
      />
      <Text style={[styles.message, { color: theme.danger }]}>{doseMessage ?? error ?? " "}</Text>

      <Label theme={theme}>{t.setupMedication.howOften}</Label>
      <View style={styles.segment}>
        <Segmented
          theme={theme}
          label={t.setupMedication.howOften}
          options={INTERVALS.map((i) => ({ value: i, label: t.setupMedication.intervals[i] }))}
          value={interval}
          onChange={setIntervalDays}
        />
      </View>

      <Label theme={theme}>{t.setupMedication.since}</Label>
      <DayPicker theme={theme} value={startDate} today={now} onChange={setStartDate} maxDaysBack={365} />

      <View style={styles.save}>
        <Button theme={theme} label={saving ? t.common.saving : t.common.save} onPress={() => void save()} disabled={!nameOk || !dose.ok || saving} />
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
