package org.hultberg.takt;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the navigation bar in step with the app's resolved appearance. @capacitor/status-bar covers
 * the status bar only; without this the navigation bar follows the OS theme as it was at activity
 * creation, so an explicit Dark on a light-mode phone shows a light band under a dark app until
 * relaunch.
 *
 * Two things have to happen together. With 3-button navigation on Android 15+, the framework draws
 * its own contrast scrim under the buttons and FORCES a light appearance to match it
 * (FORCE_LIGHT_NAVIGATION_BARS) — an app's icon-appearance request alone is overridden. So the
 * scrim is switched off (the page already paints edge-to-edge behind the bar, with safe-area insets
 * keeping content clear of it) and only then does the appearance flag decide the icon colour. On
 * older releases, where the window does not extend under the bar, a transparent bar shows the
 * activity's windowBackground — the night-aware paper — which is the right look as well.
 *
 * Registered in MainActivity; called from src/lib/status-bar-native.ts.
 */
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    /** style: "dark" → light icons for a dark app; "light" → dark icons for a light app. */
    @PluginMethod
    @SuppressWarnings("deprecation") // setNavigationBarColor: deprecated on 35+, where it is a no-op
    public void setAppearance(PluginCall call) {
        String style = call.getString("style", "light");
        boolean lightIcons = "dark".equals(style);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setNavigationBarContrastEnforced(false);
            }
            window.setNavigationBarColor(Color.TRANSPARENT);
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            // "Light navigation bars" means dark icons on a light bar — the inverse of our style.
            controller.setAppearanceLightNavigationBars(!lightIcons);
            call.resolve();
        });
    }
}
