import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useActiveMedication, useInjections, usePlanSteps } from "@/data/injections";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { injectionStatus } from "@/domain/injection";
import { formatDose } from "@/domain/parse";
import { SITE_LABELS, dueText, relativeDay } from "./copy";
import { Button, Card, Label } from "./kit";
import { type Theme, space } from "./theme";

export function InjectionCard({ theme, today }: { theme: Theme; today: LocalDate }) {
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);

  if (!medication) {
    return (
      <Card theme={theme}>
        <Label theme={theme}>Injections</Label>
        <Text style={[styles.body, { color: theme.text }]}>
          Track your weekly shots, your dose schedule and where you injected, next to your weight trend.
        </Text>
        <Button theme={theme} kind="secondary" label="Add your medication" onPress={() => router.push("/setup-medication")} />
      </Card>
    );
  }

  const status = injectionStatus(
    history.map((i) => ({ date: parseLocalDate(i.localDate), site: i.site, doseMcg: i.doseMcg })),
    steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays })),
    today,
  );
  const due = status.daysUntilDue;
  const dueColor = due !== undefined && due < 0 ? theme.goal : theme.text;

  return (
    <Card theme={theme}>
      <Label theme={theme}>{medication.name}</Label>
      <Text style={[styles.due, { color: dueColor }]}>{dueText(status.daysUntilDue, status.nextDue, today)}</Text>
      <View style={styles.facts}>
        {status.plan !== undefined && (
          <Fact
            theme={theme}
            label="Your plan"
            value={`${formatDose(status.plan.step.doseMcg)} · ${status.plan.step.intervalDays === 7 ? "week" : "period"} ${status.plan.period}`}
          />
        )}
        {status.lastDate !== undefined && (
          <Fact
            theme={theme}
            label="Last injection"
            value={`${relativeDay(status.lastDate, today)}${status.lastSite ? ` · ${SITE_LABELS[status.lastSite]}` : ""}`}
          />
        )}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button theme={theme} label="Log injection" onPress={() => router.push("/log-injection")} />
        </View>
        <View style={styles.action}>
          <Button theme={theme} kind="secondary" label="Side effect" onPress={() => router.push("/log-side-effect")} />
        </View>
      </View>
      <Button theme={theme} kind="secondary" label="History & plan" onPress={() => router.push("/injections")} />
    </Card>
  );
}

function Fact({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 21 },
  due: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  facts: { flexDirection: "row", gap: space.l },
  fact: { flex: 1, gap: 2 },
  factLabel: { fontSize: 12 },
  factValue: { fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: space.s, marginTop: space.s },
  action: { flex: 1 },
});
