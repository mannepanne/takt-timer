// ABOUT: Screen Wake Lock wrapper. Graceful degradation when unsupported.
// ABOUT: The platform auto-releases the lock when the tab goes hidden; use reacquireIfNeeded
// ABOUT: on visibility-visible to get it back.

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

let sentinel: WakeLockSentinel | null = null;
let wantsLock = false;

export function isSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as NavigatorWithWakeLock).wakeLock?.request === 'function';
}

export async function acquire(): Promise<void> {
  wantsLock = true;
  if (!isSupported()) return;
  const nav = navigator as NavigatorWithWakeLock;
  try {
    sentinel = (await nav.wakeLock!.request('screen')) ?? null;
    // The platform auto-releases on hidden; clear our handle when that happens.
    sentinel?.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

export async function release(): Promise<void> {
  wantsLock = false;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    // Best-effort.
  }
  sentinel = null;
}

export async function reacquireIfNeeded(): Promise<void> {
  if (!wantsLock) return;
  if (sentinel && !sentinel.released) return;
  await acquire();
}

/** For tests only. */
export function __resetWakeLockForTest(): void {
  sentinel = null;
  wantsLock = false;
}
