package org.hultberg.takt;

import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the navigation bar (icons and, for 3-button navigation, the system's scrim) in step with
 * the app's resolved appearance. @capacitor/status-bar covers the status bar only; without this the
 * navigation bar follows the OS theme as it was at activity creation, so an explicit Dark on a
 * light-mode phone shows a light band under a dark app until relaunch.
 *
 * Registered in MainActivity; called from src/lib/status-bar-native.ts.
 */
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    /** style: "dark" → light icons for a dark app; "light" → dark icons for a light app. */
    @PluginMethod
    public void setAppearance(PluginCall call) {
        String style = call.getString("style", "light");
        boolean lightIcons = "dark".equals(style);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            // "Light navigation bars" means dark icons on a light bar — the inverse of our style.
            controller.setAppearanceLightNavigationBars(!lightIcons);
            call.resolve();
        });
    }
}
