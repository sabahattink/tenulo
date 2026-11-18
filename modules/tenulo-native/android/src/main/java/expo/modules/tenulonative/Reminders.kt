package expo.modules.tenulonative

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.Calendar

/**
 * A local reminder. Either one-shot at [atMs] (epoch ms), or daily at [dailyMinute] minutes after
 * local midnight. Stored in SharedPreferences so the alarms can be restored after a reboot.
 */
data class Reminder(
  val id: String,
  val title: String,
  val body: String,
  val atMs: Long?,
  val dailyMinute: Int?,
) {
  fun toJson(): String = JSONObject()
    .put("id", id)
    .put("title", title)
    .put("body", body)
    .put("atMs", atMs ?: JSONObject.NULL)
    .put("dailyMinute", dailyMinute ?: JSONObject.NULL)
    .toString()

  /** Next time this reminder should fire after [now], or null when it never will again. */
  fun nextTrigger(now: Long): Long? = when {
    dailyMinute != null -> nextDaily(dailyMinute, now)
    atMs != null && atMs > now -> atMs
    else -> null
  }

  companion object {
    fun fromJson(json: String): Reminder? = try {
      val o = JSONObject(json)
      Reminder(
        id = o.getString("id"),
        title = o.getString("title"),
        body = o.getString("body"),
        atMs = if (o.isNull("atMs")) null else o.getLong("atMs"),
        dailyMinute = if (o.isNull("dailyMinute")) null else o.getInt("dailyMinute"),
      )
    } catch (e: Exception) {
      null
    }

    /** The next local wall-clock [minute] strictly after [now]. Calendar keeps it right across DST. */
    fun nextDaily(minute: Int, now: Long): Long {
      val cal = Calendar.getInstance().apply {
        timeInMillis = now
        set(Calendar.HOUR_OF_DAY, minute / 60)
        set(Calendar.MINUTE, minute % 60)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
      return cal.timeInMillis
    }
  }
}

object ReminderScheduler {
  private const val PREFS = "tenulo_reminders"
  private const val CHANNEL_ID = "reminders"
  /**
   * The texts Android shows outside a reminder: the channel in the system's notification settings
   * and the title on a locked screen. Set from JS in the user's language; English until then.
   * Kept apart from PREFS, whose keys are reminder ids.
   */
  private const val TEXT_PREFS = "tenulo_reminder_texts"
  private const val CHANNEL_NAME = "channelName"
  private const val CHANNEL_DESCRIPTION = "channelDescription"
  private const val LOCKED_TITLE = "lockedTitle"
  private const val DEFAULT_CHANNEL_NAME = "Reminders"
  private const val DEFAULT_CHANNEL_DESCRIPTION = "Reminders you set in Tenulo"
  private const val DEFAULT_LOCKED_TITLE = "Tenulo reminder"
  /** Same id as INJECTION_REMINDER_ID in src/platform/reminders.ts. */
  const val INJECTION_ID = "injection"
  /** Manifest meta-data written by plugins/with-medication-switch.js from expo.extra.medication. */
  private const val MEDICATION_META = "tenulo.medication"
  const val ACTION_FIRE = "expo.modules.tenulonative.REMINDER_FIRE"
  const val EXTRA_ID = "reminderId"
  /** Put on the launch intent when a reminder notification is tapped. */
  const val EXTRA_LAUNCHED_BY = "tenulo.reminder"
  /** Also on that intent: unique per notification posted, so a replayed tap can be told apart. */
  const val EXTRA_LAUNCH_TOKEN = "tenulo.launch"
  private const val LAUNCH_PREFS = "tenulo_launch"
  private const val LAST_LAUNCH = "last"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun launchPrefs(context: Context) = context.getSharedPreferences(LAUNCH_PREFS, Context.MODE_PRIVATE)

  /**
   * True the first time a tapped notification's token is seen. Android restarts an activity with
   * the intent that first created it: after it ends Tenulo's process in the background, reopening
   * from Recents replays the original tap, and that replay must not open the screen again. A
   * launch without a token (no notification behind it) is never treated as a replay.
   */
  fun firstLaunchOf(context: Context, token: String?): Boolean {
    if (token == null) return true
    val launches = launchPrefs(context)
    if (launches.getString(LAST_LAUNCH, null) == token) return false
    // commit, not apply: the process may be ended right after this, and the token must survive it.
    launches.edit().putString(LAST_LAUNCH, token).commit()
    return true
  }

  /**
   * The medication switch from the manifest. Read here because the receiver runs without the JS
   * runtime. True when the meta-data is absent (a build without the plugin keeps today's behaviour).
   */
  fun medicationEnabled(context: Context): Boolean = try {
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    info.metaData?.getBoolean(MEDICATION_META, true) ?: true
  } catch (e: PackageManager.NameNotFoundException) {
    true
  }

  fun canNotify(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun schedule(context: Context, reminder: Reminder) {
    prefs(context).edit().putString(reminder.id, reminder.toJson()).apply()
    arm(context, reminder)
  }

  fun cancel(context: Context, id: String) {
    alarms(context).cancel(alarmIntent(context, id))
    prefs(context).edit().remove(id).apply()
  }

  /**
   * "Delete all data": every alarm, every stored reminder, and every reminder notification still
   * on screen. Reminders are the only notifications Tenulo posts. A one-shot reminder has already
   * left the stored list once it fired, so its notification is cleared by cancelAll, not by id.
   */
  fun cancelAll(context: Context) {
    for (id in prefs(context).all.keys.toList()) cancel(context, id)
    launchPrefs(context).edit().clear().apply()
    NotificationManagerCompat.from(context).cancelAll()
  }

  fun scheduledIds(context: Context): List<String> = prefs(context).all.keys.sorted()

  /** Re-creates every stored alarm: after a reboot, an app update or a clock/time-zone change. */
  fun rearmAll(context: Context) {
    val medication = medicationEnabled(context)
    // A build without medication features must not bring back an injection reminder that an
    // earlier build armed: drop it and its alarm.
    if (!medication) cancel(context, INJECTION_ID)
    for (json in prefs(context).all.values) {
      val reminder = (json as? String)?.let(Reminder::fromJson) ?: continue
      if (!medication && reminder.id == INJECTION_ID) continue
      arm(context, reminder)
    }
  }

  fun fire(context: Context, id: String) {
    if (id == INJECTION_ID && !medicationEnabled(context)) {
      cancel(context, id)
      return
    }
    val reminder = prefs(context).getString(id, null)?.let(Reminder::fromJson) ?: return
    post(context, reminder)
    if (reminder.dailyMinute != null) {
      arm(context, reminder)
    } else {
      prefs(context).edit().remove(id).apply()
    }
  }

  private fun arm(context: Context, reminder: Reminder) {
    val trigger = reminder.nextTrigger(System.currentTimeMillis())
    if (trigger == null) {
      // Never firing again: drop it, including any alarm left from an earlier schedule.
      alarms(context).cancel(alarmIntent(context, reminder.id))
      prefs(context).edit().remove(reminder.id).apply()
      return
    }
    // Inexact but Doze-safe: needs no SCHEDULE_EXACT_ALARM permission, and a reminder a few
    // minutes late is fine.
    alarms(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, alarmIntent(context, reminder.id))
  }

  private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun alarmIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("tenulo-reminder://$id"))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun textPrefs(context: Context) = context.getSharedPreferences(TEXT_PREFS, Context.MODE_PRIVATE)

  /**
   * Stores the channel's name and description and the locked-screen title in the user's language.
   * An existing channel is renamed in place (createNotificationChannel updates name and
   * description and keeps the user's own settings for it); a missing one is created later, when
   * it is first needed, with these texts.
   */
  fun setTexts(context: Context, channelName: String, channelDescription: String, lockedTitle: String) {
    textPrefs(context).edit()
      .putString(CHANNEL_NAME, channelName)
      .putString(CHANNEL_DESCRIPTION, channelDescription)
      .putString(LOCKED_TITLE, lockedTitle)
      .apply()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) createChannel(context, manager)
  }

  private fun createChannel(context: Context, manager: NotificationManager) {
    val texts = textPrefs(context)
    val name = texts.getString(CHANNEL_NAME, null) ?: DEFAULT_CHANNEL_NAME
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = texts.getString(CHANNEL_DESCRIPTION, null) ?: DEFAULT_CHANNEL_DESCRIPTION
      lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
    }
    manager.createNotificationChannel(channel)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    createChannel(context, manager)
  }

  /** Creates the channel up front, so Android 13+ can show the notification permission prompt. */
  fun prepare(context: Context) = ensureChannel(context)

  private fun post(context: Context, reminder: Reminder) {
    ensureChannel(context)
    if (!canNotify(context)) return
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(EXTRA_LAUNCHED_BY, reminder.id)
      putExtra(EXTRA_LAUNCH_TOKEN, "${reminder.id}@${System.currentTimeMillis()}")
    }
    val content = launch?.let {
      PendingIntent.getActivity(
        context,
        reminder.id.hashCode(),
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    // On a locked screen show only "Tenulo reminder": what the reminder is about is health data.
    val public = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.tenulo_ic_notification)
      .setContentTitle(textPrefs(context).getString(LOCKED_TITLE, null) ?: DEFAULT_LOCKED_TITLE)
      .build()
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.tenulo_ic_notification)
      .setContentTitle(reminder.title)
      .setContentText(reminder.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(public)
      .setAutoCancel(true)
      .apply { if (content != null) setContentIntent(content) }
      .build()
    try {
      NotificationManagerCompat.from(context).notify(reminder.id.hashCode(), notification)
    } catch (e: SecurityException) {
      // Permission revoked between the check and the post: nothing to show.
    }
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ReminderScheduler.ACTION_FIRE ->
        intent.getStringExtra(ReminderScheduler.EXTRA_ID)?.let { ReminderScheduler.fire(context, it) }
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED -> ReminderScheduler.rearmAll(context)
    }
  }
}
