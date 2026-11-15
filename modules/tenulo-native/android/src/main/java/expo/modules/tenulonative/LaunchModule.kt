package expo.modules.tenulonative

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Why the activity was opened. Health Connect opens Tenulo to show its privacy policy (through the
 * permissions-rationale action, or an activity alias on Android 14+), and reminder notifications
 * say which reminder was tapped. Expo Router only routes URLs, so this reports the rest.
 */
class LaunchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TenuloLaunch")
    Events("onLaunch")

    Function("initial") {
      describe(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      sendEvent("onLaunch", describe(intent))
    }
  }

  /** A reminder tap already routed once (replayed by Android after ending the process) reports none. */
  private fun describe(intent: Intent?): Map<String, String?> {
    val reminder = intent?.getStringExtra(ReminderScheduler.EXTRA_LAUNCHED_BY)
    val token = intent?.getStringExtra(ReminderScheduler.EXTRA_LAUNCH_TOKEN)
    val context = appContext.reactContext
    val replayed = reminder != null && context != null && !ReminderScheduler.firstLaunchOf(context, token)
    return mapOf(
      "action" to intent?.action,
      "reminder" to reminder.takeUnless { replayed },
    )
  }
}
