package org.hultberg.takt;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The WebView's own background before the page paints. A resource lookup is night-aware,
        // which the static capacitor.config.ts backgroundColor cannot be; without this the WebView
        // is white between splash dismissal and first paint on a dark-mode phone.
        // See REFERENCE/android-app.md, Part 7.
        getBridge().getWebView().setBackgroundColor(getColor(R.color.window_background));
    }
}
