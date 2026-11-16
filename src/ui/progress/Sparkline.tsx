import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Theme } from "../theme";
import { type SparkPoint, sparkline } from "./sparkline-geometry";

const HEIGHT = 36;
/** Room for the stroke and the end dot, so neither is clipped at the edges. */
const PAD = { padLeft: 4, padRight: 5, padTop: 5, padBottom: 5 } as const;

/** A small trend line in the weight chart's colours, ending in a dot at the latest reading. */
export function Sparkline({ points, theme }: { points: readonly SparkPoint[]; theme: Theme }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const s = width > 0 ? sparkline(points, { width, height: HEIGHT, ...PAD }) : undefined;
  const last = s?.points.at(-1);
  return (
    <View onLayout={onLayout} style={styles.canvas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {s !== undefined && (
        <Svg width={width} height={HEIGHT}>
          {s.path !== "" && (
            <Path d={s.path} stroke={theme.trend} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {last !== undefined && <Circle cx={last.x} cy={last.y} r={3} fill={theme.trend} stroke={theme.card} strokeWidth={1.5} />}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: "100%", height: HEIGHT },
});
