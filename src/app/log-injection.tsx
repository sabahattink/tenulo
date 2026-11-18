import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { logInjection, useActiveMedication, useInjections, usePlanSteps } from "@/data/injections";
import { setBodyFigure, useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type BodyFigure, DEFAULT_BODY_FIGURE } from "@/domain/body-figure";
import { parseLocalDate } from "@/domain/date";
import { type InjectionSite, injectionStatus } from "@/domain/injection";
import { parseDoseInput } from "@/domain/parse";
import { MedicationOnly } from "@/ui/MedicationOnly";
import { DayPicker } from "@/ui/DayPicker";
import { useI18n } from "@/i18n/provider";
import { BodyMap } from "@/ui/BodyMap";
import { Button, Label, useScrollEndPadding } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

function LogInjectionBody() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);
  const settings = useSettings();

  const status = injectionStatus(
    history.map((i) => ({ date: parseLocalDate(i.localDate), site: i.site, doseMcg: i.doseMcg })),
    steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays })),
    now,
  );

  // Undefined until the user types: the field shows the dose from their plan (or last shot) instead.
  const [typedDose, setDoseText] = useState<string | undefined>();
  const [site, setSite] = useState<InjectionSite | null>(null);
  const [date, setDate] = useState(now);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const figure = settings?.bodyFigure ?? DEFAULT_BODY_FIGURE;
  const chooseFigure = (next: BodyFigure) => {
    setBodyFigure(next).catch((e: unknown) => setError(e instanceof Error ? e.message : t.common.couldNotSave));
  };

  const expected = status.expectedDoseMcg;
  const doseText = typedDose ?? (expected === undefined ? "" : f.doseNumber(expected));

  const dose = parseDoseInput(doseText);

  const save = async () => {
    if (!medication || !dose.ok || saving) return;
    setSaving(true);
    try {
      await logInjection({ medicationId: medication.id, doseMcg: dose.mcg, site, date, note });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  if (!medication) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, fontSize: 16 }}>{t.common.addMedicationFirst}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.medication, { color: theme.text }]}>{medication.name}</Text>

      <Label theme={theme}>{t.logInjection.dose}</Label>
      <TextInput
        value={doseText}
        onChangeText={setDoseText}
        keyboardType="decimal-pad"
        maxLength={6}
        accessibilityLabel={t.logInjection.doseLabel}
        style={[styles.input, { color: theme.text, borderColor: dose.ok ? theme.border : theme.danger, backgroundColor: theme.card }]}
      />
      {status.plan !== undefined && (
        <Text style={[styles.hint, { color: theme.muted }]}>{t.logInjection.prefilled}</Text>
      )}

      <Label theme={theme}>{t.logInjection.site}</Label>
      <BodyMap
        theme={theme}
        figure={figure}
        onFigureChange={chooseFigure}
        selected={site}
        lastSite={status.lastSite}
        longestAgoSite={status.longestAgoSite}
        onSelect={setSite}
      />

      <Label theme={theme}>{t.common.day}</Label>
      <DayPicker theme={theme} value={date} today={now} onChange={setDate} />

      <Label theme={theme}>{t.common.noteOptional}</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder={t.logInjection.notePlaceholder}
        placeholderTextColor={theme.muted}
        style={[styles.input, styles.note, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      <View style={styles.save}>
        <Button theme={theme} label={saving ? t.common.saving : t.logInjection.save} onPress={() => void save()} disabled={!dose.ok || saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.xl, gap: space.s },
  medication: { fontSize: 22, fontWeight: "700", marginBottom: space.m },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 20, fontWeight: "600" },
  note: { fontSize: 16, fontWeight: "400", marginBottom: space.s },
  hint: { fontSize: 13, marginBottom: space.m },
  save: { marginTop: space.xl },
});

export default function LogInjection() {
  return (
    <MedicationOnly>
      <LogInjectionBody />
    </MedicationOnly>
  );
}
