import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { LocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { Illustration } from "../Illustration";
import { Button, Card } from "../kit";
import { type Theme, space, type } from "../theme";
import { routes } from "./routes";

const ART = 132;

/** Nothing logged yet: one calm invitation to the first weigh-in and the first meal. */
export function FirstRunCard({ theme, date }: { theme: Theme; date: LocalDate }) {
  const { t } = useI18n();
  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.top}>
        <Illustration name="food" theme={theme} size={ART} />
        <View style={styles.copy}>
          <Text style={[type.heading, styles.center, { color: theme.text }]}>{t.daily.firstRunTitle}</Text>
          <Text style={[type.small, styles.center, { color: theme.muted }]}>{t.daily.firstRunBody}</Text>
        </View>
      </View>
      <Button theme={theme} icon="plus" label={t.today.logWeight} onPress={() => router.push(routes.addWeight())} />
      <Button
        theme={theme}
        kind="quiet"
        icon="plus"
        label={t.daily.firstMeal}
        onPress={() => router.push(routes.foodAddNow(date))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m, padding: space.xl },
  top: { alignItems: "center", gap: space.l, marginBottom: space.s },
  copy: { gap: space.s },
  center: { textAlign: "center" },
});
