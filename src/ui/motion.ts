import { useEffect, useState } from "react";
import { AccessibilityInfo, Easing } from "react-native";

/**
 * Tenulo's motion: few, quick, and only where something changed. A confident deceleration for
 * arrivals; nothing bounces.
 */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Rings filling to a new value: long enough to read as a change, short enough not to wait for. */
export const FILL_MS = 700;

/**
 * Whether the phone asks for less motion (Android: Settings → Accessibility → Remove animations).
 * Starts as false and follows the setting while mounted.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduce(value);
      })
      // Unreadable setting: keep the default. Motion here is short and never carries meaning alone.
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
