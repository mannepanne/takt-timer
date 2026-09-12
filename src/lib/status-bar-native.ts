// ABOUT: Status-bar seam — native backing via @capacitor/status-bar. Aliased in for
// ABOUT: @/lib/status-bar on the Android build, keeping the plugin out of the web bundle.
// ABOUT: Keeps the status-bar icons legible over the resolved appearance, including when the
// ABOUT: user's explicit choice differs from the OS.

import { StatusBar, Style } from '@capacitor/status-bar';

import { PAPER, type ResolvedTheme } from '@/lib/settings/theme';
import type * as WebStatusBar from './status-bar';

/**
 * The plugin's Style names describe the BACKGROUND the icons sit on, not the icons: Style.Dark
 * means "light icons for a dark background". So a dark appearance maps to Style.Dark. The
 * native test pins this inversion.
 *
 * setStyle is the real path on Android 15+/16, where edge-to-edge is enforced by the device's OS
 * version, the bar is transparent over the page and only icon contrast matters. setBackgroundColor
 * is a documented no-op there and the fix on Android 13/14, where the bar keeps its own
 * DayNight-driven background — without it, "explicit Light on a dark phone" would give dark icons
 * on a dark bar.
 */
export async function setStatusBarAppearance(resolved: ResolvedTheme): Promise<void> {
  try {
    await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: PAPER[resolved] });
  } catch {
    // Not fatal: the app still renders correctly; only the bar's icons might be off on a device
    // where the plugin is unavailable.
  }
}

// Compile-time parity: the native seam must expose the surface the app consumes from the web seam.
// Type-only import (erased at build), so this never pulls the web module into the native bundle.
const _parity: { setStatusBarAppearance: typeof WebStatusBar.setStatusBarAppearance } = {
  setStatusBarAppearance,
};
void _parity;
