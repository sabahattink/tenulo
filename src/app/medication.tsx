import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deletePlanStep, renameMedication, upsertPlanStep, useActiveMedication, usePlanSteps } from "@/data/injections";
import { useToday } from "@/data/use-today";
import { parseLocalDate, toDayNumber } from "@/domain/date";
import { planPosition } from "@/domain/injection";
import { parseDoseInput } from "@/domain/parse";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Card, Label, useScrollEndPadding } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";

/** The user's own plan, shown back to them; and the medication's name. Tenulo never edits either. */
export default function MedicationScreen() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const medication = useActiveMedication();
  const steps = usePlanSteps(medication?.id);

  const [name, setName] = useState<string | undefined>();
  const [stepDose, setStepDose] = useState("");
  const [stepDate, setStepDate] = useState(now);
  const stepParsed = parseDoseInput(stepDose);

  if (!medication) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[type.body, { color: theme.text }]}>{t.common.addMedicationFirst}</Text>
        <Button theme={theme} label={t.medication.addMedication} onPress={() => router.replace("/setup-medication")} />
      </View>
    );
  }

  const plan = steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays }));
  const current = planPosition(plan, now);
  const sorted = [...steps].sort((a, b) => toDayNumber(parseLocalDate(a.startDate)) - toDayNumber(parseLocalDate(b.startDate)));

  const addStep = () => {
    if (!stepParsed.ok) return;
    const interval = current?.step.intervalDays ?? sorted.at(-1)?.intervalDays ?? 7;
    void upsertPlanStep({ medicationId: medication.id, startDate: stepDate, doseMcg: stepParsed.mcg, intervalDays: interval })
      .then(() => setStepDose(""))
      .catch((e: unknown) => Alert.alert(t.medication.couldNotAdd, e instanceof Error ? e.message : ""));
  };

  const field = [styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
      <Card theme={theme}>
        <Label theme={theme}>{t.medication.yourPlan}</Label>
        <Text style={[type.small, { color: theme.muted }]}>{t.medication.planIntro}</Text>
        <View style={styles.timeline}>
          {sorted.map((s, i) => {
            const startDate = f.longDate(parseLocalDate(s.startDate));
            const remove = () =>
              Alert.alert(t.medication.removeTitle, t.medication.removeBody(f.dose(s.doseMcg), startDate), [
                { text: t.common.cancel, style: "cancel" },
                { text: t.medication.remove, style: "destructive", onPress: () => void deletePlanStep(s.id) },
              ]);
            const isCurrent = current?.step.startDate === s.startDate;
            const isFuture = toDayNumber(parseLocalDate(s.startDate)) > toDayNumber(now);
            const dotColor = isCurrent ? theme.accent : isFuture ? theme.card : theme.reading;
            return (
              <Pressable
                key={s.id}
                onLongPress={steps.length > 1 ? remove : undefined}
                accessibilityHint={steps.length > 1 ? t.medication.removeHint : undefined}
                accessibilityActions={steps.length > 1 ? [{ name: "delete", label: t.medication.removeAction }] : undefined}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "delete") remove();
                }}
                style={styles.step}
              >
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: dotColor, borderColor: isCurrent ? theme.accent : theme.reading }]} />
                  {i < sorted.length - 1 && <View style={[styles.line, { backgroundColor: theme.border }]} />}
                </View>
                <View style={styles.stepText}>
                  <Text style={[type.bodyStrong, { color: theme.text }]}>{f.planStep(s.doseMcg, s.intervalDays)}</Text>
                  <Text style={[type.small, { color: isCurrent ? theme.accent : theme.muted }]}>
                    {isCurrent && current
                      ? t.medication.current(current.period, startDate)
                      : isFuture
                        ? t.medication.planned(startDate)
                        : t.medication.started(startDate)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>{t.medication.addChange}</Label>
        <Text style={[type.small, { color: theme.muted }]}>{t.medication.addChangeIntro}</Text>
        <TextInput
          value={stepDose}
          onChangeText={setStepDose}
          keyboardType="decimal-pad"
          maxLength={6}
          placeholder={t.medication.newDosePlaceholder}
          placeholderTextColor={theme.muted}
          accessibilityLabel={t.medication.newDoseLabel}
          style={field}
        />
        <DayPicker theme={theme} value={stepDate} today={now} onChange={setStepDate} maxDaysBack={365} maxDaysAhead={90} />
        <Button theme={theme} kind="quiet" icon="plus" label={t.medication.addToPlan} onPress={addStep} disabled={!stepParsed.ok} />
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>{t.common.medicationName}</Label>
        <TextInput
          value={name ?? medication.name}
          onChangeText={setName}
          maxLength={60}
          style={field}
          accessibilityLabel={t.common.medicationName}
        />
        <Button
          theme={theme}
          kind="quiet"
          label={t.medication.saveName}
          disabled={name === undefined || name.trim() === "" || name.trim() === medication.name}
          onPress={() =>
            renameMedication(medication.id, name ?? medication.name)
              .then(() => setName(undefined))
              .catch((e: unknown) => Alert.alert(t.medication.couldNotRename, e instanceof Error ? e.message : ""))
          }
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, padding: space.xl },
  content: { padding: space.l, gap: space.l },
  input: { borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 18, fontWeight: "600" },
  timeline: { marginTop: space.s },
  step: { flexDirection: "row", gap: space.m, minHeight: 56 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 4 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  stepText: { flex: 1, gap: 2, paddingBottom: space.m },
});
