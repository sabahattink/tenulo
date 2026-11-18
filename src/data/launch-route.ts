/** Health Connect opens Tenulo with one of these to show why it asks for access. */
const HEALTH_RATIONALE_ACTIONS = new Set([
  "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE",
  "android.intent.action.VIEW_PERMISSION_USAGE",
]);

// Same ids as INJECTION_REMINDER_ID / WEIGH_IN_REMINDER_ID in platform/reminders.ts, which cannot be
// imported here: it pulls in the native module, and this file is unit-tested in plain Node.
const INJECTION_REMINDER = "injection";
const WEIGH_IN_REMINDER = "weigh-in";

export type LaunchTarget = "/privacy" | "/log-injection" | "/add-weight";

/** Where a launch (Health Connect rationale or a tapped reminder) should open; undefined = nowhere. */
export function launchRoute(
  info: { readonly action: string | null; readonly reminder: string | null },
  medication: boolean,
): LaunchTarget | undefined {
  if (info.action !== null && HEALTH_RATIONALE_ACTIONS.has(info.action)) return "/privacy";
  if (info.reminder === INJECTION_REMINDER) return medication ? "/log-injection" : undefined;
  if (info.reminder === WEIGH_IN_REMINDER) return "/add-weight";
  return undefined;
}
