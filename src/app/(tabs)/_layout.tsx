import { Tabs } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Messages } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { Icon, type IconName } from "@/ui/icons";
import { useTheme } from "@/ui/theme";

/** In order: Today, Food, Progress, History, Settings. A tab's title comes from its own messages. */
const TABS: readonly { name: string; title: (t: Messages) => string; icon: IconName }[] = [
  { name: "index", title: (t) => t.tabs.today, icon: "today" },
  { name: "food", title: (t) => t.food.tab, icon: "food" },
  { name: "progress", title: (t) => t.progress.tab, icon: "progress" },
  { name: "history", title: (t) => t.tabs.history, icon: "history" },
  { name: "settings", title: (t) => t.tabs.settings, icon: "settings" },
];

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.muted,
          tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.border },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
          tabBarIconStyle: { width: INDICATOR_WIDTH },
          tabBarHideOnKeyboard: true,
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title(t),
              tabBarIcon: ({ color, focused }) => (
                <View style={[styles.indicator, focused && { backgroundColor: theme.accentSoft }]}>
                  <Icon name={tab.icon} color={color} size={24} />
                </View>
              ),
            }}
          />
        ))}
      </Tabs>
      {/* The tabs draw edge to edge; without this, scrolled cards slide under the clock and icons. It
          has the color the title's wash starts with, so at rest the two meet without a seam. */}
      <View style={[styles.statusBar, { height: insets.top, backgroundColor: theme.wash }]} />
    </View>
  );
}

/** Material 3's active indicator: a pill behind the selected destination's icon. */
const INDICATOR_WIDTH = 60;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  indicator: { width: INDICATOR_WIDTH, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusBar: { position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none" },
});
