import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import type { LocalDate } from "@/domain/date";
import type { TrendPoint } from "@/domain/trend";
import { type WeightUnit, formatWeight, fromGrams } from "@/domain/weight";
import { chartGeometry } from "./chart-geometry";
import { shortDate } from "./copy";
import { Segmented } from "./kit";
import { type Theme, space, type } from "./theme";

const HEIGHT = 210;
const PAD = { padLeft: 40, padRight: 10, padTop: 12, padBottom: 24 } as const;

type Range = 30 | 90 | 365 | "all";
const RANGES: readonly { value: Range; label: string }[] = [
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
  { value: 365, label: "1Y" },
  { value: "all", label: "All" },
];

interface Props {
  readonly trend: readonly TrendPoint[];
  readonly goalG: number | null;
  readonly unit: WeightUnit;
  readonly theme: Theme;
  readonly today: LocalDate;
}

/** Daily readings as light dots, the smoothed trend as one strong line over a soft fill. */
export function TrendChart({ trend, goalG, unit, theme, today }: Props) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<Range>(90);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const g =
    width > 0
      ? chartGeometry(trend, { width, height: HEIGHT, ...PAD }, goalG, range === "all" ? Number.POSITIVE_INFINITY : range)
      : undefined;
  const stepG = (g?.ticks[1]?.valueG ?? 0) - (g?.ticks[0]?.valueG ?? 0);
  const decimals = fromGrams(stepG, unit) >= 1 ? 0 : 1;
  const first = g?.trendPoints[0];
  const last = g?.trendPoints.at(-1);
  const bottom = HEIGHT - PAD.padBottom;
  const area = g && first && last && g.trendPath !== "" ? `${g.trendPath} L${last.x},${bottom} L${first.x},${bottom} Z` : "";
  const lastPoint = trend.at(-1);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[type.heading, { color: theme.text }]}>Trend</Text>
      </View>
      <View
        onLayout={onLayout}
        style={styles.canvas}
        accessibilityRole="image"
        accessibilityLabel={
          lastPoint ? `Weight trend chart, latest trend ${formatWeight(Math.round(lastPoint.trendG), unit)}` : "Weight trend chart"
        }
      >
        {g && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.trend} stopOpacity={0.22} />
                <Stop offset="1" stopColor={theme.trend} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {g.ticks.map((t) => (
              <Line key={`g${t.valueG}`} x1={PAD.padLeft} x2={width - PAD.padRight} y1={t.y} y2={t.y} stroke={theme.border} strokeWidth={1} />
            ))}
            {g.ticks.map((t) => (
              <SvgText key={`l${t.valueG}`} x={PAD.padLeft - 8} y={t.y + 4} fontSize={11} fill={theme.muted} textAnchor="end">
                {fromGrams(t.valueG, unit).toFixed(decimals)}
              </SvgText>
            ))}
            {g.goalY !== undefined && (
              <>
                <Line
                  x1={PAD.padLeft}
                  x2={width - PAD.padRight}
                  y1={g.goalY}
                  y2={g.goalY}
                  stroke={theme.goal}
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                />
                <SvgText x={width - PAD.padRight} y={g.goalY - 5} fontSize={11} fontWeight="600" fill={theme.goal} textAnchor="end">
                  Goal
                </SvgText>
              </>
            )}
            {area !== "" && <Path d={area} fill="url(#trendFill)" />}
            {g.readings.map((p) => (
              <Circle key={p.date} cx={p.x} cy={p.y} r={2.6} fill={theme.reading} />
            ))}
            {g.trendPath !== "" && (
              <Path d={g.trendPath} stroke={theme.trend} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {last && (
              <>
                <Circle cx={last.x} cy={last.y} r={7} fill={theme.trend} opacity={0.18} />
                <Circle cx={last.x} cy={last.y} r={4} fill={theme.trend} stroke={theme.card} strokeWidth={2} />
              </>
            )}
            <SvgText x={PAD.padLeft} y={HEIGHT - 6} fontSize={11} fill={theme.muted}>
              {shortDate(g.first, today)}
            </SvgText>
            <SvgText x={width - PAD.padRight} y={HEIGHT - 6} fontSize={11} fill={theme.muted} textAnchor="end">
              {shortDate(g.last, today)}
            </SvgText>
          </Svg>
        )}
      </View>
      <Segmented theme={theme} label="Chart range" options={RANGES} value={range} onChange={setRange} />
      <View style={styles.legend}>
        <Legend color={theme.trend} label="Trend" theme={theme} />
        <Legend color={theme.reading} label="Daily weigh-in" theme={theme} />
        {goalG !== null && <Legend color={theme.goal} label="Goal" theme={theme} />}
      </View>
    </View>
  );
}

function Legend({ color, label, theme }: { color: string; label: string; theme: Theme }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: space.m },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  canvas: { width: "100%", minHeight: HEIGHT },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.l },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
});
