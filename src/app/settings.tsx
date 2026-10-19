import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteAllData, setGoalWeight, setWeightUnit, useSettings } from "@/data/repo";
import { parseWeightInput } from "@/domain/parse";
import { type WeightUnit, weightNumber } from "@/domain/weight";
import { Button, Card, Label } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const PRIVACY_URL = "https://sabahattinkalkan.com/tenulo/privacy/";

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const unit: WeightUnit = settings?.weightUnit ?? "kg";
  const goalG = settings?.goalWeightG ?? null;

  const [goalText, setGoalText] = useState("");
  useEffect(() => setGoalText(goalG === null ? "" : weightNumber(goalG, unit)), [goalG, unit]);
  const goalParsed = parseWeightInput(goalText, unit);
  const goalChanged = goalText.trim() === "" ? goalG !== null : goalParsed.ok && goalParsed.grams !== goalG;

  const saveGoal = () => {
    if (goalText.trim() === "") void setGoalWeight(null);
    else if (goalParsed.ok) void setGoalWeight(goalParsed.grams);
  };

  const confirmDeleteAll = () =>
    Alert.alert(
      "Delete all data?",
      "Every weigh-in, injection, note and setting on this phone will be erased. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you sure?", "There is no copy anywhere else.", [
              { text: "Keep my data", style: "cancel" },
              { text: "Erase", style: "destructive", onPress: () => void deleteAllData() },
            ]),
        },
      ],
    );

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Card theme={theme}>
        <Label theme={theme}>Units</Label>
        <View style={[styles.segment, { borderColor: theme.border }]} accessibilityRole="radiogroup">
          {(["kg", "lb"] as const).map((u) => {
            const selected = u === unit;
            return (
              <Pressable
                key={u}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => void setWeightUnit(u)}
                style={[styles.segmentItem, selected && { backgroundColor: theme.accent }]}
              >
                <Text style={[styles.segmentText, { color: selected ? theme.accentText : theme.text }]}>
                  {u === "kg" ? "Kilograms" : "Pounds"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>Goal weight</Label>
        <View style={styles.goalRow}>
          <TextInput
            value={goalText}
            onChangeText={setGoalText}
            keyboardType="decimal-pad"
            maxLength={6}
            placeholder="Optional"
            placeholderTextColor={theme.muted}
            accessibilityLabel={`Goal weight in ${unit}`}
            style={[styles.goalInput, { color: theme.text, borderColor: theme.border }]}
          />
          <Text style={[styles.goalUnit, { color: theme.muted }]}>{unit}</Text>
        </View>
        {goalText.trim() !== "" && !goalParsed.ok && (
          <Text style={{ color: theme.danger }}>Enter a body weight like 75 or 75.5</Text>
        )}
        <Button theme={theme} kind="secondary" label="Save goal" onPress={saveGoal} disabled={!goalChanged} />
        <Text style={[styles.note, { color: theme.muted }]}>
          Used only to project a date from your trend. Leave empty to remove it.
        </Text>
      </Card>

      <Card theme={theme}>
        <Label theme={theme}>Privacy</Label>
        <Text style={[styles.body, { color: theme.text }]}>
          Tenulo has no account and no servers. Your records are stored only on this phone and are never sent
          anywhere unless you export them yourself.
        </Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={[styles.link, { color: theme.accent }]}>Read the privacy policy</Text>
        </Pressable>
        <Button theme={theme} kind="danger" label="Delete all data" onPress={confirmDeleteAll} />
      </Card>

      <Text style={[styles.disclaimer, { color: theme.muted }]}>
        Tenulo is a personal log. It does not give medical advice and does not recommend medications or doses.
        Always follow your doctor or pharmacist.
      </Text>
      <Text style={[styles.version, { color: theme.muted }]}>
        Tenulo {Constants.expoConfig?.version ?? ""}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.l, gap: space.l, paddingBottom: space.xxl },
  segment: { flexDirection: "row", borderWidth: 1.5, borderRadius: radius.m, overflow: "hidden" },
  segmentItem: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 16, fontWeight: "600" },
  goalRow: { flexDirection: "row", alignItems: "center", gap: space.s },
  goalInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "600",
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: space.m,
    minHeight: 52,
  },
  goalUnit: { fontSize: 18 },
  note: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 21 },
  link: { fontSize: 15, fontWeight: "600", paddingVertical: space.s },
  disclaimer: { fontSize: 13, lineHeight: 18, paddingHorizontal: space.s },
  version: { fontSize: 12, textAlign: "center" },
});
