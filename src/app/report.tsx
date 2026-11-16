import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadReport, shareReportPdf } from "@/data/report";
import { useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { REPORT_PERIODS, type Report, type ReportPeriod } from "@/domain/report";
import { useI18n } from "@/i18n/provider";
import { useIsPro } from "@/platform/billing";
import { Button, Card, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

export default function ReportScreen() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
  const endPadding = useScrollEndPadding();
  const isPro = useIsPro();
  const unit = useSettings()?.weightUnit ?? "kg";
  const now = useToday();
  const [period, setPeriod] = useState<ReportPeriod>(90);
  const [report, setReport] = useState<Report | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isPro) return;
    let alive = true;
    loadReport(period, now)
      .then((r) => {
        if (!alive) return;
        setReport(r);
        setLoadError(undefined);
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : t.report.couldNotRead));
    return () => {
      alive = false;
    };
  }, [period, now, isPro, t]);

  if (!isPro) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[type.body, { color: theme.text, textAlign: "center" }]}>{t.report.proOnly}</Text>
        <Button theme={theme} label={t.common.seePro} onPress={() => router.replace("/pro")} />
      </View>
    );
  }

  const share = async () => {
    if (report === undefined || sharing) return;
    setSharing(true);
    try {
      await shareReportPdf(report, now, i18n);
    } catch (e) {
      Alert.alert(t.report.couldNotCreate, e instanceof Error ? e.message : t.common.unknownError);
    } finally {
      setSharing(false);
    }
  };

  const w = report?.weight;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}>
      <Text style={[type.body, { color: theme.muted }]}>{t.report.intro}</Text>
      <Segmented
        theme={theme}
        label={t.report.periodLabel}
        options={REPORT_PERIODS.map((p) => ({ value: p, label: t.report.periods[p] }))}
        value={period}
        onChange={setPeriod}
      />

      {loadError !== undefined ? (
        <Text style={[type.body, { color: theme.danger }]}>{loadError}</Text>
      ) : report === undefined ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : (
        <Card theme={theme} style={styles.preview}>
          <Label theme={theme}>{t.report.preview}</Label>
          <Text style={[type.heading, { color: theme.text }]}>
            {f.longDate(report.from)} – {f.longDate(report.to)}
          </Text>
          <View style={styles.grid}>
            <Fact
              theme={theme}
              label={t.report.trend}
              value={w ? `${f.weight(w.startTrendG, unit)} → ${f.weight(w.endTrendG, unit)}` : t.report.noWeighIns}
            />
            <Fact theme={theme} label={t.report.change} value={w ? f.weightChange(w.changeG, unit) : t.common.noValue} />
            <Fact theme={theme} label={t.report.weighInDays} value={f.integer(w?.weighIns ?? 0)} />
            <Fact theme={theme} label={t.report.injections} value={f.integer(report.injections.count)} />
            <Fact theme={theme} label={t.report.sideEffects} value={f.integer(report.sideEffects.total)} />
            <Fact theme={theme} label={t.report.medication} value={report.medicationName ?? t.report.notSetUp} />
          </View>
        </Card>
      )}

      <Button
        theme={theme}
        icon="report"
        label={sharing ? t.report.creating : t.report.create}
        onPress={() => void share()}
        disabled={report === undefined || sharing}
      />
      <Text style={[type.small, { color: theme.muted }]}>{t.report.footnote}</Text>
    </ScrollView>
  );

}

function Fact({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  const { f } = useI18n();
  return (
    <View style={[styles.fact, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[type.caption, { color: theme.muted }]}>{f.upper(label)}</Text>
      <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.l },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.l },
  loading: { marginVertical: space.xxl },
  preview: { gap: space.m },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  fact: { width: "48.5%", borderRadius: radius.m, padding: space.m, gap: 2 },
});
