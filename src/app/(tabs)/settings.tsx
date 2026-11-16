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
  setLanguage,
  setWeighInReminder,
  setWeightUnit,
  today,
  useSettings,
} from "@/data/repo";
import { seedSampleData } from "@/data/sample";
import type { LanguagePreference } from "@/domain/language";
import { parseWeightInput } from "@/domain/parse";
import { WEIGHT_UNITS, type WeightUnit } from "@/domain/weight";
import { useI18n } from "@/i18n/provider";
import { setDevUnlocked, useIsPro, useProState } from "@/platform/billing";
import {
  type HealthConnectAvailability,
  healthConnectAvailability,
  openHealthConnect,
  requestWeightAccess,
} from "@/platform/health";
import { canNotify, remindersAvailable, requestNotificationPermission } from "@/platform/reminders";
import { TimeStepper } from "@/ui/TimeStepper";
import { PUBLISHER } from "@/ui/copy";
import { Button, ListRow, ProBadge, ScreenTitle, Section, Segmented, SwitchRow } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

/** Each language is named in itself, so it can be found from either one. */
const LANGUAGE_NAMES = { tr: "Türkçe", en: "English" } as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, f } = useI18n();
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

  if (settings === undefined) {
    return (
      <View style={[styles.content, { paddingTop: insets.top + space.l, backgroundColor: theme.background, flex: 1 }]}>
        <ScreenTitle theme={theme} title={t.settings.title} />
      </View>
    );
  }
  const unit = settings.weightUnit;
  const errorText = (e: unknown) => (e instanceof Error ? e.message : t.common.somethingWentWrong);

  /** Fire-and-forget writes still report failure instead of silently doing nothing. */
  const save = (task: Promise<unknown>) => {
    task.catch((e: unknown) => Alert.alert(t.common.didNotWork, errorText(e)));
  };

  /** Turns a reminder on only once Android lets Tenulo show notifications. */
  const enableReminder = async (save: () => Promise<void>) => {
    if (canNotify() || (await requestNotificationPermission())) {
      await save();
      return;
    }
    Alert.alert(t.settings.reminders.notificationsOffTitle, t.settings.reminders.notificationsOffBody, [
      { text: t.settings.reminders.notNow, style: "cancel" },
      { text: t.settings.reminders.openSettings, onPress: () => void Linking.openSettings() },
    ]);
  };

  const run = async (key: string, task: () => Promise<void>) => {
    if (busy !== undefined) return;
    setBusy(key);
    try {
      await task();
    } catch (e) {
      Alert.alert(t.common.didNotWork, errorText(e));
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
        Alert.alert(t.settings.healthConnect.noAccessYetTitle, t.settings.healthConnect.noAccessYetBody, [{ text: t.common.ok }]);
        return;
      }
      await setHealthConnectEnabled(true);
      const result = await syncHealthConnect();
      if (result.kind === "synced") Alert.alert(t.settings.healthConnect.title, f.healthSync(result));
    });

  const restore = () =>
    void run("restore", async () => {
      const picked = await pickBackup();
      if (picked.canceled) return;
      if (!picked.ok) {
        Alert.alert(t.settings.data.cannotRestore, f.backupProblem(picked));
        return;
      }
      const { backup } = picked;
      Alert.alert(t.settings.data.restoreTitle, t.settings.data.restoreBody, [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.settings.data.restoreAction,
          onPress: () => {
            try {
              const summary = restoreBackup(backup);
              const inactive = summary.inactiveMedications === 0 ? [] : [t.settings.data.inactiveMedications(summary.inactiveMedications)];
              Alert.alert(t.settings.data.restoredTitle, [f.restoreSummary(summary), ...inactive].join(" "));
            } catch (e) {
              Alert.alert(t.settings.data.restoreFailedTitle, t.settings.data.restoreFailedBody(errorText(e)));
            }
          },
        },
      ]);
    });

  const confirmDeleteAll = () =>
    Alert.alert(t.settings.data.deleteAllTitle, t.settings.data.deleteAllBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.settings.data.deleteEverything,
        style: "destructive",
        onPress: () =>
          Alert.alert(t.settings.data.sureTitle, t.settings.data.sureBody, [
            { text: t.settings.data.keep, style: "cancel" },
            {
              text: t.settings.data.erase,
              style: "destructive",
              onPress: () =>
                void run("delete", async () => {
                  const { filesCleared } = await deleteAllData();
                  Alert.alert(
                    t.settings.data.deletedTitle,
                    filesCleared ? t.settings.data.deletedBody : t.settings.data.deletedPendingBody,
                  );
                }),
            },
          ]),
      },
    ]);

  const reminders = remindersAvailable();
  const languages: readonly { value: LanguagePreference; label: string }[] = [
    { value: "system", label: t.settings.language.system },
    { value: "tr", label: LANGUAGE_NAMES.tr },
    { value: "en", label: LANGUAGE_NAMES.en },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle theme={theme} title={t.settings.title} />

      {!isPro && <ProBanner theme={theme} pending={pro.pending} />}

      <Section theme={theme} title={t.settings.language.title} footer={t.settings.language.footer}>
        <View style={styles.block}>
          <Segmented
            theme={theme}
            label={t.settings.language.title}
            options={languages}
            value={settings.language}
            onChange={(l) => save(setLanguage(l))}
          />
        </View>
      </Section>

      <Section theme={theme} title={t.settings.weight}>
        <View style={styles.block}>
          <Segmented
            theme={theme}
            label={t.settings.weightUnit}
            options={WEIGHT_UNITS.map((u) => ({ value: u, label: t.settings.units[u] }))}
            value={unit}
            onChange={(u) => save(setWeightUnit(u))}
          />
        </View>
        <GoalEditor theme={theme} unit={unit} goalG={settings.goalWeightG} />
      </Section>

      <Section theme={theme} title={t.food.settings.section}>
        <ListRow theme={theme} icon="target" title={t.food.settings.goals} detail={t.food.settings.goalsDetail} onPress={() => router.push("/goals")} />
        <ListRow theme={theme} icon="food" title={t.food.settings.mine} detail={t.food.settings.mineDetail} last onPress={() => router.push("/food/mine")} />
      </Section>

      <Section
        theme={theme}
        title={t.settings.reminders.title}
        footer={reminders ? t.settings.reminders.footer : t.settings.reminders.footerUnavailable}
      >
        <SwitchRow
          theme={theme}
          icon="bell"
          title={t.settings.reminders.injection}
          detail={medication ? t.settings.reminders.injectionDetail : t.settings.reminders.addMedicationFirst}
          value={settings.injectionReminderEnabled}
          disabled={!reminders || medication === undefined}
          onChange={(on) =>
            save(
              on
                ? enableReminder(() => setInjectionReminder(true, settings.injectionReminderMinute))
                : setInjectionReminder(false, settings.injectionReminderMinute),
            )
          }
        />
        {settings.injectionReminderEnabled && (
          <TimeStepper
            theme={theme}
            label={t.settings.reminders.injectionTime}
            minute={settings.injectionReminderMinute}
            onChange={(m) => save(setInjectionReminder(true, m))}
          />
        )}
        <SwitchRow
          theme={theme}
          icon="scale"
          title={t.settings.reminders.weighIn}
          detail={t.settings.reminders.weighInDetail}
          value={settings.weighInReminderEnabled}
          disabled={!reminders}
          last={!settings.weighInReminderEnabled}
          onChange={(on) =>
            save(
              on
                ? enableReminder(() => setWeighInReminder(true, settings.weighInReminderMinute))
                : setWeighInReminder(false, settings.weighInReminderMinute),
            )
          }
        />
        {settings.weighInReminderEnabled && (
          <TimeStepper
            theme={theme}
            label={t.settings.reminders.weighInTime}
            minute={settings.weighInReminderMinute}
            onChange={(m) => save(setWeighInReminder(true, m))}
          />
        )}
      </Section>

      <Section theme={theme} title={t.settings.healthConnect.title} footer={t.settings.healthConnect.footer}>
        <SwitchRow
          theme={theme}
          icon="heart"
          title={t.settings.healthConnect.read}
          detail={
            hc === "unavailable"
              ? t.settings.healthConnect.unavailable
              : hc === "needs-update"
                ? t.settings.healthConnect.needsUpdate
                : isPro
                  ? f.synced(settings.healthConnectEnabled, settings.healthConnectSyncedAt)
                  : t.settings.healthConnect.proDetail
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
              title={t.settings.healthConnect.syncNow}
              disabled={busy !== undefined}
              onPress={() =>
                void run("hc-sync", async () => {
                  const r = await syncHealthConnect();
                  if (r.kind === "no-access") Alert.alert(t.settings.healthConnect.noAccessTitle, t.settings.healthConnect.noAccessBody);
                  else if (r.kind === "synced") Alert.alert(t.settings.healthConnect.title, f.healthSync(r));
                })
              }
            />
            <ListRow theme={theme} title={t.settings.healthConnect.manageAccess} last onPress={openHealthConnect} />
          </>
        )}
      </Section>

      <Section theme={theme} title={t.settings.data.title} footer={t.settings.data.footer}>
        <ListRow
          theme={theme}
          icon="report"
          title={t.settings.data.report}
          detail={t.settings.data.reportDetail}
          right={isPro ? undefined : <ProBadge theme={theme} />}
          onPress={() => router.push(isPro ? "/report" : "/pro")}
        />
        <ListRow
          theme={theme}
          icon="upload"
          title={t.settings.data.backup}
          detail={t.settings.data.backupDetail}
          disabled={busy !== undefined}
          onPress={() => void run("backup", () => exportBackup(t.settings.data.backupShareTitle))}
        />
        <ListRow
          theme={theme}
          icon="download"
          title={t.settings.data.restore}
          detail={t.settings.data.restoreDetail}
          disabled={busy !== undefined}
          onPress={restore}
        />
        <ListRow theme={theme} icon="trash" title={t.settings.data.deleteAll} danger last onPress={confirmDeleteAll} />
      </Section>

      <Section theme={theme} title={t.settings.medication.title}>
        <ListRow
          theme={theme}
          icon="pen"
          title={medication ? medication.name : t.settings.medication.add}
          detail={medication ? t.settings.medication.detail : t.settings.medication.addDetail}
          last
          onPress={() => router.push(medication ? "/medication" : "/setup-medication")}
        />
      </Section>

      <Section theme={theme} title={t.settings.about.title}>
        <ListRow
          theme={theme}
          icon="shield"
          title={t.settings.about.privacy}
          detail={t.settings.about.privacyDetail}
          onPress={() => router.push("/privacy")}
        />
        {isPro && <ListRow theme={theme} icon="sparkle" title="Tenulo Pro" detail={t.settings.about.proDetail} />}
        {__DEV__ && (
          <>
            <SwitchRow
              theme={theme}
              title={t.settings.about.devUnlock}
              detail={t.settings.about.devUnlockDetail}
              value={pro.devUnlocked}
              onChange={setDevUnlocked}
            />
            <ListRow
              theme={theme}
              title={t.settings.about.devSample}
              detail={t.settings.about.devSampleDetail}
              onPress={() => void run("sample", async () => seedSampleData(today()))}
            />
          </>
        )}
        <ListRow
          theme={theme}
          title={t.settings.about.version}
          detail={`Tenulo ${Constants.expoConfig?.version ?? ""} · ${PUBLISHER}`}
          last
        />
      </Section>

      <Text style={[type.small, styles.disclaimer, { color: theme.muted }]}>{t.settings.disclaimer}</Text>
    </ScrollView>
  );
}

function ProBanner({ theme, pending }: { theme: Theme; pending: boolean }) {
  const { t } = useI18n();
  return (
    <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.bannerText}>
        <View style={styles.bannerHead}>
          <Text style={[type.heading, { color: theme.text }]}>Tenulo Pro</Text>
          <ProBadge theme={theme} />
        </View>
        <Text style={[type.small, { color: theme.text }]}>
          {pending ? t.settings.proBanner.pending : t.settings.proBanner.pitch}
        </Text>
      </View>
      <Button theme={theme} label={t.common.seePro} onPress={() => router.push("/pro")} />
    </View>
  );
}

function GoalEditor({ theme, unit, goalG }: { theme: Theme; unit: WeightUnit; goalG: number | null }) {
  const { t, f } = useI18n();
  // Undefined while not editing: the field shows the saved goal in the current unit.
  const [draft, setDraft] = useState<string | undefined>();
  const text = draft ?? (goalG === null ? "" : f.weightNumber(goalG, unit));
  const parsed = parseWeightInput(text, unit);
  const changed = text.trim() === "" ? goalG !== null : parsed.ok && parsed.grams !== goalG;
  const save = () => {
    const goal = text.trim() === "" ? null : parsed.ok ? parsed.grams : undefined;
    if (goal === undefined) return;
    setGoalWeight(goal)
      .then(() => setDraft(undefined))
      .catch((e: unknown) =>
        Alert.alert(t.settings.goal.couldNotSave, e instanceof Error ? e.message : t.common.somethingWentWrong),
      );
  };
  return (
    <View style={styles.block}>
      <Text style={[type.bodyStrong, { color: theme.text }]}>{t.settings.goal.title}</Text>
      <View style={styles.goalRow}>
        <TextInput
          value={text}
          onChangeText={setDraft}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          maxLength={6}
          placeholder={t.settings.goal.placeholder}
          placeholderTextColor={theme.muted}
          accessibilityLabel={t.settings.goal.label(unit)}
          style={[styles.goalInput, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
        />
        <Text style={[type.bodyStrong, { color: theme.muted }]}>{unit}</Text>
        <Button theme={theme} kind="quiet" label={t.common.save} onPress={save} disabled={!changed} />
      </View>
      {text.trim() !== "" && !parsed.ok && (
        <Text style={[type.small, { color: theme.danger }]}>{t.settings.goal.invalid}</Text>
      )}
      <Text style={[type.small, { color: theme.muted }]}>{t.settings.goal.note}</Text>
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
