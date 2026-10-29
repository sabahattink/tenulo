import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { type WeightSummary, goalProgress, summarizeWeights } from "@/domain/summary";
import { type WeightUnit, formatWeight, formatWeightChange, weightNumber } from "@/domain/weight";
import { InjectionCard } from "@/ui/InjectionCard";
import { TrendChart } from "@/ui/TrendChart";
import { forecastText, longWeekday, relativeDayInline } from "@/ui/copy";
import { Button, Card, Label, ScreenTitle } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

export default function Today() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const entries = useWeightEntries();
  const unit = settings?.weightUnit ?? "kg";
  const goalG = settings?.goalWeightG ?? null;
  const now = useToday();

  const summary = useMemo(
    () =>
      summarizeWeights(
        entries.map((e) => ({ date: parseLocalDate(e.localDate), weightG: e.weightG })),
        goalG,
        now,
      ),
    [entries, goalG, now],
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
    >
      <ScreenTitle theme={theme} eyebrow={longWeekday(now)} title="Today" />
      {summary === undefined ? (
        <EmptyWeight theme={theme} />
      ) : (
        <WeightHero theme={theme} summary={summary} unit={unit} goalG={goalG} now={now} />
      )}
      <InjectionCard theme={theme} today={now} />
      {summary !== undefined && summary.trend.length > 1 && (
        <Card theme={theme}>
          <TrendChart trend={summary.trend} goalG={goalG} unit={unit} theme={theme} today={now} />
        </Card>
      )}
      <Text style={[type.small, styles.footnote, { color: theme.muted }]}>
        Tenulo is a personal log. It does not give medical advice. Everything stays on this phone.
      </Text>
    </ScrollView>
  );
}

function WeightHero({
  theme,
  summary,
  unit,
  goalG,
  now,
}: {
  theme: Theme;
  summary: WeightSummary;
  unit: WeightUnit;
  goalG: number | null;
  now: LocalDate;
}) {
  const first = summary.trend[0];
  const progress = first === undefined ? undefined : goalProgress(Math.round(first.trendG), summary.currentTrendG, goalG);
  const toGoal = goalG === null ? undefined : Math.abs(summary.currentTrendG - goalG);
  return (
    <Card theme={theme} style={styles.hero}>
      <View style={styles.heroHead}>
        <Label theme={theme}>Your trend</Label>
        <Text style={[type.small, { color: theme.muted }]}>Weighed {relativeDayInline(summary.latestDate, now)}</Text>
      </View>
      <View style={styles.headlineRow}>
        <Text style={[type.display, { color: theme.text }]} accessibilityLabel={formatWeight(summary.currentTrendG, unit)}>
          {weightNumber(summary.currentTrendG, unit)}
        </Text>
        <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
      </View>
      <View style={styles.chips}>
        <Stat theme={theme} label="7 days" value={summary.weekChangeG === undefined ? "–" : formatWeightChange(summary.weekChangeG, unit)} />
        <Stat
          theme={theme}
          label="Since start"
          value={summary.trend.length < 2 ? "–" : formatWeightChange(summary.totalChangeG, unit)}
        />
        <Stat theme={theme} label="Last reading" value={formatWeight(summary.latestG, unit)} />
      </View>
      {progress !== undefined && toGoal !== undefined && goalG !== null && (
        <View style={styles.goal}>
          <View style={[styles.track, { backgroundColor: theme.surfaceAlt }]}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={[type.small, { color: theme.muted }]}>
            {toGoal < 100 ? "At your goal" : `${formatWeight(toGoal, unit)} to your goal of ${formatWeight(goalG, unit)}`}
          </Text>
        </View>
      )}
      <Text style={[type.body, { color: theme.text }]}>{forecastText(summary.forecast, unit, now)}</Text>
      <Button
        theme={theme}
        icon="plus"
        label={summary.daysSinceLatest === 0 ? "Log another weigh-in" : "Log today's weight"}
        onPress={() => router.push("/add-weight")}
      />
    </Card>
  );
}

function Stat({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[type.number, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/** First run: what the trend is, drawn rather than explained. */
function EmptyWeight({ theme }: { theme: Theme }) {
  return (
    <Card theme={theme} style={styles.hero}>
      <Svg width="100%" height={96} viewBox="0 0 320 96" accessibilityElementsHidden importantForAccessibility="no">
        {[18, 34, 30, 46, 40, 52, 62, 56, 70, 66, 78].map((y, i) => (
          <Circle key={i} cx={20 + i * 28} cy={y} r={4} fill={theme.reading} />
        ))}
        <Path d="M20 26 C 90 34, 150 44, 200 56 S 280 70, 300 74" stroke={theme.trend} strokeWidth={4} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={[type.heading, { color: theme.text }]}>Your trend starts with one weigh-in</Text>
      <Text style={[type.body, { color: theme.muted }]}>
        Daily weight jumps around with water and salt. Tenulo smooths it into a trend line, so you can see the direction
        you are really heading.
      </Text>
      <Button theme={theme} icon="plus" label="Log your weight" onPress={() => router.push("/add-weight")} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.l, paddingBottom: space.xxl },
  hero: { gap: space.m, padding: space.xl },
  heroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headlineRow: { flexDirection: "row", alignItems: "baseline", gap: space.s },
  unit: { fontSize: 22, fontWeight: "600" },
  chips: { flexDirection: "row", gap: space.s },
  stat: { flex: 1, borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m, gap: 2 },
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  goal: { gap: space.xs },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  footnote: { textAlign: "center", paddingHorizontal: space.l },
});
