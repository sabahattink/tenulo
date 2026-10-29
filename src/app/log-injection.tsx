import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { logInjection, useActiveMedication, useInjections, usePlanSteps } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { parseLocalDate } from "@/domain/date";
import { type InjectionSite, injectionStatus } from "@/domain/injection";
import { parseDoseInput } from "@/domain/parse";
import { DayPicker } from "@/ui/DayPicker";
import { BodyMap } from "@/ui/BodyMap";
import { Button, Label } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

export default function LogInjection() {
  const theme = useTheme();
  const now = useToday();
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);

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

  const expected = status.expectedDoseMcg;
  const doseText = typedDose ?? (expected === undefined ? "" : String(expected / 1000));

  const dose = parseDoseInput(doseText);

  const save = async () => {
    if (!medication || !dose.ok || saving) return;
    setSaving(true);
    try {
      await logInjection({ medicationId: medication.id, doseMcg: dose.mcg, site, date, note });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  if (!medication) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, fontSize: 16 }}>Add your medication first.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.medication, { color: theme.text }]}>{medication.name}</Text>

      <Label theme={theme}>Dose (mg)</Label>
      <TextInput
        value={doseText}
        onChangeText={setDoseText}
        keyboardType="decimal-pad"
        maxLength={6}
        accessibilityLabel="Dose in milligrams"
        style={[styles.input, { color: theme.text, borderColor: dose.ok ? theme.border : theme.danger, backgroundColor: theme.card }]}
      />
      {status.plan !== undefined && (
        <Text style={[styles.hint, { color: theme.muted }]}>
          Prefilled from your plan. Change it if you took a different dose.
        </Text>
      )}

      <Label theme={theme}>Site</Label>
      <BodyMap
        theme={theme}
        selected={site}
        lastSite={status.lastSite}
        suggestedSite={status.suggestedSite}
        onSelect={setSite}
      />

      <Label theme={theme}>Day</Label>
      <DayPicker theme={theme} value={date} today={now} onChange={setDate} />

      <Label theme={theme}>Note (optional)</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder="Anything you want to remember"
        placeholderTextColor={theme.muted}
        style={[styles.input, styles.note, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      <View style={styles.save}>
        <Button theme={theme} label={saving ? "Saving…" : "Save injection"} onPress={() => void save()} disabled={!dose.ok || saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.xl, gap: space.s, paddingBottom: space.xxl },
  medication: { fontSize: 22, fontWeight: "700", marginBottom: space.m },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 20, fontWeight: "600" },
  note: { fontSize: 16, fontWeight: "400", marginBottom: space.s },
  hint: { fontSize: 13, marginBottom: space.m },
  save: { marginTop: space.xl },
});
