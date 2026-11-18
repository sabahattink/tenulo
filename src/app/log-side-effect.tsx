import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { type SideEffectType, injectionBefore, logSideEffect, useActiveMedication } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { SEVERITIES, SIDE_EFFECT_TYPES } from "@/domain/side-effect";
import { useI18n } from "@/i18n/provider";
import { MedicationOnly } from "@/ui/MedicationOnly";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Chip, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

function LogSideEffectBody() {
  const theme = useTheme();
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Label theme={theme}>{t.logSideEffect.what}</Label>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {SIDE_EFFECT_TYPES.map((kind) => (
          <Chip key={kind} theme={theme} label={t.sideEffects[kind]} selected={kind === type} onPress={() => setType(kind)} />
        ))}
      </View>

      <Label theme={theme}>{t.logSideEffect.howStrong}</Label>
      <View style={styles.segment}>
        <Segmented
          theme={theme}
          label={t.logSideEffect.howStrongLabel}
          options={SEVERITIES.map((s) => ({ value: s, label: t.severity[s] }))}
          value={severity}
          onChange={setSeverity}
        />
      </View>

      <Label theme={theme}>{t.common.day}</Label>
      <DayPicker theme={theme} value={date} today={now} onChange={setDate} />

      <Label theme={theme}>{t.common.noteOptional}</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder={t.logSideEffect.notePlaceholder}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      <Text style={[styles.safety, { color: theme.muted }]}>{t.logSideEffect.safety}</Text>

      <Button theme={theme} label={saving ? t.common.saving : t.common.save} onPress={() => void save()} disabled={type === undefined || saving} />
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

export default function LogSideEffect() {
  return (
    <MedicationOnly>
      <LogSideEffectBody />
    </MedicationOnly>
  );
}
