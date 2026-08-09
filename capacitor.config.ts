// ABOUT: Capacitor configuration for the Takt Android app.
// ABOUT: Locks the application ID and WebView origin — both immutable after first Play Store release.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Immutable after first publish — mirrors takt.hultberg.org. See the Capacitor ADR.
  appId: 'org.hultberg.takt',
  appName: 'Takt',
  // The native Vite build variant (self-hosted fonts, no analytics, scoped CSP, no service worker).
  webDir: 'dist-native',
  server: {
    // Locked WebView origin: https + the default `localhost` hostname → `https://localhost`.
    // This is the storage key for ALL local data (takt.presets.v1 / takt.history.v1 /
    // takt.stopwatch.v1); changing it in any later release orphans every user's data with no
    // migration path. `https` gives a secure context, which crypto.randomUUID() needs. Treat as
    // immutable, on par with appId. See REFERENCE/decisions/2026-07-26-capacitor-android-wrapper.md.
    androidScheme: 'https',
  },
};

export default config;
