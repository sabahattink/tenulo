import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Tenulo's own line icons, drawn on a 24 x 24 grid with round 1.8 strokes. Drawn here rather than
 * taken from an icon font so the app ships no extra font files and every glyph matches.
 */
export type IconName =
  | "today"
  | "history"
  | "settings"
  | "plus"
  | "scale"
  | "pen"
  | "drop"
  | "bell"
  | "heart"
  | "report"
  | "upload"
  | "download"
  | "lock"
  | "sparkle"
  | "check"
  | "chevron"
  | "trash"
  | "shield"
  | "calendar";

const PATHS: Record<IconName, string[]> = {
  today: ["M3.5 15.5c3-0.2 4.6-6 8-6s4.6 4 9 3.6", "M3.5 20h17"],
  history: ["M12 7.5V12l3 2", "M4.6 9.2A8 8 0 1 1 4 12", "M4 5v4.2h4.2"],
  settings: ["M4 7h9", "M17 7h3", "M4 17h3", "M11 17h9", "M15 5v4", "M9 15v4"],
  plus: ["M12 5v14", "M5 12h14"],
  scale: ["M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M8.5 10a3.5 3.5 0 0 1 7 0", "M12 10l1.4-1.6"],
  pen: ["M15 3.5l5.5 5.5", "M17.8 6.2L8 16l-3.5 0.5L5 13l9.8-9.8", "M11 7l6 6", "M4.5 19.5l2-2"],
  drop: ["M12 3.5c3.2 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10z"],
  bell: ["M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20.5a2.2 2.2 0 0 0 4 0"],
  heart: ["M12 19.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z", "M6.5 12h3l1.5-2.5 2 4.5 1.5-2h3"],
  report: ["M7 3.5h7l4.5 4.5v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z", "M14 3.5V8h4.5", "M9 13h6", "M9 16.5h4"],
  upload: ["M12 15V4.5", "M7.5 9L12 4.5 16.5 9", "M5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V15"],
  download: ["M12 4.5V15", "M7.5 10.5L12 15l4.5-4.5", "M5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V15"],
  lock: ["M6.5 10.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z", "M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"],
  sparkle: ["M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9z", "M19 16.5l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  chevron: ["M9.5 6l6 6-6 6"],
  trash: ["M5 7h14", "M9.5 7V5h5v2", "M7 7l0.8 12.2a1 1 0 0 0 1 0.8h6.4a1 1 0 0 0 1-0.8L17 7"],
  shield: ["M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z", "M9 12l2.2 2.2L15.5 10"],
  calendar: ["M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z", "M4 10h16", "M8.5 4v4", "M15.5 4v4"],
};

export function Icon({ name, color, size = 24 }: { name: IconName; color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {PATHS[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {name === "today" && <Circle cx={11.5} cy={9.5} r={1.6} fill={color} />}
    </Svg>
  );
}
