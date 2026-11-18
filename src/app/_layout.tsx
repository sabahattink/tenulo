import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { type ErrorBoundaryProps, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from "react-native";
import migrations from "../../drizzle/migrations";
import { type StartState, ensureSettings, finishPendingPurge, readStartState, useSettings } from "@/data/repo";
import { useAppSync } from "@/data/use-app-sync";
import { db } from "@/db/client";
import { I18nProvider, useI18n } from "@/i18n/provider";
import { features } from "@/platform/features";
import { setNavigationBarLight } from "@/platform/system-bars";
import { Button } from "@/ui/kit";
import { type Theme, useTheme } from "@/ui/theme";

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  // Before the database is open there is no saved language: these screens follow the phone.
  const { t } = useI18n();
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    setNavigationBarLight(scheme !== "dark");
  }, [scheme]);
  const [start, setStart] = useState<StartState | undefined>();
  const [setupError, setSetupError] = useState<Error | undefined>();

  useEffect(() => {
    if (!success) return;
    ensureSettings()
      .then(() => {
        // Finishes a "Delete all data" that could not clear the database files last time. If it
        // fails again the marker stays, and the next start retries.
        finishPendingPurge();
        return readStartState();
      })
      .then(setStart)
      .catch((e: unknown) => setSetupError(e instanceof Error ? e : new Error(String(e))));
  }, [success]);

  const failure = error ?? setupError;
  if (failure) {
    // Never continue on a half-migrated database: show the failure instead of guessing.
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t.root.couldNotOpen}</Text>
        <Text style={[styles.detail, { color: theme.muted }]}>{failure.message}</Text>
      </View>
    );
  }

  if (start === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return <App theme={theme} start={start} />;
}

/** Mounted only once the database is migrated, so its live queries are safe. */
function App({ theme, start }: { theme: Theme; start: StartState }) {
  const settings = useSettings();
  // The live query is empty for its first render; the values read at start cover that moment.
  const welcomed = settings === undefined ? start.welcomed : settings.welcomedAt !== null;
  return (
    <I18nProvider preference={settings?.language ?? start.language}>
      <Navigator theme={theme} welcomed={welcomed} />
    </I18nProvider>
  );
}

/** Inside the language provider, so screen titles and reminder texts follow the user's choice. */
function Navigator({ theme, welcomed }: { theme: Theme; welcomed: boolean }) {
  useAppSync();
  const { t } = useI18n();
  const modal = { presentation: "modal" } as const;
  // The four medication routes redirect home in the narrow build; no header (and so no medication
  // title) is ever drawn for them, not even for a frame.
  const hidden = features.medication ? {} : ({ headerShown: false } as const);
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
          <Stack.Screen name="add-weight" options={{ title: t.screens.addWeight, ...modal }} />
          <Stack.Screen name="setup-medication" options={{ title: t.screens.setupMedication, ...modal, ...hidden }} />
          <Stack.Screen name="log-injection" options={{ title: t.screens.logInjection, ...modal, ...hidden }} />
          <Stack.Screen name="log-side-effect" options={{ title: t.screens.logSideEffect, ...modal, ...hidden }} />
          <Stack.Screen name="water" options={{ title: t.waterLog.title, ...modal }} />
          <Stack.Screen name="log-exercise" options={{ title: t.exerciseLog.title, ...modal }} />
          <Stack.Screen name="report" options={{ title: features.medication ? t.screens.report : t.screens.narrow.report, ...modal }} />
          <Stack.Screen name="pro" options={{ title: t.screens.pro, ...modal }} />
          <Stack.Screen name="medication" options={{ title: t.screens.medication, ...hidden }} />
          <Stack.Screen name="privacy" options={{ title: t.screens.privacy }} />
          {/* Food & goals. The portion step, quick add and the custom-food form set their own titles. */}
          <Stack.Screen name="food/add" options={{ title: t.food.add.title, ...modal }} />
          <Stack.Screen name="food/portion" options={{ title: t.food.add.title, ...modal }} />
          <Stack.Screen name="food/quick" options={{ title: t.food.quick.title, ...modal }} />
          <Stack.Screen name="food/entry" options={{ title: t.food.entry.title, ...modal }} />
          <Stack.Screen name="food/mine" options={{ title: t.food.mine.title }} />
          <Stack.Screen name="food/custom" options={{ title: t.food.custom.newTitle }} />
          <Stack.Screen name="goals" options={{ title: t.goals.title }} />
          <Stack.Screen name="add-measurement" options={{ title: t.measure.addTitle, ...modal }} />
          <Stack.Screen name="measurements" options={{ title: t.measure.readingsTitle }} />
        </Stack.Protected>
        <Stack.Protected guard={!welcomed}>
          <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/**
 * Expo Router wraps this layout, and so the whole app, in this boundary. A render error (for
 * example a record that no longer parses) shows this screen instead of closing the app. Nothing is
 * reported anywhere: Tenulo sends no data off the phone. It sits outside the language provider, so
 * it speaks the phone's language.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t.root.crashed}</Text>
      <Text style={[styles.detail, { color: theme.muted }]}>{error.message}</Text>
      <View style={styles.retry}>
        <Button theme={theme} label={t.root.tryAgain} onPress={() => void retry()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  retry: { marginTop: 16, alignSelf: "stretch" },
  title: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  detail: { fontSize: 13, textAlign: "center" },
});
