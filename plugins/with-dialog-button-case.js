/**
 * Android dialogs (React Native's Alert) show their buttons in sentence case, like every other
 * button in Tenulo.
 *
 * AppCompat upper-cases dialog buttons with the phone's locale, not the app's language: with the
 * app in Turkish on an English phone, "Hepsini sil" became "HEPSINI SIL" (dotless I), and English
 * text on a Turkish phone gets "İ". Turning the upper-casing off removes the locale from the
 * picture. React Native builds its alerts with androidx.appcompat's AlertDialog.Builder, which
 * takes its theme from the activity theme's `alertDialogTheme`.
 */
const { AndroidConfig, withAndroidStyles } = require("expo/config-plugins");

const DIALOG_THEME = "Theme.Tenulo.AlertDialog";
const DIALOG_BUTTON = "Widget.Tenulo.AlertDialogButton";

function withDialogButtonCase(config) {
  return withAndroidStyles(config, (mod) => {
    const set = (xml, parent, name, value) => AndroidConfig.Styles.assignStylesValue(xml, { add: true, parent, name, value });
    const button = { name: DIALOG_BUTTON, parent: "Widget.AppCompat.Button.ButtonBar.AlertDialog" };
    const dialog = { name: DIALOG_THEME, parent: "ThemeOverlay.AppCompat.Dialog.Alert" };

    let styles = mod.modResults;
    styles = set(styles, button, "android:textAllCaps", "false");
    styles = set(styles, button, "textAllCaps", "false");
    styles = set(styles, dialog, "buttonBarButtonStyle", `@style/${DIALOG_BUTTON}`);
    styles = set(styles, AndroidConfig.Styles.getAppThemeGroup(), "alertDialogTheme", `@style/${DIALOG_THEME}`);
    mod.modResults = styles;
    return mod;
  });
}

module.exports = withDialogButtonCase;
