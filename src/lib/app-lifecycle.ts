// ABOUT: App-lifecycle seam — web backing. Reports app hidden/visible for the interval timer's
// ABOUT: background-pause, and no-ops the hardware back button / app-exit (the web has neither).
// ABOUT: The native build aliases this to app-lifecycle-native (@capacitor/app), keeping that
// ABOUT: plugin out of the web bundle. See vite.config.ts and ADR pattern from 07e.

/**
 * Calls onHidden/onVisible when the app becomes hidden/visible. On the web this is DOM
 * `visibilitychange` (unchanged behaviour); on native it's `@capacitor/app` `appStateChange`.
 * Returns an unsubscribe function.
 */
export function subscribeAppVisibility(onHidden: () => void, onVisible: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'hidden') onHidden();
    else onVisible();
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/** Subscribes to the Android hardware back button. No-op on web (no hardware back). */
export function subscribeBackButton(_handler: () => void): () => void {
  return () => {};
}

/** Exits the app. No-op on web. */
export async function exitApp(): Promise<void> {}
