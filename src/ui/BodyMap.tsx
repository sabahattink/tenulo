import { useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";
import type { InjectionSite } from "@/domain/injection";
import { BODY_ZONES, VIEW_H, VIEW_W, ZONE_ORDER, siteTargets } from "./body-map-geometry";
import { SITE_LABELS } from "./copy";
import { type Theme, space } from "./theme";

export function BodyMap({
  theme,
  selected,
  lastSite,
  suggestedSite,
  onSelect,
}: {
  theme: Theme;
  selected: InjectionSite | null;
  lastSite: InjectionSite | undefined;
  suggestedSite: InjectionSite | undefined;
  onSelect: (site: InjectionSite | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const height = width > 0 ? Math.round((width * VIEW_H) / VIEW_W) : 0;
  const scale = width / VIEW_W;

  const fillFor = (s: InjectionSite) =>
    s === selected ? theme.accent : s === lastSite ? theme.reading : "transparent";
  const strokeFor = (s: InjectionSite) =>
    s === selected ? theme.accent : s === suggestedSite ? theme.accent : theme.muted;

  return (
    <View style={styles.wrap}>
      <View onLayout={onLayout} style={styles.canvas}>
        {width > 0 && (
          <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <G fill={theme.card} stroke={theme.border} strokeWidth={2} strokeLinejoin="round">
              <Circle cx={100} cy={36} r={22} />
              <Rect x={90} y={56} width={20} height={14} rx={6} />
              {/* torso */}
              <Path d="M62 74 Q100 64 138 74 L136 150 Q134 196 128 210 L72 210 Q66 196 64 150 Z" />
              {/* arms */}
              <Path d="M60 76 Q40 80 36 104 L30 196 Q30 206 38 206 Q46 206 46 196 L54 112 Z" />
              <Path d="M140 76 Q160 80 164 104 L170 196 Q170 206 162 206 Q154 206 154 196 L146 112 Z" />
              {/* legs */}
              <Path d="M72 208 L98 208 L96 398 Q96 408 86 408 Q76 408 76 398 Z" />
              <Path d="M102 208 L128 208 L124 398 Q124 408 114 408 Q104 408 104 398 Z" />
            </G>
            {ZONE_ORDER.map((s) => {
              const z = BODY_ZONES[s];
              return (
                <Ellipse
                  key={s}
                  cx={z.cx}
                  cy={z.cy}
                  rx={z.rx}
                  ry={z.ry}
                  fill={fillFor(s)}
                  fillOpacity={s === selected ? 0.9 : 0.6}
                  stroke={strokeFor(s)}
                  strokeWidth={s === selected || s === suggestedSite ? 2.5 : 1.5}
                  strokeDasharray={s === selected || s === suggestedSite ? undefined : "4 3"}
                />
              );
            })}
            <SvgText x={14} y={24} fontSize={14} fontWeight="700" fill={theme.muted}>
              R
            </SvgText>
            <SvgText x={176} y={24} fontSize={14} fontWeight="700" fill={theme.muted}>
              L
            </SvgText>
          </Svg>
        )}

        {/* Accessible, finger-sized touch targets laid over each zone. */}
        {width > 0 &&
          siteTargets(scale).map(({ site: s, left, top, width: w, height: h }) => {
            const isSelected = s === selected;
            const tag = s === lastSite ? ", last time" : s === suggestedSite ? ", used longest ago" : "";
            return (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${SITE_LABELS[s]}${tag}`}
                onPress={() => onSelect(isSelected ? null : s)}
                style={{ position: "absolute", left, top, width: w, height: h }}
              />
            );
          })}
      </View>

      <View style={styles.side}>
        <Text style={[styles.selected, { color: theme.text }]}>{selected ? SITE_LABELS[selected] : "Tap where you injected"}</Text>
        <Legend theme={theme} swatch={{ backgroundColor: theme.accent }} label="Selected" />
        <Legend theme={theme} swatch={{ borderColor: theme.accent, borderWidth: 2 }} label="Used longest ago" />
        <Legend theme={theme} swatch={{ backgroundColor: theme.reading }} label="Last time" />
        <Text style={[styles.note, { color: theme.muted }]}>
          Front view: your left side is on the right of the picture.
        </Text>
      </View>
    </View>
  );
}

function Legend({ theme, swatch, label }: { theme: Theme; swatch: object; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, swatch]} />
      <Text style={[styles.legendText, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: space.l, alignItems: "center", marginBottom: space.l },
  canvas: { width: "48%", maxWidth: 220 },
  side: { flex: 1, gap: space.s },
  selected: { fontSize: 18, fontWeight: "700", marginBottom: space.s },
  legend: { flexDirection: "row", alignItems: "center", gap: space.s },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 13 },
  note: { fontSize: 12, lineHeight: 16, marginTop: space.s },
});
