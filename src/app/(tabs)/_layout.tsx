import { Tabs } from "expo-router/tabs";
import { Icon, type IconName } from "@/ui/icons";
import { useTheme } from "@/ui/theme";

const TABS: readonly { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Today", icon: "today" },
  { name: "history", title: "History", icon: "history" },
  { name: "settings", title: "Settings", icon: "settings" },
];

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarHideOnKeyboard: true,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color }) => <Icon name={t.icon} color={color} size={24} /> }}
        />
      ))}
    </Tabs>
  );
}
