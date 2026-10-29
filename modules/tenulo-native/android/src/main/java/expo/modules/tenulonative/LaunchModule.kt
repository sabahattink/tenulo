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

  private fun describe(intent: Intent?): Map<String, String?> = mapOf(
    "action" to intent?.action,
    "reminder" to intent?.getStringExtra(ReminderScheduler.EXTRA_LAUNCHED_BY),
  )
}
