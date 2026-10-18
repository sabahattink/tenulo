import { count } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { db } from "@/db/client";
import { weightEntries } from "@/db/schema";

/** Placeholder home screen: proves the database opened and migrated on a real device. */
export default function Home() {
  const { data } = useLiveQuery(db.select({ n: count() }).from(weightEntries));
  const entries = data[0]?.n ?? 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Tenulo" }} />
      <Text style={styles.title}>Tenulo</Text>
      <Text style={styles.detail}>Database ready · {entries} weight entries</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
  detail: { fontSize: 14, opacity: 0.7 },
});
