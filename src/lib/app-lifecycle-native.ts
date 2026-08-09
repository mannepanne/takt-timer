// ABOUT: App-lifecycle seam — native backing via @capacitor/app. Aliased in for @/lib/app-lifecycle
// ABOUT: on the Android build, keeping the plugin out of the web bundle (07g).

import { App } from '@capacitor/app';

import type * as WebLifecycle from './app-lifecycle';

/**
 * appStateChange fires reliably on BOTH app-background and screen-lock (07a Spike 2), unlike DOM
 * `visibilitychange` whose behaviour under the WebView is what's uncertain. Native uses ONLY this
 * signal and the web seam uses ONLY visibilitychange, so there is no double-dispatch. (Both signals
 * do fire on native; the timer machine's `visibilityHidden` is idempotent when already paused, as a
 * safety net — see machine.ts stepPaused default arm.)
 */
export function subscribeAppVisibility(onHidden: () => void, onVisible: () => void): () => void {
  const pending = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onVisible();
    else onHidden();
  });
  // addListener resolves to the handle asynchronously; remove once available so it doesn't leak.
  return () => void pending.then((handle) => handle.remove());
}

/** Subscribes to the Android hardware back button. Exactly one owner should register this (07g). */
export function subscribeBackButton(handler: () => void): () => void {
  const pending = App.addListener('backButton', () => handler());
  return () => void pending.then((handle) => handle.remove());
}

/** Force-exits the app (Android back-button handler use only). */
export async function exitApp(): Promise<void> {
  await App.exitApp();
}

// Compile-time parity: the native seam must expose the surface the app consumes from the web seam.
// Type-only import (erased at build), so this never pulls the web module into the native bundle.
const _parity: {
  subscribeAppVisibility: typeof WebLifecycle.subscribeAppVisibility;
  subscribeBackButton: typeof WebLifecycle.subscribeBackButton;
  exitApp: typeof WebLifecycle.exitApp;
} = { subscribeAppVisibility, subscribeBackButton, exitApp };
void _parity;
