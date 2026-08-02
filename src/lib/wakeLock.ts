// ABOUT: Screen Wake Lock wrapper. Graceful degradation when unsupported.
// ABOUT: The platform auto-releases the lock when the tab goes hidden; use reacquireIfNeeded
// ABOUT: on visibility-visible to get it back. Owner-keyed so multiple independent callers
// ABOUT: (interval timer, stopwatch) can each want the lock without stepping on one another.

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

let sentinel: WakeLockSentinel | null = null;
const owners = new Set<string>();
let requestPending = false;

export function isSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as NavigatorWithWakeLock).wakeLock?.request === 'function';
}

// Centralises the actual platform request behind an in-flight guard, so concurrent
// callers (acquire() from one owner while another's reacquireIfNeeded() is already
// mid-request) converge on a single outstanding request rather than racing.
async function requestSentinel(): Promise<void> {
  if (!isSupported()) return;
  if (requestPending) return;
  requestPending = true;
  try {
    const nav = navigator as NavigatorWithWakeLock;
    const acquired = (await nav.wakeLock!.request('screen')) ?? null;
    // The last owner may have released while this request was in flight — release()
    // saw no sentinel yet to act on, so this request must not leak one now.
    if (acquired && owners.size === 0) {
      try {
        await acquired.release();
      } catch {
        // Best-effort.
      }
      sentinel = null;
      return;
    }
    sentinel = acquired;
    // The platform auto-releases on hidden; clear our handle when that happens.
    sentinel?.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  } finally {
    requestPending = false;
  }
}

export async function acquire(owner: string): Promise<void> {
  owners.add(owner);
  if (sentinel && !sentinel.released) return;
  await requestSentinel();
}

export async function release(owner: string): Promise<void> {
  owners.delete(owner);
  if (owners.size > 0) return;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    // Best-effort.
  }
  sentinel = null;
}

export async function reacquireIfNeeded(): Promise<void> {
  if (owners.size === 0) return;
  if (sentinel && !sentinel.released) return;
  await requestSentinel();
}

/** For tests only. */
export function __resetWakeLockForTest(): void {
  sentinel = null;
  owners.clear();
  requestPending = false;
}
