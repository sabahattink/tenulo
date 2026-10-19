import { Link, Stack, router } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { deleteWeight, today, useSettings, useWeightEntries } from "@/data/repo";
import { parseLocalDate } from "@/domain/date";
import { summarizeWeights } from "@/domain/summary";
import { formatWeight, formatWeightChange, weightNumber } from "@/domain/weight";
import { TrendChart } from "@/ui/TrendChart";
import { forecastText, relativeDay } from "@/ui/copy";
import { Button, Card, Label } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

export default function Home() {
  const theme = useTheme();
  const settings = useSettings();
  const entries = useWeightEntries();
  const unit = settings?.weightUnit ?? "kg";
  const goalG = settings?.goalWeightG ?? null;
  const now = today();

  const summary = useMemo(
    () =>
      summarizeWeights(
        entries.map((e) => ({ date: parseLocalDate(e.localDate), weightG: e.weightG })),
        goalG,
        now,
      ),
    [entries, goalG, now],
  );

  const settingsLink = (
    <Link href="/settings" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12}>
        <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "600" }}>Settings</Text>
      </Pressable>
    </Link>
  );

  if (summary === undefined) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerRight: () => settingsLink }} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Your trend starts with one weigh-in</Text>
        <Text style={[styles.emptyBody, { color: theme.muted }]}>
          Daily weight jumps around with water and salt. Tenulo smooths it into a trend line, so you can see the
          direction you are really heading. Everything stays on this phone.
        </Text>
        <Button theme={theme} label="Log your weight" onPress={() => router.push("/add-weight")} />
      </View>
    );
  }

  const confirmDelete = (id: string, label: string) =>
    Alert.alert("Delete this entry?", label, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteWeight(id) },
    ]);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerRight: () => settingsLink }} />

      <Card theme={theme}>
        <Label theme={theme}>Trend</Label>
        <View style={styles.headlineRow}>
          <Text style={[styles.headline, { color: theme.text }]} accessibilityLabel={formatWeight(summary.currentTrendG, unit)}>
            {weightNumber(summary.currentTrendG, unit)}
          </Text>
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat theme={theme} label="This week" value={summary.weekChangeG === undefined ? "—" : formatWeightChange(summary.weekChangeG, unit)} />
          <Stat theme={theme} label="Since start" value={formatWeightChange(summary.totalChangeG, unit)} />
          <Stat theme={theme} label="Last weigh-in" value={relativeDay(summary.latestDate, now)} />
        </View>
        <Text style={[styles.forecast, { color: theme.text }]}>{forecastText(summary.forecast, unit, now)}</Text>
      </Card>

      <Card theme={theme}>
        <TrendChart trend={summary.trend} goalG={goalG} unit={unit} theme={theme} />
      </Card>

      <Button
        theme={theme}
        label={summary.daysSinceLatest === 0 ? "Log another weigh-in" : "Log today's weight"}
        onPress={() => router.push("/add-weight")}
      />

      <Card theme={theme}>
        <Label theme={theme}>Recent</Label>
        {entries.slice(0, 14).map((e) => {
          const date = parseLocalDate(e.localDate);
          return (
            <Pressable
              key={e.id}
              onLongPress={() => confirmDelete(e.id, `${formatWeight(e.weightG, unit)} · ${relativeDay(date, now)}`)}
              accessibilityHint="Long press to delete"
              style={[styles.row, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.rowDate, { color: theme.muted }]}>{relativeDay(date, now)}</Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>{formatWeight(e.weightG, unit)}</Text>
            </Pressable>
          );
        })}
        <Text style={[styles.hint, { color: theme.muted }]}>Long press an entry to delete it.</Text>
      </Card>
    </ScrollView>
  );
}

function Stat({ theme, label, value }: { theme: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxl },
  empty: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.l },
  emptyTitle: { fontSize: 26, fontWeight: "700", lineHeight: 32 },
  emptyBody: { fontSize: 16, lineHeight: 23 },
  headlineRow: { flexDirection: "row", alignItems: "baseline", gap: space.s },
  headline: { fontSize: 52, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { fontSize: 20, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: space.l },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  forecast: { fontSize: 15, lineHeight: 21, marginTop: space.s },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    alignItems: "center",
  },
  rowDate: { fontSize: 15 },
  rowValue: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  hint: { fontSize: 12, marginTop: space.s },
});
