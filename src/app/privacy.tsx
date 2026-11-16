import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Messages } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { PRIVACY_POLICY_URL, PUBLISHER, SUPPORT_EMAIL } from "@/ui/copy";
import { Illustration } from "@/ui/Illustration";
import { Icon, type IconName } from "@/ui/icons";
import { Button, useScrollEndPadding } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";

const POINTS: readonly { key: keyof Messages["privacy"]["points"]; icon: IconName }[] = [
  { key: "device", icon: "lock" },
  { key: "healthConnect", icon: "heart" },
  { key: "reminders", icon: "bell" },
  { key: "exports", icon: "upload" },
  { key: "tracking", icon: "shield" },
  { key: "deletion", icon: "trash" },
];

/** Also the screen Health Connect opens when the user asks why Tenulo wants access. */
export default function PrivacyScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const endPadding = useScrollEndPadding();
  const { width } = useWindowDimensions();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}>
      <View style={styles.art}>
        <Illustration name="private" theme={theme} size={Math.min(width - space.xl * 2, 260)} />
      </View>
      <Text style={[type.body, { color: theme.text }]}>{t.privacy.intro}</Text>
      {POINTS.map((p) => (
        <Point key={p.key} theme={theme} icon={p.icon} {...t.privacy.points[p.key]} />
      ))}
      <Button theme={theme} kind="secondary" label={t.privacy.readPolicy} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} />
      <Text style={[type.small, { color: theme.muted }]}>{t.privacy.footer(PUBLISHER, SUPPORT_EMAIL)}</Text>
    </ScrollView>
  );
}

function Point({ theme, icon, title, body }: { theme: Theme; icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.point}>
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} color={theme.accent} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: theme.text }]}>{title}</Text>
        <Text style={[type.small, { color: theme.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.xl },
  art: { alignItems: "center" },
  point: { flexDirection: "row", gap: space.l, alignItems: "flex-start" },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
});
