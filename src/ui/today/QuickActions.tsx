import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LocalDate } from "@/domain/date";
import type { Messages } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { Icon, type IconName } from "../icons";
import { Label } from "../kit";
import { type Kind, type Theme, radius, space } from "../theme";
import { routes } from "./routes";
import { mlText } from "./texts";
import type { WaterActions } from "./use-water-actions";

type Action = keyof Messages["daily"]["actions"];

/** Each tile wears its kind's tint, the same color the record has in rings and in History. */
const ACTIONS: readonly { action: Action; icon: IconName; kind: Kind }[] = [
  { action: "food", icon: "food", kind: "food" },
  { action: "water", icon: "glass", kind: "water" },
  { action: "weight", icon: "scale", kind: "weight" },
  { action: "measurement", icon: "tape", kind: "measurement" },
  { action: "exercise", icon: "run", kind: "exercise" },
  { action: "sideEffect", icon: "face", kind: "sideEffect" },
];

/** Every log one tap away. Water logs a glass right here; the others open their screen. */
export function QuickActions({
  theme,
  date,
  servingMl,
  water,
}: {
  theme: Theme;
  date: LocalDate;
  servingMl: number;
  water: WaterActions;
}) {
  const i18n = useI18n();
  const { t } = i18n;

  const run = (action: Action) => {
    switch (action) {
      case "food":
        return router.push(routes.foodAddNow(date));
      case "water":
        return water.add(servingMl);
      case "weight":
        return router.push(routes.addWeight());
      case "measurement":
        return router.push(routes.addMeasurement(date));
      case "exercise":
        return router.push(routes.logExercise(date));
      case "sideEffect":
        return router.push(routes.logSideEffect());
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Label theme={theme}>{t.daily.quickLog}</Label>
      </View>
      <View style={styles.grid}>
        {ACTIONS.map(({ action, icon, kind }) => {
          const isWater = action === "water";
          const { ink, soft } = theme.kinds[kind];
          return (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={isWater ? t.daily.addGlassLabel(mlText(i18n, servingMl)) : t.daily.actions[action]}
              onPress={() => run(action)}
              style={({ pressed }) => [styles.tile, { backgroundColor: soft, opacity: pressed ? 0.85 : 1 }, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: theme.card }]}>
                <Icon name={icon} color={ink} size={22} />
              </View>
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                {t.daily.actions[action]}
              </Text>
              {isWater && (
                <Text style={[styles.detail, { color: ink }]} numberOfLines={1}>
                  +{mlText(i18n, servingMl)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s },
  head: { paddingHorizontal: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  tile: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 96,
    borderRadius: radius.l,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: space.m,
    paddingHorizontal: space.xs,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  detail: { fontSize: 12, lineHeight: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
