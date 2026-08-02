import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetWakeLockForTest,
  acquire,
  isSupported,
  reacquireIfNeeded,
  release,
} from './wakeLock';

type ReleaseListener = () => void;

function createFakeSentinel() {
  const listeners: ReleaseListener[] = [];
  return {
    released: false,
    release: vi.fn(async function (this: { released: boolean }) {
      this.released = true;
      listeners.forEach((l) => l());
    }),
    addEventListener: vi.fn((_type: 'release', cb: ReleaseListener) => {
      listeners.push(cb);
    }),
    _fireRelease() {
      listeners.forEach((l) => l());
    },
  };
}

function installWakeLock(
  request: (type: 'screen') => Promise<ReturnType<typeof createFakeSentinel>>,
) {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  });
}

function uninstallWakeLock() {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
}

describe('Wake Lock wrapper', () => {
  afterEach(() => {
    uninstallWakeLock();
    __resetWakeLockForTest();
    vi.restoreAllMocks();
  });

  it('isSupported is false when navigator.wakeLock is absent', () => {
    uninstallWakeLock();
    expect(isSupported()).toBe(false);
  });

  it('isSupported is true when navigator.wakeLock.request exists', () => {
    installWakeLock(async () => createFakeSentinel());
    expect(isSupported()).toBe(true);
  });

  it('acquire() on unsupported browsers is a no-op and does not throw', async () => {
    uninstallWakeLock();
    await expect(acquire('interval')).resolves.toBeUndefined();
  });

  it('acquire() stores the sentinel; release() releases it', async () => {
    const sentinel = createFakeSentinel();
    installWakeLock(async () => sentinel);
    await acquire('interval');
    await release('interval');
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('reacquireIfNeeded re-requests after the platform auto-released on hide', async () => {
    const first = createFakeSentinel();
    const second = createFakeSentinel();
    let call = 0;
    installWakeLock(async () => (call++ === 0 ? first : second));
    await acquire('interval');
    // Simulate platform auto-release.
    first._fireRelease();
    await reacquireIfNeeded();
    expect(call).toBe(2);
  });

  it('reacquireIfNeeded is a no-op when we have not requested a lock', async () => {
    const sentinel = createFakeSentinel();
    const request = vi.fn(async () => sentinel);
    installWakeLock(request);
    await reacquireIfNeeded();
    expect(request).not.toHaveBeenCalled();
  });

  it('release errors are swallowed', async () => {
    const sentinel = createFakeSentinel();
    sentinel.release = vi.fn(async () => {
      throw new Error('boom');
    });
    installWakeLock(async () => sentinel);
    await acquire('interval');
    await expect(release('interval')).resolves.toBeUndefined();
  });

  it('acquire errors leave the sentinel null', async () => {
    installWakeLock(async () => {
      throw new Error('denied');
    });
    await acquire('interval');
    // Subsequent release should be a no-op.
    await expect(release('interval')).resolves.toBeUndefined();
  });

  it('a second owner acquiring while the first still holds the lock reuses the sentinel, not a fresh request', async () => {
    const sentinel = createFakeSentinel();
    const request = vi.fn(async () => sentinel);
    installWakeLock(request);
    await acquire('interval');
    await acquire('stopwatch');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releasing one owner while another still holds keeps the platform lock alive', async () => {
    const sentinel = createFakeSentinel();
    installWakeLock(async () => sentinel);
    await acquire('interval');
    await acquire('stopwatch');
    await release('interval');
    expect(sentinel.release).not.toHaveBeenCalled();
    await release('stopwatch');
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('releasing an owner that never acquired is a no-op', async () => {
    const sentinel = createFakeSentinel();
    installWakeLock(async () => sentinel);
    await acquire('interval');
    await release('someone-else');
    expect(sentinel.release).not.toHaveBeenCalled();
  });

  it('concurrent reacquireIfNeeded calls from two owners do not double-request', async () => {
    let resolveRequest: (s: ReturnType<typeof createFakeSentinel>) => void;
    const pending = new Promise<ReturnType<typeof createFakeSentinel>>((resolve) => {
      resolveRequest = resolve;
    });
    const request = vi.fn(() => pending);
    installWakeLock(request);

    // Both owners want the lock, but nothing has been granted yet (e.g. both mounted
    // while backgrounded, then fired reacquireIfNeeded on the same visibility event).
    const first = acquire('interval');
    const second = reacquireIfNeeded();
    // acquire() itself issues the first request; reacquireIfNeeded must see the
    // in-flight guard and not issue a second one.
    void first;
    void second;

    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest!(createFakeSentinel());
    await first;
    await second;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not leak the platform lock when the last owner releases while the request is still in flight', async () => {
    let resolveRequest: (s: ReturnType<typeof createFakeSentinel>) => void;
    const pending = new Promise<ReturnType<typeof createFakeSentinel>>((resolve) => {
      resolveRequest = resolve;
    });
    installWakeLock(() => pending);

    const acquiring = acquire('stopwatch');
    // The only owner changes its mind before the platform has granted the lock —
    // release() sees no sentinel yet to act on and can only no-op at this point.
    await release('stopwatch');

    const granted = createFakeSentinel();
    resolveRequest!(granted);
    await acquiring;

    // The request resolved after the owner set had already emptied; the resolved
    // sentinel must be released immediately rather than held with no owner.
    expect(granted.release).toHaveBeenCalled();
  });
});
