// ABOUT: Status-bar seam — web backing. The browser owns its own chrome (the theme-color metas
// ABOUT: handle it), so this is a no-op. The native build aliases this to status-bar-native
// ABOUT: (@capacitor/status-bar), keeping the plugin out of the web bundle — the same build-alias
// ABOUT: seam pattern as wakeLock-platform (07e) and app-lifecycle (07g). See vite.config.ts.

import type { ResolvedTheme } from '@/lib/settings/theme';

/** Matches the system status bar to the resolved appearance. No-op on the web. */
export async function setStatusBarAppearance(_resolved: ResolvedTheme): Promise<void> {}
