import { useState } from "react";
import { Image, type LayoutChangeEvent, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import Svg, { Ellipse, G } from "react-native-svg";
import { BODY_FIGURES, type BodyFigure } from "@/domain/body-figure";
import type { InjectionSite } from "@/domain/injection";
import { useI18n } from "@/i18n/provider";
import { BODY_ZONES, FIGURE_H, FIGURE_W, ZONE_ORDER, siteTargets } from "./body-map-geometry";
import { Segmented } from "./kit";
import { LIGHT, LIGHT_KINDS } from "./palette";
import { type Theme, radius, space } from "./theme";

const FIGURES: Readonly<Record<BodyFigure, number>> = {
  female: require("../../assets/illustrations/body-female.webp"),
  male: require("../../assets/illustrations/body-male.webp"),
};

/** The figure's width on screen: large enough to aim a finger at, short enough to keep the form short. */
const MAX_FIGURE_W = 220;

/**
 * The picture is always light paper, in either theme, so the zones on it keep the light palette:
 * the injection ink for the chosen site, the trend's grey-green for last time, an ink outline for
 * the site used longest ago, dashes for the rest. Every outline sits on a white halo, so it reads on
 * light skin and on dark green shorts alike.
 */
const ON_PAPER = {
  selected: LIGHT_KINDS.injection.ink,
  last: LIGHT.reading,
  longestAgo: LIGHT.text,
  halo: LIGHT.card,
} as const;

/**
 * Where the injection went, chosen on a drawn body: a tap on the arm, belly or thigh. The figure is
 * the user's choice (a woman or a man), remembered in settings. Site names are spoken by screen
 * readers but not written on screen; the picture says it.
 */
export function BodyMap({
  theme,
  figure,
  onFigureChange,
  selected,
  lastSite,
  longestAgoSite,
  onSelect,
}: {
  theme: Theme;
  figure: BodyFigure;
  onFigureChange: (figure: BodyFigure) => void;
  selected: InjectionSite | null;
  lastSite: InjectionSite | undefined;
  longestAgoSite: InjectionSite | undefined;
  onSelect: (site: InjectionSite | null) => void;
}) {
  const { t } = useI18n();
  const dark = useColorScheme() === "dark";
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const height = Math.round((width * FIGURE_H) / FIGURE_W);
  const scale = width / FIGURE_W;
  const zones = BODY_ZONES[figure];

  // Open sites are outlines only: a translucent fill would turn grey on dark cloth and pass for "last time".
  const fillFor = (s: InjectionSite) => (s === selected ? ON_PAPER.selected : s === lastSite ? ON_PAPER.last : "none");
  // "Used longest ago" is a fact from the user's own log, not advice: a quiet solid outline, never
  // the color a selection uses.
  const strokeFor = (s: InjectionSite) => (s === longestAgoSite && s !== selected ? ON_PAPER.longestAgo : ON_PAPER.selected);

  return (
    <View style={styles.wrap}>
      <Segmented
        theme={theme}
        label={t.bodyMap.figure}
        value={figure}
        onChange={onFigureChange}
        options={[
          { value: "female", label: t.bodyMap.female },
          { value: "male", label: t.bodyMap.male },
        ]}
      />
      <Text style={[styles.prompt, { color: theme.muted }]}>{t.bodyMap.prompt}</Text>

      <View style={styles.row}>
        <Text style={[styles.side, { color: theme.muted }]}>{t.bodyMap.right}</Text>
        <View
          onLayout={onLayout}
          style={[styles.figure, { borderColor: theme.border, height: height > 0 ? height : undefined }]}
          accessibilityRole="radiogroup"
          accessibilityLabel={t.logInjection.site}
        >
          {width > 0 && (
            <>
              {/* Both figures stay mounted, so switching between them shows the other at once. */}
              {BODY_FIGURES.map((f) => (
                <Image
                  key={f}
                  source={FIGURES[f]}
                  style={[StyleSheet.absoluteFill, { width, height, opacity: f === figure ? (dark ? 0.9 : 1) : 0 }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ))}
              <Svg width={width} height={height} viewBox={`0 0 ${FIGURE_W} ${FIGURE_H}`} style={StyleSheet.absoluteFill}>
                {ZONE_ORDER.map((s) => {
                  const z = zones[s];
                  const emphasised = s === selected || s === longestAgoSite;
                  const strokeWidth = emphasised ? 7 : 5;
                  return (
                    <G key={s}>
                      <Ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry} fill="none" stroke={ON_PAPER.halo} strokeOpacity={0.9} strokeWidth={strokeWidth + 6} />
                      <Ellipse
                        cx={z.cx}
                        cy={z.cy}
                        rx={z.rx}
                        ry={z.ry}
                        fill={fillFor(s)}
                        fillOpacity={0.9}
                        stroke={strokeFor(s)}
                        strokeWidth={strokeWidth}
                        strokeDasharray={emphasised ? undefined : "12 9"}
                      />
                    </G>
                  );
                })}
              </Svg>
              {/* Accessible, finger-sized touch targets laid over each zone. */}
              {siteTargets(figure, scale).map(({ site: s, left, top, width: w, height: h }) => {
                const isSelected = s === selected;
                const tag = s === lastSite ? t.bodyMap.lastTimeTag : s === longestAgoSite ? t.bodyMap.longestAgoTag : "";
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${t.sites[s]}${tag}`}
                    onPress={() => onSelect(isSelected ? null : s)}
                    style={{ position: "absolute", left, top, width: w, height: h }}
                  />
                );
              })}
            </>
          )}
        </View>
        <Text style={[styles.side, { color: theme.muted }]}>{t.bodyMap.left}</Text>
      </View>

      <View style={styles.legends}>
        <Legend theme={theme} swatch={{ backgroundColor: ON_PAPER.selected }} label={t.bodyMap.selected} />
        <Legend theme={theme} swatch={{ borderColor: theme.text, borderWidth: 2 }} label={t.bodyMap.longestAgo} />
        <Legend theme={theme} swatch={{ backgroundColor: ON_PAPER.last }} label={t.bodyMap.lastTime} />
      </View>
      <Text style={[styles.note, { color: theme.muted }]}>{t.bodyMap.frontView}</Text>
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
  wrap: { gap: space.m, marginBottom: space.l },
  prompt: { fontSize: 14, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.m },
  figure: { width: "64%", maxWidth: MAX_FIGURE_W, borderRadius: radius.l, borderWidth: 1, overflow: "hidden" },
  side: { fontSize: 15, fontWeight: "700", width: 28, textAlign: "center" },
  legends: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: space.l, rowGap: space.xs },
  legend: { flexDirection: "row", alignItems: "center", gap: space.s },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 13 },
  note: { fontSize: 12, lineHeight: 16, textAlign: "center" },
});
