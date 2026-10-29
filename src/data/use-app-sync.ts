import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { Launch, type LaunchInfo } from "../../modules/tenulo-native";
import { parseLocalDate } from "@/domain/date";
import { injectionStatus } from "@/domain/injection";
import { startBilling, useIsPro } from "@/platform/billing";
import { INJECTION_REMINDER_ID, WEIGH_IN_REMINDER_ID, applyReminders } from "@/platform/reminders";
import { syncHealthConnect } from "./health-sync";
import { useActiveMedication, useInjections, usePlanSteps } from "./injections";
import { sweepExports } from "./files";
import { useSettings } from "./repo";
import { useToday } from "./use-today";

/** Health Connect opens Tenulo with one of these to show why it asks for access. */
const HEALTH_RATIONALE_ACTIONS = new Set([
  "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE",
  "android.intent.action.VIEW_PERMISSION_USAGE",
]);

/** Exported files older than this are swept on start: long enough for a share to finish. */
const EXPORT_TTL_MS = 10 * 60_000;

/** The launch intent is read once per process; a remount must not navigate again. */
let initialLaunchHandled = false;

function route(info: LaunchInfo): void {
  if (info.action !== null && HEALTH_RATIONALE_ACTIONS.has(info.action)) router.push("/privacy");
  else if (info.reminder === INJECTION_REMINDER_ID) router.push("/log-injection");
  else if (info.reminder === WEIGH_IN_REMINDER_ID) router.push("/add-weight");
}

/**
 * Keeps the device in step with the log: reminder alarms follow settings and the injection log,
 * Health Connect is read when the app comes to the foreground, Pro is checked with Play, and
 * launches from Health Connect or a reminder open the right screen.
 */
export function useAppSync(): void {
  const settings = useSettings();
  const medication = useActiveMedication();
  const history = useInjections(medication?.id);
  const steps = usePlanSteps(medication?.id);
  const isPro = useIsPro();
  const now = useToday();

  const nextDue = injectionStatus(
    history.map((i) => ({ date: parseLocalDate(i.localDate), site: i.site, doseMcg: i.doseMcg })),
    steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays })),
    now,
  ).nextDue;

  const injectionEnabled = settings?.injectionReminderEnabled ?? false;
  const injectionMinute = settings?.injectionReminderMinute ?? 540;
  const weighInEnabled = settings?.weighInReminderEnabled ?? false;
  const weighInMinute = settings?.weighInReminderMinute ?? 450;
  const hasMedication = medication !== undefined;

  useEffect(() => {
    if (settings === undefined) return;
    applyReminders({
      injectionEnabled: injectionEnabled && hasMedication,
      injectionMinute,
      nextDue,
      weighInEnabled,
      weighInMinute,
    });
  }, [settings, injectionEnabled, injectionMinute, weighInEnabled, weighInMinute, nextDue, hasMedication]);

  const healthConnect = (settings?.healthConnectEnabled ?? false) && isPro;
  useEffect(() => {
    if (!healthConnect) return;
    const run = () => void syncHealthConnect().catch(() => undefined);
    run();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    return () => sub.remove();
  }, [healthConnect]);

  useEffect(() => {
    startBilling();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") startBilling();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    sweepExports(EXPORT_TTL_MS);
    if (Launch === null) return;
    const sub = Launch.addListener("onLaunch", route);
    if (initialLaunchHandled) return () => sub.remove();
    initialLaunchHandled = true;
    // Let the navigator mount before pushing a screen on top of it.
    const initial = Launch.initial();
    const timer = setTimeout(() => route(initial), 0);
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
