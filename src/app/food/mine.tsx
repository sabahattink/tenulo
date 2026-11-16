import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { type CustomFood, useCustomFoods } from "@/data/food";
import { sortByName } from "@/domain/food-entry";
import { useI18n } from "@/i18n/provider";
import { kcalText } from "@/ui/food/units";
import { Icon } from "@/ui/icons";
import { Button, useScrollEndPadding } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

/** `/food/mine`: the user's own foods, to edit or delete; and a way to add one. */
export default function MyFoods() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const custom = useCustomFoods();
  const foods = useMemo(() => sortByName(custom, lang), [custom, lang]);

  return (
    <FlatList
      data={foods}
      keyExtractor={(food) => food.id}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[type.body, { color: theme.muted }]}>{t.food.mine.intro}</Text>
          <Button theme={theme} kind="quiet" icon="plus" label={t.food.mine.add} onPress={() => router.push("/food/custom")} />
        </View>
      }
      ListEmptyComponent={<Text style={[type.body, styles.empty, { color: theme.muted }]}>{t.food.mine.empty}</Text>}
      renderItem={({ item }) => (
        <FoodCard theme={theme} food={item} onPress={() => router.push({ pathname: "/food/custom", params: { id: item.id } })} />
      )}
    />
  );
}

/** A food in its own small card: name, serving and its energy. */
function FoodCard({ theme, food, onPress }: { theme: Theme; food: CustomFood; onPress: () => void }) {
  const i18n = useI18n();
  const detail = `${food.servingLabel} · ${kcalText(i18n, food.energyKcal)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={[type.small, { color: theme.muted }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Icon name="chevron" color={theme.muted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.l, gap: space.s },
  header: { gap: space.l, paddingBottom: space.m },
  empty: { textAlign: "center", paddingVertical: space.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.l,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  text: { flex: 1, gap: 2 },
});
