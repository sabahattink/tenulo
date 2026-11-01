package expo.modules.tenulonative

import androidx.core.view.WindowCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The activity handles uiMode changes itself instead of being recreated, so a dark/light switch
 * while Tenulo is open leaves the three-button navigation bar drawn for the old theme: a light
 * scrim with dark buttons under a dark screen. JS calls this whenever the color scheme changes.
 * (Gesture navigation is not affected: the system tints the handle from the content.)
 */
class SystemBarsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TenuloSystemBars")

    AsyncFunction("setNavigationBarLight") { light: Boolean ->
      val window = appContext.currentActivity?.window ?: return@AsyncFunction
      WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = light
    }.runOnQueue(Queues.MAIN)
  }
}
