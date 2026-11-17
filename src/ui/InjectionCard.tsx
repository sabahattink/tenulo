import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useActiveMedication, useInjections, usePlanSteps } from "@/data/injections";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { cycleProgress, injectionStatus } from "@/domain/injection";
import { useI18n } from "@/i18n/provider";
import { ProgressRing } from "./ProgressRing";
import { Button, Card, KindIcon } from "./kit";
import { type Theme, space, type } from "./theme";

export function InjectionCard({ theme, today }: { theme: Theme; today: LocalDate }) {
  const { t, f } = useI18n();
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);

  if (!medication) {
    return (
      <Card theme={theme}>
        <View style={styles.emptyHead}>
          <KindIcon theme={theme} kind="injection" icon="pen" size={44} />
          <View style={styles.flex}>
            <Text style={[type.heading, { color: theme.text }]}>{t.injectionCard.title}</Text>
            <Text style={[type.small, { color: theme.muted }]}>{t.injectionCard.emptyBody}</Text>
          </View>
        </View>
        <Button
          theme={theme}
          kind="quiet"
          tint={theme.kinds.injection}
          icon="plus"
          label={t.injectionCard.addMedication}
          onPress={() => router.push("/setup-medication")}
        />
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
          <View style={styles.nameRow}>
            <KindIcon theme={theme} kind="injection" icon="pen" size={28} />
            <Text style={[type.small, styles.name, { color: theme.kinds.injection.ink }]} numberOfLines={1}>
              {medication.name}
            </Text>
          </View>
          <Text style={[type.heading, { color: overdue ? theme.warn : theme.text }]}>
            {f.due(status.daysUntilDue, status.nextDue, today)}
          </Text>
          {status.plan !== undefined && (
            <Text style={[type.small, { color: theme.muted }]}>
              {t.injectionCard.plan(f.planStep(status.plan.step.doseMcg, status.plan.step.intervalDays))}
            </Text>
          )}
          {status.lastDate !== undefined && (
            <Text style={[type.small, { color: theme.muted }]}>
              {t.injectionCard.last(f.relativeDay(status.lastDate, today))}
              {status.lastSite ? ` · ${t.sites[status.lastSite]}` : ""}
            </Text>
          )}
        </View>
        {ring !== undefined && (
          <ProgressRing
            size={84}
            stroke={8}
            fraction={ring.fraction}
            color={overdue || due === 0 ? theme.warn : theme.kinds.injection.ink}
            track={theme.kinds.injection.soft}
          >
            <Text style={[styles.ringDay, { color: theme.text }]}>{ring.day}</Text>
            <Text style={[styles.ringOf, { color: theme.muted }]}>{t.injectionCard.ringOf(status.intervalDays)}</Text>
          </ProgressRing>
        )}
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button theme={theme} icon="plus" label={t.injectionCard.logInjection} onPress={() => router.push("/log-injection")} />
        </View>
        <View style={styles.flex}>
          <Button
            theme={theme}
            kind="quiet"
            tint={theme.kinds.sideEffect}
            label={t.injectionCard.logSideEffect}
            onPress={() => router.push("/log-side-effect")}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  top: { flexDirection: "row", gap: space.l, alignItems: "center" },
  emptyHead: { flexDirection: "row", gap: space.m, alignItems: "flex-start", marginBottom: space.s },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.xs },
  name: { flex: 1, fontWeight: "700" },
  ringDay: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"], lineHeight: 26 },
  ringOf: { fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: space.s, marginTop: space.m },
});
