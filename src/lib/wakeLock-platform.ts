// ABOUT: Web backing for the wake-lock platform seam — thin wrapper over navigator.wakeLock.
// ABOUT: wakeLock.ts owns all owner-set/convergence logic and calls through this seam so the
// ABOUT: native build can swap the platform primitive (keep-awake) via a build-time alias.

// The handle wakeLock.ts converges on. On the web this is the browser's own WakeLockSentinel
// (which already has `.released`, `.release()`, and a `'release'` event the browser fires when
// it auto-releases the lock on tab-hide). The native seam hand-builds an object of this shape.
export type PlatformSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<PlatformSentinel> };
};

export function isPlatformSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as NavigatorWithWakeLock).wakeLock?.request === 'function';
}

/** Requests the platform screen lock. Callers guard on isPlatformSupported() first. */
export async function requestPlatformLock(): Promise<PlatformSentinel | null> {
  const nav = navigator as NavigatorWithWakeLock;
  return (await nav.wakeLock!.request('screen')) ?? null;
}
