// ABOUT: Screen Wake Lock wrapper. Graceful degradation when unsupported.
// ABOUT: Owner-keyed so multiple independent callers (interval timer, stopwatch) can each want
// ABOUT: the lock without stepping on one another. The platform primitive is swapped via the
// ABOUT: wakeLock-platform seam: navigator.wakeLock on web, keep-awake on native.

import {
  isPlatformSupported,
  requestPlatformLock,
  type PlatformSentinel,
} from '@/lib/wakeLock-platform';

let sentinel: PlatformSentinel | null = null;
const owners = new Set<string>();
let requestPending = false;

export function isSupported(): boolean {
  return isPlatformSupported();
}

// Centralises the actual platform request behind an in-flight guard, so concurrent
// callers (acquire() from one owner while another's reacquireIfNeeded() is already
// mid-request) converge on a single outstanding request rather than racing.
async function requestSentinel(): Promise<void> {
  if (!isSupported()) return;
  if (requestPending) return;
  requestPending = true;
  try {
    const acquired = await requestPlatformLock();
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
    // On web the browser auto-releases the lock on tab-hide and fires 'release'; clear our handle
    // when that happens. On native keep-awake never auto-releases (the seam's addEventListener is
    // a no-op there), so the handle lives until an explicit release() — see reacquireIfNeeded.
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
