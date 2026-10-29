import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadReport, shareReportPdf } from "@/data/report";
import { today, useSettings } from "@/data/repo";
import { REPORT_PERIODS, type Report, type ReportPeriod } from "@/domain/report";
import { formatWeight, formatWeightChange } from "@/domain/weight";
import { useIsPro } from "@/platform/billing";
import { longDate } from "@/ui/copy";
import { Button, Card, Label, Segmented } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

const PERIOD_LABELS: Record<string, string> = { "30": "30 days", "90": "90 days", "180": "6 months", all: "All" };
const OPTIONS = REPORT_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[String(p)] ?? String(p) }));

export default function ReportScreen() {
  const theme = useTheme();
  const isPro = useIsPro();
  const unit = useSettings()?.weightUnit ?? "kg";
  const now = today();
  const [period, setPeriod] = useState<ReportPeriod>(90);
  const [report, setReport] = useState<Report | undefined>();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadReport(period, now).then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, [period, now]);

  if (!isPro) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[type.body, { color: theme.text, textAlign: "center" }]}>The doctor report is part of Tenulo Pro.</Text>
        <Button theme={theme} label="See Pro" onPress={() => router.replace("/pro")} />
      </View>
    );
  }

  const share = async () => {
    if (report === undefined || sharing) return;
    setSharing(true);
    try {
      await shareReportPdf(report, now);
    } catch (e) {
      Alert.alert("Could not create the PDF", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSharing(false);
    }
  };

  const w = report?.weight;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Text style={[type.body, { color: theme.muted }]}>
        A one-page summary of what you logged, for your doctor or pharmacist. It is created on this phone; you choose where
        to send it.
      </Text>
      <Segmented theme={theme} label="Report period" options={OPTIONS} value={period} onChange={setPeriod} />

      {report === undefined ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : (
        <Card theme={theme} style={styles.preview}>
          <Label theme={theme}>Preview</Label>
          <Text style={[type.heading, { color: theme.text }]}>
            {longDate(report.from)} – {longDate(report.to)}
          </Text>
          <View style={styles.grid}>
            <Fact theme={theme} label="Trend" value={w ? `${formatWeight(w.startTrendG, unit)} → ${formatWeight(w.endTrendG, unit)}` : "No weigh-ins"} />
            <Fact theme={theme} label="Change" value={w ? formatWeightChange(w.changeG, unit) : "–"} />
            <Fact theme={theme} label="Weigh-in days" value={String(w?.weighIns ?? 0)} />
            <Fact theme={theme} label="Injections" value={String(report.injections.count)} />
            <Fact theme={theme} label="Side effects" value={String(report.sideEffects.total)} />
            <Fact theme={theme} label="Medication" value={report.medicationName ?? "Not set up"} />
          </View>
        </Card>
      )}

      <Button
        theme={theme}
        icon="report"
        label={sharing ? "Creating PDF…" : "Create PDF and share"}
        onPress={() => void share()}
        disabled={report === undefined || sharing}
      />
      <Text style={[type.small, { color: theme.muted }]}>
        The report shows your entries as you made them. It contains no advice and no assessment.
      </Text>
    </ScrollView>
  );

}

function Fact({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={[styles.fact, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[type.caption, { color: theme.muted }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.l, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.l },
  loading: { marginVertical: space.xxl },
  preview: { gap: space.m },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  fact: { width: "48.5%", borderRadius: radius.m, padding: space.m, gap: 2 },
});
