import { type ReactNode, useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { EASE_OUT, FILL_MS, useReduceMotion } from "./motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A ring filled clockwise from 12 o'clock by `fraction` (0-1), with content in its centre. It
 * fills from empty when it first appears and glides to each new value (a glass of water, a meal),
 * so the change itself is visible; with "Remove animations" on, it just shows the value.
 */
export function ProgressRing({
  size,
  stroke,
  fraction,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.min(1, Math.max(0, fraction));
  const reduceMotion = useReduceMotion();
  // One animated value for the ring's life (state, not a ref: it is read while rendering).
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      shown.setValue(target);
      return;
    }
    // SVG props cannot run on the native driver; three short rings are cheap on the JS thread.
    const animation = Animated.timing(shown, { toValue: target, duration: FILL_MS, easing: EASE_OUT, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [shown, target, reduceMotion]);

  const dashOffset = shown.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  // A round cap draws a dot even at zero length: hide the arc until there is something to show.
  const arcOpacity = shown.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          strokeOpacity={arcOpacity}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
