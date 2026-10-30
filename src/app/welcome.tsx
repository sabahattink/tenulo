import { useRef, useState } from "react";
import { Alert, Animated, type FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { finishWelcome } from "@/data/repo";
import { type WeightUnit, defaultWeightUnit } from "@/domain/weight";
import { Illustration, type IllustrationName } from "@/ui/Illustration";
import { Button, Label, Segmented } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

type Page = { illustration: IllustrationName; title: string; body: string };

const PAGES: readonly Page[] = [
  {
    illustration: "trend",
    title: "Your trend, not the noise",
    body: "Daily weight jumps around with water and salt. Tenulo draws the calm line underneath, so you can see where you are really heading.",
  },
  {
    illustration: "plan",
    title: "Your plan, shown back to you",
    body: "Enter the dose schedule from your prescription. Tenulo shows which week you are in and when the next injection is due. It never suggests a medication or a dose.",
  },
  {
    illustration: "private",
    title: "It stays on this phone",
    body: "No account, no analytics, no ads. Your records leave this phone only when you export them yourself.",
  },
];

const LAST = PAGES.length - 1;

/** The unit the phone's region most likely uses; the user still chooses. */
function deviceUnit(): WeightUnit {
  try {
    return defaultWeightUnit(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "kg";
  }
}

/**
 * First launch, and again after "Delete all data": three pages, then the unit. Finishing sets
 * settings.welcomed_at; the root layout's guard then opens Today.
 */
export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
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
      Alert.alert("That did not work", e instanceof Error ? e.message : "Please try again.");
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + space.s, paddingBottom: insets.bottom + space.l }]}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>Tenulo</Text>
        {page < LAST && (
          <Pressable accessibilityRole="button" onPress={() => goTo(LAST)} hitSlop={12} style={styles.skip}>
            <Text style={[type.bodyStrong, { color: theme.muted }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Animated.FlatList
        ref={scroller}
        data={PAGES}
        keyExtractor={(p) => p.illustration}
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
          <View style={[styles.page, { width }]} accessible accessibilityLabel={`${item.title}. ${item.body}`}>
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
              <Illustration name={item.illustration} theme={theme} size={art} />
            </Animated.View>
            <View style={styles.copy}>
              <Text style={[type.title, styles.center, { color: theme.text }]}>{item.title}</Text>
              <Text style={[type.body, styles.center, { color: theme.muted }]}>{item.body}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <Dots theme={theme} scrollX={scrollX} width={width} />
        {page === LAST && (
          <View style={styles.unit}>
            <Label theme={theme}>I weigh myself in</Label>
            <Segmented
              theme={theme}
              label="Weight unit"
              value={unit}
              onChange={setUnit}
              options={[
                { value: "kg", label: "Kilograms" },
                { value: "lb", label: "Pounds" },
              ]}
            />
          </View>
        )}
        <Button
          theme={theme}
          label={page < LAST ? "Next" : "Start my log"}
          disabled={saving}
          onPress={() => (page < LAST ? goTo(page + 1) : start())}
        />
        {page === LAST && (
          <Text style={[type.small, styles.center, { color: theme.muted }]}>A personal log for adults. Not medical advice.</Text>
        )}
      </View>
    </View>
  );
}

function Dots({ theme, scrollX, width }: { theme: Theme; scrollX: Animated.Value; width: number }) {
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PAGES.map((p, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        return (
          <Animated.View
            key={p.illustration}
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
