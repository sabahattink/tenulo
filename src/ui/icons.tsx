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
  | "calendar"
  // Today, water and exercise (daily-log slice B).
  | "bowl"
  | "tape"
  | "face"
  | "undo"
  | "minus"
  | "walk"
  | "run"
  | "bike"
  | "swim"
  | "dumbbell"
  | "yoga"
  | "ball"
  | "food"
  | "target"
  | "search";

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
  // Today, water and exercise (daily-log slice B). Circles are drawn as two arcs.
  bowl: ["M3.5 11.5h17", "M4.5 11.5a7.5 7.5 0 0 0 15 0", "M9.5 8.5c-0.9-1.1 0.9-1.9 0-3", "M14.5 8.5c-0.9-1.1 0.9-1.9 0-3"],
  tape: ["M4 15.5L15.5 4l4.5 4.5L8.5 20z", "M7.5 12l2 2", "M10 9.5l1.3 1.3", "M12.5 7l2 2"],
  face: ["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0", "M9 10v0.6", "M15 10v0.6", "M8.5 15.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0"],
  undo: ["M8.5 5L4 9.5 8.5 14", "M4 9.5h10a4.75 4.75 0 0 1 0 9.5h-3"],
  minus: ["M5 12h14"],
  walk: ["M11.3 4.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0", "M12.5 8.5l-1.3 5.5", "M9.5 12.2L12.3 9l2.7 2.8", "M11.2 14l-2.7 6", "M11.2 14l2.6 2.6v3.6"],
  run: ["M13.3 4.3a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0", "M13.5 8l-2.5 5", "M8.5 10.5l2-2 3-0.5 2 2.5 2-1", "M11 13l-3 1.8-2.5-1", "M11 13l2.5 3-1 4.5"],
  bike: [
    "M2.5 16.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
    "M14.5 16.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
    "M6 16.5L9.5 10h6.5",
    "M6 16.5h5.5L16 10l2 6.5",
    "M9.5 10l2 6.5",
    "M16 10l-0.7-2.3h2",
    "M9.5 10l-0.5-2",
    "M7.8 8h2.8",
  ],
  swim: [
    "M14.8 7a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0",
    "M5 13l4.5-4 3.5 3.5 2.5-1.5",
    "M3 16.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1",
    "M3 20c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1",
  ],
  dumbbell: ["M8 12h8", "M5.5 8.5v7", "M8 7v10", "M16 7v10", "M18.5 8.5v7", "M3.5 12h2", "M18.5 12h2"],
  yoga: ["M10.3 5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0", "M12 8.5v5", "M7 14l5-4.5 5 4.5", "M5 17.5c2.5-2 4.5-3 7-3s4.5 1 7 3", "M8 18.5h8"],
  ball: ["M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M5.2 7.8c2.9 1.9 2.9 6.5 0 8.4", "M18.8 7.8c-2.9 1.9-2.9 6.5 0 8.4"],
  food: ["M5.5 3.5V8a2.5 2.5 0 0 0 5 0V3.5", "M8 3.5v17", "M17.5 20.5v-17c-2 1.5-3.2 4.2-3.2 8h3.2"],
  target: ["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0", "M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0", "M12 12h0.01"],
  search: ["M4.5 10.5a6 6 0 1 0 12 0a6 6 0 1 0-12 0", "M15 15l5 5"],
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
