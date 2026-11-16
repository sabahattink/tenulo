import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { deleteMeasurement, useMeasurements } from "@/data/body";
import { useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type LocalDate, parseLocalDate, toDayNumber } from "@/domain/date";
import { type LengthUnit, MEASUREMENT_SITES, type MeasurementPoint, type MeasurementSite, lengthUnitFor } from "@/domain/measurement";
import { useI18n } from "@/i18n/provider";
import { Button, Card, Chip, useScrollEndPadding } from "@/ui/kit";
import { Sparkline } from "@/ui/progress/Sparkline";
import { formatLength, formatLengthChange } from "@/ui/progress/length";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

function isSite(value: string | undefined): value is MeasurementSite {
  return value !== undefined && (MEASUREMENT_SITES as readonly string[]).includes(value);
}

interface Reading extends MeasurementPoint {
  readonly id: string;
}

/** Every reading of one site, newest first, each deletable after a question. `?site=` picks the site. */
export default function MeasurementReadings() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const params = useLocalSearchParams<{ site?: string }>();
  const unit = lengthUnitFor(useSettings()?.weightUnit ?? "kg");
  const rows = useMeasurements();

  const readings = useMemo(
    () =>
      rows.map(
        (r): Reading => ({ id: r.id, site: r.site, date: parseLocalDate(r.localDate), measuredAt: r.measuredAt, lengthMm: r.lengthMm }),
      ),
    [rows],
  );
  const measured = useMemo(() => MEASUREMENT_SITES.filter((s) => readings.some((r) => r.site === s)), [readings]);
  const [chosen, setChosen] = useState<MeasurementSite | undefined>(isSite(params.site) ? params.site : undefined);
  const site = chosen !== undefined && measured.includes(chosen) ? chosen : measured[0];

  // Oldest first, so each reading can be compared with the one before it.
  const series = useMemo(
    () =>
      readings
        .filter((r) => r.site === site)
        .sort((a, b) => toDayNumber(a.date) - toDayNumber(b.date) || a.measuredAt - b.measuredAt),
    [readings, site],
  );

  const confirmDelete = (r: Reading) =>
    Alert.alert(t.measure.deleteTitle, `${t.measure.sites[r.site]} ${formatLength(f, r.lengthMm, unit)} · ${f.relativeDay(r.date, now)}`, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () =>
          void deleteMeasurement(r.id).catch((e: unknown) =>
            Alert.alert(t.common.didNotWork, e instanceof Error ? e.message : t.common.somethingWentWrong),
          ),
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}>
      {measured.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup">
          {measured.map((s) => (
            <Chip key={s} theme={theme} label={t.measure.sites[s]} selected={s === site} onPress={() => setChosen(s)} />
          ))}
        </ScrollView>
      )}

      {site === undefined || series.length === 0 ? (
        <Text style={[type.body, { color: theme.muted }]}>{t.measure.noReadings}</Text>
      ) : (
        <>
          <Card theme={theme} style={styles.head}>
            <Text style={[type.heading, { color: theme.text }]}>{t.measure.sites[site]}</Text>
            <Text style={[type.small, { color: theme.muted }]}>{t.measure.readings(series.length)}</Text>
            <Sparkline points={series.map((p) => ({ date: p.date, value: p.lengthMm }))} theme={theme} />
          </Card>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[...series].reverse().map((r, i, newestFirst) => (
              <ReadingRow
                key={r.id}
                theme={theme}
                reading={r}
                before={newestFirst[i + 1]}
                unit={unit}
                today={now}
                last={i === newestFirst.length - 1}
                onDelete={() => confirmDelete(r)}
              />
            ))}
          </View>
          <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.measure.deleteHint}</Text>
        </>
      )}

      <Button
        theme={theme}
        kind="quiet"
        icon="plus"
        label={t.progress.addMeasurements}
        onPress={() => router.push({ pathname: "/add-measurement", params: { date: now } })}
      />
    </ScrollView>
  );
}

function ReadingRow({
  theme,
  reading,
  before,
  unit,
  today,
  last,
  onDelete,
}: {
  theme: Theme;
  reading: Reading;
  before: Reading | undefined;
  unit: LengthUnit;
  today: LocalDate;
  last: boolean;
  onDelete: () => void;
}) {
  const { t, f } = useI18n();
  const value = formatLength(f, reading.lengthMm, unit);
  const detail =
    before === undefined ? t.progress.firstReading : t.measure.fromPrevious(formatLengthChange(f, reading.lengthMm - before.lengthMm, unit));
  const when = f.relativeDay(reading.date, today);
  return (
    <Pressable
      onLongPress={onDelete}
      accessibilityHint={t.history.deleteHint}
      accessibilityActions={[{ name: "delete", label: t.common.delete }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "delete") onDelete();
      }}
      accessibilityLabel={`${value}, ${detail}, ${when}`}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text style={[type.number, { color: theme.text }]}>{value}</Text>
        <Text style={[type.small, styles.tabular, { color: theme.muted }]}>{detail}</Text>
      </View>
      <Text style={[type.small, { color: theme.muted }]}>{when}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.l },
  chips: { gap: space.s, paddingRight: space.l },
  head: { gap: space.xs },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.m },
  text: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
  hint: { textAlign: "center" },
});
