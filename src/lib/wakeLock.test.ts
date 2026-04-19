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
    await expect(acquire()).resolves.toBeUndefined();
  });

  it('acquire() stores the sentinel; release() releases it', async () => {
    const sentinel = createFakeSentinel();
    installWakeLock(async () => sentinel);
    await acquire();
    await release();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('reacquireIfNeeded re-requests after the platform auto-released on hide', async () => {
    const first = createFakeSentinel();
    const second = createFakeSentinel();
    let call = 0;
    installWakeLock(async () => (call++ === 0 ? first : second));
    await acquire();
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
    await acquire();
    await expect(release()).resolves.toBeUndefined();
  });

  it('acquire errors leave the sentinel null', async () => {
    installWakeLock(async () => {
      throw new Error('denied');
    });
    await acquire();
    // Subsequent release should be a no-op.
    await expect(release()).resolves.toBeUndefined();
  });
});
