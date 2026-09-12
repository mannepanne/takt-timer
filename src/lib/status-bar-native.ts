// ABOUT: Status-bar seam — native backing via @capacitor/status-bar plus the in-app NavigationBar
// ABOUT: plugin. Aliased in for @/lib/status-bar on the Android build, keeping both out of the web
// ABOUT: bundle. Keeps the system bars' icons legible over the resolved appearance, including when
// ABOUT: the user's explicit choice differs from the OS.

import { registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { PAPER, type ResolvedTheme } from '@/lib/settings/theme';
import type * as WebStatusBar from './status-bar';

// The in-app plugin (android/.../NavigationBarPlugin.java, registered in MainActivity).
// @capacitor/status-bar touches the status bar only; the navigation bar would otherwise keep the
// OS theme it had at activity creation.
type NavigationBarPlugin = { setAppearance(options: { style: ResolvedTheme }): Promise<void> };
const NavigationBar = registerPlugin<NavigationBarPlugin>('NavigationBar');

/**
 * The status-bar plugin's Style names describe the BACKGROUND the icons sit on, not the icons:
 * Style.Dark means "light icons for a dark background". So a dark appearance maps to Style.Dark.
 * The native test pins this inversion.
 *
 * setStyle is the real path on Android 15+/16, where edge-to-edge is enforced by the device's OS
 * version, the bar is transparent over the page and only icon contrast matters. setBackgroundColor
 * is a documented no-op there and the fix on Android 13/14, where the bar keeps its own
 * DayNight-driven background — without it, "explicit Light on a dark phone" would give dark icons
 * on a dark bar. Each call is guarded on its own: they serve different OS bands and one failing
 * must not skip the other. None is fatal — the app renders correctly either way.
 */
export async function setStatusBarAppearance(resolved: ResolvedTheme): Promise<void> {
  try {
    await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
  } catch {
    // Plugin unavailable: icons may be off on this device; nothing else is affected.
  }
  try {
    await StatusBar.setBackgroundColor({ color: PAPER[resolved] });
  } catch {
    // Same — and expected to be a no-op on Android 15+ regardless.
  }
  try {
    await NavigationBar.setAppearance({ style: resolved });
  } catch {
    // Same.
  }
}

// Compile-time parity: the native seam must expose exactly the surface of the web seam — including
// any export the web seam gains later. Type-only import (erased at build), so this never pulls
// the web module into the native bundle.
const _parity: typeof WebStatusBar = { setStatusBarAppearance };
void _parity;
