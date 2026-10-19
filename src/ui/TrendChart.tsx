import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { TrendPoint } from "@/domain/trend";
import { type WeightUnit, fromGrams } from "@/domain/weight";
import { chartGeometry } from "./chart-geometry";
import { type Theme, space } from "./theme";

const HEIGHT = 220;

interface Props {
  readonly trend: readonly TrendPoint[];
  readonly goalG: number | null;
  readonly unit: WeightUnit;
  readonly theme: Theme;
}

/** Daily readings as light dots, the smoothed trend as one strong line, the goal dashed. */
export function TrendChart({ trend, goalG, unit, theme }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const geometry =
    width > 0
      ? chartGeometry(trend, { width, height: HEIGHT, padLeft: 44, padRight: 8, padTop: 10, padBottom: 10 }, goalG)
      : undefined;
  const stepG = (geometry?.ticks[1]?.valueG ?? 0) - (geometry?.ticks[0]?.valueG ?? 0);
  const decimals = fromGrams(stepG, unit) >= 1 ? 0 : 1;

  return (
    <View onLayout={onLayout} style={styles.wrap} accessibilityRole="image" accessibilityLabel="Weight trend chart">
      {geometry && (
        <Svg width={width} height={HEIGHT}>
          {geometry.ticks.map((t) => (
            <Line key={`g${t.valueG}`} x1={44} x2={width - 8} y1={t.y} y2={t.y} stroke={theme.border} strokeWidth={1} />
          ))}
          {geometry.ticks.map((t) => (
            <SvgText key={`l${t.valueG}`} x={38} y={t.y + 4} fontSize={11} fill={theme.muted} textAnchor="end">
              {fromGrams(t.valueG, unit).toFixed(decimals)}
            </SvgText>
          ))}
          {geometry.goalY !== undefined && (
            <Line
              x1={44}
              x2={width - 8}
              y1={geometry.goalY}
              y2={geometry.goalY}
              stroke={theme.goal}
              strokeWidth={1.5}
              strokeDasharray="6 5"
            />
          )}
          {geometry.readings.map((p) => (
            <Circle key={p.date} cx={p.x} cy={p.y} r={3} fill={theme.reading} />
          ))}
          {geometry.trendPath !== "" && (
            <Path d={geometry.trendPath} stroke={theme.trend} strokeWidth={3} fill="none" strokeLinejoin="round" />
          )}
        </Svg>
      )}
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
  wrap: { width: "100%", minHeight: HEIGHT },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.l, marginTop: space.s },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
});
