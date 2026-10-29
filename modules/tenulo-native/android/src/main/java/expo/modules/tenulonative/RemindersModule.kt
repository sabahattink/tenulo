package expo.modules.tenulonative

import android.Manifest
import android.content.Context
import android.os.Build
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Local reminders: AlarmManager + a notification channel. Nothing is sent to or from a server. */
class RemindersModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TenuloReminders")

    Function("canNotify") { ReminderScheduler.canNotify(context) }

    AsyncFunction("requestPermission") { promise: Promise ->
      ReminderScheduler.prepare(context)
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(ReminderScheduler.canNotify(context))
        return@AsyncFunction
      }
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(ReminderScheduler.canNotify(context))
        return@AsyncFunction
      }
      permissions.askForPermissions(
        { result ->
          val granted = result[Manifest.permission.POST_NOTIFICATIONS]?.status == PermissionsStatus.GRANTED
          promise.resolve(granted && ReminderScheduler.canNotify(context))
        },
        Manifest.permission.POST_NOTIFICATIONS,
      )
    }

    Function("scheduleAt") { id: String, title: String, body: String, atMs: Double ->
      ReminderScheduler.schedule(context, Reminder(id, title, body, atMs = atMs.toLong(), dailyMinute = null))
    }

    Function("scheduleDaily") { id: String, title: String, body: String, minute: Int ->
      require(minute in 0 until 1440) { "minute must be 0-1439" }
      ReminderScheduler.schedule(context, Reminder(id, title, body, atMs = null, dailyMinute = minute))
    }

    Function("cancel") { id: String -> ReminderScheduler.cancel(context, id) }

    Function("cancelAll") { ReminderScheduler.cancelAll(context) }

    Function("scheduledIds") { ReminderScheduler.scheduledIds(context) }
  }
}
