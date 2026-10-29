import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { exportBackup, pickBackup, restoreBackup } from "@/data/backup";
import { syncHealthConnect } from "@/data/health-sync";
import { useActiveMedication } from "@/data/injections";
import {
  deleteAllData,
  setGoalWeight,
  setHealthConnectEnabled,
  setInjectionReminder,
  setWeighInReminder,
  setWeightUnit,
  today,
  useSettings,
} from "@/data/repo";
import { seedSampleData } from "@/data/sample";
import { parseWeightInput } from "@/domain/parse";
import { type WeightUnit, weightNumber } from "@/domain/weight";
import { setDevUnlocked, useIsPro, useProState } from "@/platform/billing";
import {
  type HealthConnectAvailability,
  healthConnectAvailability,
  openHealthConnect,
  requestWeightAccess,
} from "@/platform/health";
import { canNotify, remindersAvailable, requestNotificationPermission } from "@/platform/reminders";
import { TimeStepper } from "@/ui/TimeStepper";
import { backupProblem, restoreSummaryText, syncedText } from "@/ui/copy";
import { Button, ListRow, ProBadge, ScreenTitle, Section, Segmented, SwitchRow } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

const UNITS: readonly { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "Kilograms" },
  { value: "lb", label: "Pounds" },
];

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const medication = useActiveMedication();
  const isPro = useIsPro();
  const pro = useProState();
  const [busy, setBusy] = useState<string | undefined>();
  const [hc, setHc] = useState<HealthConnectAvailability | undefined>();

  useEffect(() => {
    let alive = true;
    void healthConnectAvailability().then((a) => alive && setHc(a));
    return () => {
      alive = false;
    };
  }, []);

  if (settings === undefined) return null;
  const unit = settings.weightUnit;

  /** Turns a reminder on only once Android lets Tenulo show notifications. */
  const enableReminder = async (save: () => Promise<void>) => {
    if (canNotify() || (await requestNotificationPermission())) {
      await save();
      return;
    }
    Alert.alert(
      "Notifications are off",
      "Allow notifications for Tenulo in Android settings to get reminders.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => void Linking.openSettings() },
      ],
    );
  };

  const run = async (key: string, task: () => Promise<void>) => {
    if (busy !== undefined) return;
    setBusy(key);
    try {
      await task();
    } catch (e) {
      Alert.alert("That did not work", errorText(e));
    } finally {
      setBusy(undefined);
    }
  };

  const toggleHealthConnect = (on: boolean) =>
    void run("hc", async () => {
      if (!on) {
        await setHealthConnectEnabled(false);
        return;
      }
      if (!isPro) {
        router.push("/pro");
        return;
      }
      if (!(await requestWeightAccess())) {
        Alert.alert("No access yet", "Allow Tenulo to read Weight in Health Connect, then turn this on again.", [
          { text: "OK" },
        ]);
        return;
      }
      await setHealthConnectEnabled(true);
      const result = await syncHealthConnect();
      if (result.kind === "synced") Alert.alert("Health Connect", restoreSummaryText({ weights: result.added }));
    });

  const restore = () =>
    void run("restore", async () => {
      const picked = await pickBackup();
      if (picked.canceled) return;
      if (!picked.ok) {
        Alert.alert("Cannot restore this file", backupProblem(picked));
        return;
      }
      const { backup } = picked;
      Alert.alert(
        "Restore this backup?",
        `Records in the backup that are not on this phone will be added. Nothing on this phone is changed or removed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            onPress: () =>
              void restoreBackup(backup)
                .then((summary) => Alert.alert("Backup restored", restoreSummaryText(summary)))
                .catch((e: unknown) => Alert.alert("Restore failed", errorText(e))),
          },
        ],
      );
    });

  const confirmDeleteAll = () =>
    Alert.alert(
      "Delete all data?",
      "Every weigh-in, injection, note, reminder and setting on this phone will be erased. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you sure?", "There is no copy anywhere else unless you made a backup.", [
              { text: "Keep my data", style: "cancel" },
              { text: "Erase", style: "destructive", onPress: () => void deleteAllData() },
            ]),
        },
      ],
    );

  const reminders = remindersAvailable();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle theme={theme} title="Settings" />

      {!isPro && <ProBanner theme={theme} pending={pro.pending} />}

      <Section theme={theme} title="Weight">
        <View style={styles.block}>
          <Segmented theme={theme} label="Weight unit" options={UNITS} value={unit} onChange={(u) => void setWeightUnit(u)} />
        </View>
        <GoalEditor theme={theme} unit={unit} goalG={settings.goalWeightG} />
      </Section>

      <Section
        theme={theme}
        title="Reminders"
        footer={
          reminders
            ? "Shown by this phone at the time you choose. The injection reminder follows your own schedule."
            : "Reminders need the installed app; they are not available in this build."
        }
      >
        <SwitchRow
          theme={theme}
          icon="bell"
          title="Injection day"
          detail={medication ? "On the day your schedule has your next shot" : "Add your medication first"}
          value={settings.injectionReminderEnabled}
          disabled={!reminders || medication === undefined}
          onChange={(on) =>
            void (on
              ? enableReminder(() => setInjectionReminder(true, settings.injectionReminderMinute))
              : setInjectionReminder(false, settings.injectionReminderMinute))
          }
        />
        {settings.injectionReminderEnabled && (
          <TimeStepper
            theme={theme}
            label="Injection reminder time"
            minute={settings.injectionReminderMinute}
            onChange={(m) => void setInjectionReminder(true, m)}
          />
        )}
        <SwitchRow
          theme={theme}
          icon="scale"
          title="Daily weigh-in"
          detail="Same time every day"
          value={settings.weighInReminderEnabled}
          disabled={!reminders}
          last={!settings.weighInReminderEnabled}
          onChange={(on) =>
            void (on
              ? enableReminder(() => setWeighInReminder(true, settings.weighInReminderMinute))
              : setWeighInReminder(false, settings.weighInReminderMinute))
          }
        />
        {settings.weighInReminderEnabled && (
          <TimeStepper
            theme={theme}
            label="Weigh-in reminder time"
            minute={settings.weighInReminderMinute}
            onChange={(m) => void setWeighInReminder(true, m)}
          />
        )}
      </Section>

      <Section
        theme={theme}
        title="Health Connect"
        footer="Read-only: Tenulo reads Weight and never writes to Health Connect. Manual entry keeps working either way."
      >
        <SwitchRow
          theme={theme}
          icon="heart"
          title="Read weight from Health Connect"
          detail={
            hc === "unavailable"
              ? "Health Connect is not available on this phone"
              : hc === "needs-update"
                ? "Update Health Connect from the Play Store first"
                : isPro
                  ? syncedText(settings.healthConnectEnabled, settings.healthConnectSyncedAt)
                  : "Smart-scale readings in your log · Pro"
          }
          value={settings.healthConnectEnabled && isPro}
          disabled={hc !== "available" || busy !== undefined}
          onChange={toggleHealthConnect}
          last={!(settings.healthConnectEnabled && isPro)}
        />
        {settings.healthConnectEnabled && isPro && (
          <>
            <ListRow
              theme={theme}
              title="Sync now"
              disabled={busy !== undefined}
              onPress={() =>
                void run("hc-sync", async () => {
                  const r = await syncHealthConnect();
                  if (r.kind === "no-access") Alert.alert("No access", "Tenulo can no longer read Weight in Health Connect.");
                  else if (r.kind === "synced") Alert.alert("Health Connect", restoreSummaryText({ weights: r.added }));
                })
              }
            />
            <ListRow theme={theme} title="Manage access" last onPress={openHealthConnect} />
          </>
        )}
      </Section>

      <Section theme={theme} title="Your data" footer="Files are created on this phone and go only where you send them.">
        <ListRow
          theme={theme}
          icon="report"
          title="Doctor report (PDF)"
          detail="Trend, injections and side effects for a period"
          right={isPro ? undefined : <ProBadge theme={theme} />}
          onPress={() => router.push(isPro ? "/report" : "/pro")}
        />
        <ListRow
          theme={theme}
          icon="upload"
          title="Back up to a file"
          detail="Everything, as one file you keep"
          disabled={busy !== undefined}
          onPress={() => void run("backup", exportBackup)}
        />
        <ListRow
          theme={theme}
          icon="download"
          title="Restore from a file"
          detail="Adds what is missing; changes nothing else"
          disabled={busy !== undefined}
          onPress={restore}
        />
        <ListRow theme={theme} icon="trash" title="Delete all data" danger last onPress={confirmDeleteAll} />
      </Section>

      <Section theme={theme} title="Medication">
        <ListRow
          theme={theme}
          icon="pen"
          title={medication ? medication.name : "Add your medication"}
          detail={medication ? "Your plan, dose changes and name" : "To track injections and your schedule"}
          last
          onPress={() => router.push(medication ? "/medication" : "/setup-medication")}
        />
      </Section>

      <Section theme={theme} title="About">
        <ListRow theme={theme} icon="shield" title="Privacy" detail="No account, no servers, no tracking" onPress={() => router.push("/privacy")} />
        {isPro && <ListRow theme={theme} icon="sparkle" title="Tenulo Pro" detail="Unlocked. Thank you for supporting Tenulo." />}
        {__DEV__ && (
          <>
            <SwitchRow
              theme={theme}
              title="Unlock Pro (development build)"
              detail="Not in release builds"
              value={pro.devUnlocked}
              onChange={setDevUnlocked}
            />
            <ListRow
              theme={theme}
              title="Load sample data (development build)"
              detail="Nine weeks of made-up entries, for trying the app"
              onPress={() => void run("sample", () => seedSampleData(today()))}
            />
          </>
        )}
        <ListRow theme={theme} title="Version" detail={`Tenulo ${Constants.expoConfig?.version ?? ""}`} last />
      </Section>

      <Text style={[type.small, styles.disclaimer, { color: theme.muted }]}>
        Tenulo is a personal log. It does not give medical advice and does not recommend medications or doses. Always
        follow your doctor or pharmacist.
      </Text>
    </ScrollView>
  );
}

function ProBanner({ theme, pending }: { theme: Theme; pending: boolean }) {
  return (
    <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.bannerText}>
        <View style={styles.bannerHead}>
          <Text style={[type.heading, { color: theme.text }]}>Tenulo Pro</Text>
          <ProBadge theme={theme} />
        </View>
        <Text style={[type.small, { color: theme.text }]}>
          {pending
            ? "Your purchase is pending with Google Play. Pro unlocks as soon as it is confirmed."
            : "A PDF report for your doctor and Health Connect sync. One purchase, no subscription."}
        </Text>
      </View>
      <Button theme={theme} label="See Pro" onPress={() => router.push("/pro")} />
    </View>
  );
}

function GoalEditor({ theme, unit, goalG }: { theme: Theme; unit: WeightUnit; goalG: number | null }) {
  // Undefined while not editing: the field shows the saved goal in the current unit.
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? (goalG === null ? "" : weightNumber(goalG, unit));
  const parsed = parseWeightInput(text, unit);
  const changed = text.trim() === "" ? goalG !== null : parsed.ok && parsed.grams !== goalG;
  const save = () => {
    const goal = text.trim() === "" ? null : parsed.ok ? parsed.grams : undefined;
    if (goal !== undefined) void setGoalWeight(goal).then(() => setDraft(undefined));
  };
  return (
    <View style={styles.block}>
      <Text style={[type.bodyStrong, { color: theme.text }]}>Goal weight</Text>
      <View style={styles.goalRow}>
        <TextInput
          value={text}
          onChangeText={setDraft}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          maxLength={6}
          placeholder="Optional"
          placeholderTextColor={theme.muted}
          accessibilityLabel={`Goal weight in ${unit}`}
          style={[styles.goalInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
        />
        <Text style={[type.bodyStrong, { color: theme.muted }]}>{unit}</Text>
        <Button theme={theme} kind="quiet" label="Save" onPress={save} disabled={!changed} />
      </View>
      {text.trim() !== "" && !parsed.ok && (
        <Text style={[type.small, { color: theme.danger }]}>Enter a body weight like 75 or 75.5</Text>
      )}
      <Text style={[type.small, { color: theme.muted }]}>Used only to project a date from your trend. Leave empty to remove it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.xl, paddingBottom: space.xxl },
  block: { paddingVertical: space.m, gap: space.s },
  goalRow: { flexDirection: "row", alignItems: "center", gap: space.s },
  goalInput: { flex: 1, fontSize: 20, fontWeight: "600", borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 50 },
  banner: { borderRadius: radius.l, padding: space.l, gap: space.m },
  bannerText: { gap: space.xs },
  bannerHead: { flexDirection: "row", alignItems: "center", gap: space.s },
  disclaimer: { paddingHorizontal: space.s, textAlign: "center" },
});
