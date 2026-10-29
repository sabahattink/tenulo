import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deletePlanStep, renameMedication, upsertPlanStep, useActiveMedication, usePlanSteps } from "@/data/injections";
import { today } from "@/data/repo";
import { parseLocalDate, toDayNumber } from "@/domain/date";
import { planPosition } from "@/domain/injection";
import { formatDose, parseDoseInput } from "@/domain/parse";
import { DayPicker } from "@/ui/DayPicker";
import { intervalText, longDate } from "@/ui/copy";
import { Button, Card, Label } from "@/ui/kit";
import { radius, space, type, useTheme } from "@/ui/theme";

/** The user's own plan, shown back to them; and the medication's name. Tenulo never edits either. */
export default function MedicationScreen() {
  const theme = useTheme();
  const now = today();
  const medication = useActiveMedication();
  const steps = usePlanSteps(medication?.id);

  const [name, setName] = useState<string | undefined>();
  const [stepDose, setStepDose] = useState("");
  const [stepDate, setStepDate] = useState(now);
  const stepParsed = parseDoseInput(stepDose);

  if (!medication) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[type.body, { color: theme.text }]}>Add your medication first.</Text>
        <Button theme={theme} label="Add medication" onPress={() => router.replace("/setup-medication")} />
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
      .catch((e: unknown) => Alert.alert("Could not add the step", e instanceof Error ? e.message : ""));
  };

  const field = [styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card theme={theme}>
        <Label theme={theme}>Your plan</Label>
        <Text style={[type.small, { color: theme.muted }]}>
          The doses your prescriber set and when each starts. Tenulo shows this back to you; it never changes it on its own.
        </Text>
        <View style={styles.timeline}>
          {sorted.map((s, i) => {
            const isCurrent = current?.step.startDate === s.startDate;
            const isFuture = toDayNumber(parseLocalDate(s.startDate)) > toDayNumber(now);
            const dotColor = isCurrent ? theme.accent : isFuture ? theme.card : theme.reading;
            return (
              <Pressable
                key={s.id}
                onLongPress={() =>
                  steps.length > 1 &&
                  Alert.alert("Remove this step?", `${formatDose(s.doseMcg)} from ${longDate(parseLocalDate(s.startDate))}`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => void deletePlanStep(s.id) },
                  ])
                }
                accessibilityHint={steps.length > 1 ? "Long press to remove this step" : undefined}
                style={styles.step}
              >
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: dotColor, borderColor: isCurrent ? theme.accent : theme.reading }]} />
                  {i < sorted.length - 1 && <View style={[styles.line, { backgroundColor: theme.border }]} />}
                </View>
                <View style={styles.stepText}>
                  <Text style={[type.bodyStrong, { color: theme.text }]}>
                    {formatDose(s.doseMcg)} {intervalText(s.intervalDays)}
                  </Text>
                  <Text style={[type.small, { color: isCurrent ? theme.accent : theme.muted }]}>
                    {isCurrent && current ? `Now · period ${current.period} · ` : isFuture ? "Planned · " : ""}from{" "}
                    {longDate(parseLocalDate(s.startDate))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>Add a dose change</Label>
        <Text style={[type.small, { color: theme.muted }]}>Only as your prescriber told you. It starts on the day you pick.</Text>
        <TextInput
          value={stepDose}
          onChangeText={setStepDose}
          keyboardType="decimal-pad"
          maxLength={6}
          placeholder="New dose in mg"
          placeholderTextColor={theme.muted}
          accessibilityLabel="New dose in milligrams"
          style={field}
        />
        <DayPicker theme={theme} value={stepDate} today={now} onChange={setStepDate} maxDaysBack={365} maxDaysAhead={90} />
        <Button theme={theme} kind="quiet" icon="plus" label="Add to plan" onPress={addStep} disabled={!stepParsed.ok} />
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>Medication name</Label>
        <TextInput
          value={name ?? medication.name}
          onChangeText={setName}
          maxLength={60}
          style={field}
          accessibilityLabel="Medication name"
        />
        <Button
          theme={theme}
          kind="quiet"
          label="Save name"
          disabled={name === undefined || name.trim() === "" || name.trim() === medication.name}
          onPress={() => void renameMedication(medication.id, name ?? medication.name).then(() => setName(undefined))}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, padding: space.xl },
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxl },
  input: { borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 18, fontWeight: "600" },
  timeline: { marginTop: space.s },
  step: { flexDirection: "row", gap: space.m, minHeight: 56 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 4 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  stepText: { flex: 1, gap: 2, paddingBottom: space.m },
});
