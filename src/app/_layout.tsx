import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import migrations from "../../drizzle/migrations";
import { db } from "@/db/client";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    // Never continue on a half-migrated database: show the failure instead of guessing.
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Tenulo could not open its data</Text>
        <Text style={styles.detail}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  detail: { fontSize: 13, opacity: 0.7, textAlign: "center" },
});
