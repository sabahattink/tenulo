import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFoodDay } from "@/data/food";
import { useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type LocalDate, addDays, diffDays, isLocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { FoodDay } from "@/ui/food/FoodDay";
import { ScreenTitle } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

/** A date from the link (`/food?date=YYYY-MM-DD`, e.g. from History); never a future day. */
function linkedDate(param: string | undefined, today: LocalDate): LocalDate | undefined {
  if (param === undefined || !isLocalDate(param)) return undefined;
  return diffDays(param, today) >= 0 ? param : undefined;
}

export default function FoodScreen() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const settings = useSettings();
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();

  // Undefined means "today", so the screen moves on by itself at midnight.
  const [picked, setPicked] = useState<LocalDate | undefined>();
  // A new link moves the pager once; paging afterwards is the user's own.
  const linked = linkedDate(params.date, today);
  const [followed, setFollowed] = useState<LocalDate | undefined>();
  if (linked !== followed) {
    setFollowed(linked);
    if (linked !== undefined) setPicked(linked === today ? undefined : linked);
  }
  useEffect(() => {
    // Consumed, so the same link followed again later opens that day again.
    if (linked !== undefined) router.setParams({ date: undefined });
  }, [linked, router]);

  const date = picked ?? today;
  const entries = useFoodDay(date);
  const previous = useFoodDay(addDays(date, -1));

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
    >
      <ScreenTitle theme={theme} eyebrow={f.longWeekday(date)} title={t.food.title} />
      <FoodDay
        theme={theme}
        date={date}
        today={today}
        onDate={(d) => setPicked(d === today ? undefined : d)}
        entries={entries}
        previous={previous}
        energyGoalKcal={settings?.energyGoalKcal ?? null}
        proteinGoalG={settings?.proteinGoalG ?? null}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.l, paddingBottom: space.xxl },
});
