import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useActiveMedication, useInjections, usePlanSteps } from "@/data/injections";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { cycleProgress, injectionStatus } from "@/domain/injection";
import { formatDose } from "@/domain/parse";
import { ProgressRing } from "./ProgressRing";
import { SITE_LABELS, dueText, intervalText, relativeDay } from "./copy";
import { Icon } from "./icons";
import { Button, Card, Label } from "./kit";
import { type Theme, space, type } from "./theme";

export function InjectionCard({ theme, today }: { theme: Theme; today: LocalDate }) {
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);

  if (!medication) {
    return (
      <Card theme={theme}>
        <View style={styles.emptyHead}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="pen" color={theme.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.heading, { color: theme.text }]}>Injections</Text>
            <Text style={[type.small, { color: theme.muted }]}>
              Your shots, your own dose schedule and where you injected, next to your weight trend.
            </Text>
          </View>
        </View>
        <Button theme={theme} kind="quiet" icon="plus" label="Add your medication" onPress={() => router.push("/setup-medication")} />
      </Card>
    );
  }

  const status = injectionStatus(
    history.map((i) => ({ date: parseLocalDate(i.localDate), site: i.site, doseMcg: i.doseMcg })),
    steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays })),
    today,
  );
  const due = status.daysUntilDue;
  const overdue = due !== undefined && due < 0;
  const ring = due === undefined ? undefined : cycleProgress(due, status.intervalDays);

  return (
    <Card theme={theme}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Label theme={theme}>{medication.name}</Label>
          <Text style={[type.heading, { color: overdue ? theme.warn : theme.text }]}>
            {dueText(status.daysUntilDue, status.nextDue, today)}
          </Text>
          {status.plan !== undefined && (
            <Text style={[type.small, { color: theme.muted }]}>
              Your plan: {formatDose(status.plan.step.doseMcg)} {intervalText(status.plan.step.intervalDays)}
            </Text>
          )}
          {status.lastDate !== undefined && (
            <Text style={[type.small, { color: theme.muted }]}>
              Last: {relativeDay(status.lastDate, today)}
              {status.lastSite ? ` · ${SITE_LABELS[status.lastSite]}` : ""}
            </Text>
          )}
        </View>
        {ring !== undefined && (
          <ProgressRing
            size={84}
            stroke={8}
            fraction={ring.fraction}
            color={overdue || due === 0 ? theme.warn : theme.accent}
            track={theme.surfaceAlt}
          >
            <Text style={[styles.ringDay, { color: theme.text }]}>{ring.day}</Text>
            <Text style={[styles.ringOf, { color: theme.muted }]}>of {status.intervalDays}</Text>
          </ProgressRing>
        )}
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button theme={theme} icon="plus" label="Injection" onPress={() => router.push("/log-injection")} />
        </View>
        <View style={styles.flex}>
          <Button theme={theme} kind="quiet" label="Side effect" onPress={() => router.push("/log-side-effect")} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  top: { flexDirection: "row", gap: space.l, alignItems: "center" },
  emptyHead: { flexDirection: "row", gap: space.m, alignItems: "flex-start", marginBottom: space.s },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ringDay: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"], lineHeight: 26 },
  ringOf: { fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: space.s, marginTop: space.m },
});
