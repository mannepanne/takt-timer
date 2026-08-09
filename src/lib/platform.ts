// ABOUT: Single source of truth for "are we running inside the native Android shell?"
// ABOUT: Thin wrapper over Capacitor.isNativePlatform() that every runtime platform branch imports.

import { Capacitor } from '@capacitor/core';

/**
 * True when Takt is running inside the Capacitor native WebView (the Android app),
 * false on the web (takt.hultberg.org) and in tests/SSR.
 *
 * This is the one import every runtime platform branch elsewhere should use, so the
 * "is this native?" question has a single, mockable answer rather than scattered
 * `Capacitor.isNativePlatform()` calls. Build-time divergence (fonts, analytics, the
 * service worker, the CSP) is handled in the Vite native build mode, not here — this
 * shim is only for branches that must be decided at runtime inside the shared React tree.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
