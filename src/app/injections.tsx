import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  deleteInjection,
  deletePlanStep,
  deleteSideEffect,
  renameMedication,
  upsertPlanStep,
  useActiveMedication,
  useInjections,
  usePlanSteps,
  useSideEffects,
} from "@/data/injections";
import { today } from "@/data/repo";
import { type LocalDate, parseLocalDate, toDayNumber } from "@/domain/date";
import { formatDose, parseDoseInput } from "@/domain/parse";
import { DayPicker } from "@/ui/DayPicker";
import { SEVERITY_LABELS, SIDE_EFFECT_LABELS, SITE_LABELS, relativeDay, shortDate } from "@/ui/copy";
import { Button, Card, Label } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

type Row =
  | { kind: "injection"; id: string; date: LocalDate; title: string; detail: string }
  | { kind: "side-effect"; id: string; date: LocalDate; title: string; detail: string };

export default function InjectionsScreen() {
  const theme = useTheme();
  const now = today();
  const medication = useActiveMedication();
  const shots = useInjections(medication?.id);
  const effects = useSideEffects();
  const steps = usePlanSteps(medication?.id);

  const [name, setName] = useState<string | undefined>();
  const [stepDose, setStepDose] = useState("");
  const [stepDate, setStepDate] = useState(now);
  const stepParsed = parseDoseInput(stepDose);

  const rows: Row[] = [
    ...shots.map((s): Row => ({
      kind: "injection",
      id: s.id,
      date: parseLocalDate(s.localDate),
      title: `Injection · ${formatDose(s.doseMcg)}`,
      detail: s.site ? SITE_LABELS[s.site] : "Site not recorded",
    })),
    ...effects.map((e): Row => ({
      kind: "side-effect",
      id: e.id,
      date: parseLocalDate(e.localDate),
      title: SIDE_EFFECT_LABELS[e.type],
      detail: SEVERITY_LABELS[e.severity as 1 | 2 | 3] ?? "",
    })),
  ].sort((a, b) => toDayNumber(b.date) - toDayNumber(a.date) || (a.kind === "injection" ? -1 : 1));

  const confirmDelete = (row: Row) =>
    Alert.alert(`Delete this ${row.kind === "injection" ? "injection" : "entry"}?`, `${row.title} · ${relativeDay(row.date, now)}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void (row.kind === "injection" ? deleteInjection(row.id) : deleteSideEffect(row.id)),
      },
    ]);

  if (!medication) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Add your medication first.</Text>
      </View>
    );
  }

  const addStep = () => {
    if (!stepParsed.ok) return;
    const interval = steps.at(-1)?.intervalDays ?? 7;
    void upsertPlanStep({ medicationId: medication.id, startDate: stepDate, doseMcg: stepParsed.mcg, intervalDays: interval }).then(
      () => setStepDose(""),
    );
  };

  const field = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card theme={theme}>
        <Label theme={theme}>Your plan</Label>
        <Text style={[styles.note, { color: theme.muted }]}>
          The doses your doctor prescribed and when each one starts. Tenulo shows this back to you; it never changes
          it on its own.
        </Text>
        {steps.map((s) => (
          <Pressable
            key={s.id}
            onLongPress={() =>
              steps.length > 1 &&
              Alert.alert("Remove this step?", `${formatDose(s.doseMcg)} from ${shortDate(parseLocalDate(s.startDate), now)}`, [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => void deletePlanStep(s.id) },
              ])
            }
            style={[styles.row, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.rowTitle, { color: theme.text }]}>{formatDose(s.doseMcg)}</Text>
            <Text style={[styles.rowDetail, { color: theme.muted }]}>
              from {shortDate(parseLocalDate(s.startDate), now)} · every {s.intervalDays === 1 ? "day" : `${s.intervalDays} days`}
            </Text>
          </Pressable>
        ))}
        <Label theme={theme}>Add a dose change</Label>
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
        <Button theme={theme} kind="secondary" label="Add to plan" onPress={addStep} disabled={!stepParsed.ok} />
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>History</Label>
        {rows.length === 0 && <Text style={[styles.note, { color: theme.muted }]}>Nothing logged yet.</Text>}
        {rows.map((r) => (
          <Pressable
            key={`${r.kind}-${r.id}`}
            onLongPress={() => confirmDelete(r)}
            accessibilityHint="Long press to delete"
            style={[styles.row, { borderBottomColor: theme.border }]}
          >
            <View style={styles.rowHead}>
              <Text style={[styles.rowTitle, { color: r.kind === "injection" ? theme.text : theme.goal }]}>{r.title}</Text>
              <Text style={[styles.rowDetail, { color: theme.muted }]}>{relativeDay(r.date, now)}</Text>
            </View>
            <Text style={[styles.rowDetail, { color: theme.muted }]}>{r.detail}</Text>
          </Pressable>
        ))}
        {rows.length > 0 && <Text style={[styles.note, { color: theme.muted }]}>Long press an entry to delete it.</Text>}
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>Medication name</Label>
        <TextInput value={name ?? medication.name} onChangeText={setName} maxLength={60} style={field} accessibilityLabel="Medication name" />
        <Button
          theme={theme}
          kind="secondary"
          label="Save name"
          disabled={name === undefined || name.trim() === "" || name.trim() === medication.name}
          onPress={() => void renameMedication(medication.id, name ?? medication.name).then(() => setName(undefined))}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxl },
  note: { fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 17 },
  row: { paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48, gap: 2 },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowDetail: { fontSize: 14 },
});
