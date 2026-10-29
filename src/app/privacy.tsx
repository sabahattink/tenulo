import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/ui/icons";
import { Button } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";

const PRIVACY_URL = "https://sabahattinkalkan.com/tenulo/privacy/";

const POINTS: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "On this phone only",
    body: "Your weigh-ins, injections, side effects and notes are stored in Tenulo's own database on this phone. There is no account and no Tenulo server.",
  },
  {
    icon: "heart",
    title: "Health Connect: read-only, weight only",
    body: "With your permission, Tenulo reads weight records to show smart-scale readings in your log. It never writes to Health Connect, and the data is used only for your weight history and trend inside the app.",
  },
  {
    icon: "bell",
    title: "Reminders are local",
    body: "Injection and weigh-in reminders are scheduled by Android on this phone. No reminder passes through a server.",
  },
  {
    icon: "upload",
    title: "You decide what leaves",
    body: "A PDF report or a backup file is created on this phone and goes only where you send it. Android cloud backup is turned off for Tenulo.",
  },
  {
    icon: "shield",
    title: "No tracking",
    body: "No analytics, ads or crash reporting. Google Play Billing confirms a Pro purchase; Tenulo never sees your name or payment details.",
  },
  {
    icon: "trash",
    title: "Delete any time",
    body: "Delete single entries from History, or everything from Settings. Uninstalling Tenulo removes all of its data.",
  },
];

/** Also the screen Health Connect opens when the user asks why Tenulo wants access. */
export default function PrivacyScreen() {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Text style={[type.body, { color: theme.text }]}>
        Tenulo is a private log for your weight and your GLP-1 medication. Here is what that means in practice.
      </Text>
      {POINTS.map((p) => (
        <Point key={p.title} theme={theme} {...p} />
      ))}
      <Button theme={theme} kind="secondary" label="Read the full privacy policy" onPress={() => void Linking.openURL(PRIVACY_URL)} />
      <Text style={[type.small, { color: theme.muted }]}>
        Questions: hello@sabahattinkalkan.com. Tenulo is meant for adults 18 and over. It is a personal log, not medical
        advice, and it does not recommend medications or doses.
      </Text>
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
  content: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  point: { flexDirection: "row", gap: space.l, alignItems: "flex-start" },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
});
