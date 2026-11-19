import { useMemo, useRef, useState } from "react";
import { Animated, type FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { finishWelcome } from "@/data/repo";
import { WEIGHT_UNITS, type WeightUnit, defaultWeightUnit } from "@/domain/weight";
import type { Messages } from "@/i18n";
import { deviceLocale } from "@/i18n/device";
import { useI18n } from "@/i18n/provider";
import { features } from "@/platform/features";
import { Illustration } from "@/ui/Illustration";
import { Button, Label, Segmented } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";
import { type WelcomePage as Page, welcomePages } from "@/ui/welcome-pages";
import { notify } from "@/ui/notice";

/** Words per page: `t.welcome.pages[name]`; the daily log page (`food`) is `t.daily.welcomePage`. */
function pageText(t: Messages, page: Page): { readonly title: string; readonly body: string } {
  if (page !== "food") return t.welcome.pages[page];
  const { title, body, narrow } = t.daily.welcomePage;
  return { title, body: features.medication ? body : narrow.body };
}

/** The unit the phone's region most likely uses; the user still chooses. */
function deviceUnit(): WeightUnit {
  return defaultWeightUnit(deviceLocale());
}

/**
 * First launch, and again after "Delete all data": the welcome pages (`welcomePages`: four with
 * medication features, three without), then the unit. Finishing sets settings.welcomed_at; the
 * root layout's guard then opens Today.
 */
export default function Welcome() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pages = useMemo(() => welcomePages(features.medication), []);
  const last = pages.length - 1;
  const [page, setPage] = useState(0);
  const [unit, setUnit] = useState<WeightUnit>(deviceUnit);
  const [saving, setSaving] = useState(false);
  const [scrollX] = useState(() => new Animated.Value(0));
  const scroller = useRef<FlatList<Page>>(null);
  const art = Math.min(width - space.xl * 2, height * 0.4, 420);

  const goTo = (index: number) => scroller.current?.scrollToOffset({ offset: index * width, animated: true });

  const start = () => {
    setSaving(true);
    finishWelcome(unit).catch((e: unknown) => {
      setSaving(false);
      notify(t, t.common.didNotWork, e instanceof Error ? e.message : t.common.tryAgain);
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + space.s, paddingBottom: insets.bottom + space.l }]}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>Tenulo</Text>
        {page < last && (
          <Pressable accessibilityRole="button" onPress={() => goTo(last)} hitSlop={12} style={styles.skip}>
            <Text style={[type.bodyStrong, { color: theme.muted }]}>{t.welcome.skip}</Text>
          </Pressable>
        )}
      </View>

      <Animated.FlatList
        ref={scroller}
        data={pages}
        keyExtractor={(p) => p}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        style={styles.pages}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
          listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => setPage(Math.round(e.nativeEvent.contentOffset.x / width)),
        })}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <View
            style={[styles.page, { width }]}
            accessible
            accessibilityLabel={`${pageText(t, item).title}. ${pageText(t, item).body}`}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    // The art drifts slower than the page: a little depth, nothing that moves on its own.
                    translateX: scrollX.interpolate({
                      inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                      outputRange: [width * 0.3, 0, -width * 0.3],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            >
              <Illustration name={item} theme={theme} size={art} />
            </Animated.View>
            <View style={styles.copy}>
              <Text style={[type.title, styles.center, { color: theme.text }]}>{pageText(t, item).title}</Text>
              <Text style={[type.body, styles.center, { color: theme.muted }]}>{pageText(t, item).body}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <Dots theme={theme} pages={pages} scrollX={scrollX} width={width} />
        {page === last && (
          <View style={styles.unit}>
            <Label theme={theme}>{t.welcome.unit}</Label>
            <Segmented
              theme={theme}
              label={t.settings.weightUnit}
              value={unit}
              onChange={setUnit}
              options={WEIGHT_UNITS.map((u) => ({ value: u, label: t.settings.units[u] }))}
            />
          </View>
        )}
        <Button
          theme={theme}
          label={page < last ? t.welcome.next : t.welcome.start}
          disabled={saving}
          onPress={() => (page < last ? goTo(page + 1) : start())}
        />
        {page === last && (
          <Text style={[type.small, styles.center, { color: theme.muted }]}>{t.welcome.footer}</Text>
        )}
      </View>
    </View>
  );
}

function Dots({ theme, pages, scrollX, width }: { theme: Theme; pages: readonly Page[]; scrollX: Animated.Value; width: number }) {
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pages.map((p, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        return (
          <Animated.View
            key={p}
            style={[
              styles.dot,
              {
                backgroundColor: theme.accent,
                width: scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: "clamp" }),
                opacity: scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: "clamp" }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, minHeight: 44 },
  wordmark: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  skip: { paddingVertical: space.s, paddingLeft: space.l },
  pages: { flexGrow: 1 },
  page: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, gap: space.xl },
  copy: { gap: space.m, maxWidth: 440 },
  center: { textAlign: "center" },
  bottom: { paddingHorizontal: space.xl, gap: space.l },
  dots: { flexDirection: "row", justifyContent: "center", gap: space.s, height: 8 },
  dot: { height: 8, borderRadius: radius.pill },
  unit: { gap: space.s },
});
