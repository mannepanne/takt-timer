// ABOUT: Native backing for the wake-lock platform seam — @capacitor-community/keep-awake.
// ABOUT: Aliased in by the Vite native build for @/lib/wakeLock-platform, keeping the plugin
// ABOUT: out of the web bundle. Presents a synthetic sentinel so wakeLock.ts's owner-keyed
// ABOUT: convergence logic works unchanged over keepAwake()/allowSleep().

import { KeepAwake } from '@capacitor-community/keep-awake';

import type * as WebPlatform from './wakeLock-platform';

export type PlatformSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

// The keep-awake plugin is a screen-timeout flag, always available inside the WebView (Spike 1,
// ADR 2026-08-08) — there is no capability to feature-detect, unlike navigator.wakeLock.
export function isPlatformSupported(): boolean {
  return true;
}

/**
 * Acquires keep-awake and returns a synthetic sentinel with hand-maintained `released`
 * bookkeeping. keepAwake()/allowSleep() have none of navigator.wakeLock's sentinel surface,
 * so wakeLock.ts's convergence (which reads `.released` and calls `.release()`) needs this shim.
 */
export async function requestPlatformLock(): Promise<PlatformSentinel | null> {
  await KeepAwake.keepAwake();
  const sentinel: PlatformSentinel = {
    released: false,
    async release() {
      // Idempotent: wakeLock.ts may release a handle the request-race path already dropped.
      if (sentinel.released) return;
      sentinel.released = true;
      await KeepAwake.allowSleep();
    },
    addEventListener() {
      // No-op. navigator.wakeLock fires 'release' when the *browser* auto-releases the lock on
      // tab-hide; keep-awake has no such spontaneous release — the flag is only ever cleared by
      // an explicit allowSleep() driven from our own release(). Nothing to subscribe to.
    },
  };
  return sentinel;
}

// Compile-time parity: the native seam must expose exactly the surface wakeLock.ts consumes from
// the web seam. Type-only import (erased at build) so this never pulls the web module into the
// native bundle. Drift in either signature fails `pnpm typecheck`.
const _parity: {
  isPlatformSupported: typeof WebPlatform.isPlatformSupported;
  requestPlatformLock: typeof WebPlatform.requestPlatformLock;
} = { isPlatformSupported, requestPlatformLock };
void _parity;
