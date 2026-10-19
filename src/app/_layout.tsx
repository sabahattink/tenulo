import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import migrations from "../../drizzle/migrations";
import { ensureSettings } from "@/data/repo";
import { db } from "@/db/client";
import { useTheme } from "@/ui/theme";

export default function RootLayout() {
  const theme = useTheme();
  const { success, error } = useMigrations(db, migrations);
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState<Error | undefined>();

  useEffect(() => {
    if (!success) return;
    ensureSettings()
      .then(() => setReady(true))
      .catch((e: unknown) => setSetupError(e instanceof Error ? e : new Error(String(e))));
  }, [success]);

  const failure = error ?? setupError;
  if (failure) {
    // Never continue on a half-migrated database: show the failure instead of guessing.
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Tenulo could not open its data</Text>
        <Text style={[styles.detail, { color: theme.muted }]}>{failure.message}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Tenulo" }} />
        <Stack.Screen name="add-weight" options={{ title: "Log weight", presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  detail: { fontSize: 13, textAlign: "center" },
});
