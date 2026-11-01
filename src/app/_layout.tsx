import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from "react-native";
import migrations from "../../drizzle/migrations";
import { ensureSettings, readWelcomed, useSettings } from "@/data/repo";
import { useAppSync } from "@/data/use-app-sync";
import { db } from "@/db/client";
import { setNavigationBarLight } from "@/platform/system-bars";
import { type Theme, useTheme } from "@/ui/theme";

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    setNavigationBarLight(scheme !== "dark");
  }, [scheme]);
  const [welcomed, setWelcomed] = useState<boolean | undefined>();
  const [setupError, setSetupError] = useState<Error | undefined>();

  useEffect(() => {
    if (!success) return;
    ensureSettings()
      .then(() => readWelcomed())
      .then(setWelcomed)
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

  if (welcomed === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return <App theme={theme} initiallyWelcomed={welcomed} />;
}

/** Mounted only once the database is migrated, so its live queries are safe. */
function App({ theme, initiallyWelcomed }: { theme: Theme; initiallyWelcomed: boolean }) {
  useAppSync();
  const settings = useSettings();
  // The live query is empty for its first render; the value read at start covers that moment.
  const welcomed = settings === undefined ? initiallyWelcomed : settings.welcomedAt !== null;
  const modal = { presentation: "modal" } as const;
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* Finishing the welcome screens, or "Delete all data", flips the guards and the router follows. */}
        <Stack.Protected guard={welcomed}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-weight" options={{ title: "Log weight", ...modal }} />
          <Stack.Screen name="setup-medication" options={{ title: "Your medication", ...modal }} />
          <Stack.Screen name="log-injection" options={{ title: "Log injection", ...modal }} />
          <Stack.Screen name="log-side-effect" options={{ title: "Log side effect", ...modal }} />
          <Stack.Screen name="report" options={{ title: "Doctor report", ...modal }} />
          <Stack.Screen name="pro" options={{ title: "Tenulo Pro", ...modal }} />
          <Stack.Screen name="medication" options={{ title: "Medication & plan" }} />
          <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
        </Stack.Protected>
        <Stack.Protected guard={!welcomed}>
          <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  detail: { fontSize: 13, textAlign: "center" },
});
