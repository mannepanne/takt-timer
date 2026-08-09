// ABOUT: Tests for the native wake-lock platform seam — the synthetic sentinel over keep-awake.
// ABOUT: The convergence logic that consumes this sentinel lives in wakeLock.ts (web-resolved in
// ABOUT: vitest) and is tested there; here we only prove the sentinel's own bookkeeping.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const keepAwake = vi.fn(async () => {});
const allowSleep = vi.fn(async () => {});
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: () => keepAwake(),
    allowSleep: () => allowSleep(),
  },
}));

import { isPlatformSupported, requestPlatformLock } from './wakeLock-platform-native';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('wakeLock-platform-native', () => {
  it('is always supported (keep-awake needs no feature detection inside the WebView)', () => {
    expect(isPlatformSupported()).toBe(true);
  });

  it('requesting a lock calls keepAwake() and returns an un-released sentinel', async () => {
    const sentinel = await requestPlatformLock();
    expect(keepAwake).toHaveBeenCalledTimes(1);
    expect(sentinel).not.toBeNull();
    expect(sentinel!.released).toBe(false);
  });

  it('release() calls allowSleep() and flips released to true', async () => {
    const sentinel = await requestPlatformLock();
    await sentinel!.release();
    expect(allowSleep).toHaveBeenCalledTimes(1);
    expect(sentinel!.released).toBe(true);
  });

  it('release() is idempotent — a second call does not call allowSleep() again', async () => {
    const sentinel = await requestPlatformLock();
    await sentinel!.release();
    await sentinel!.release();
    expect(allowSleep).toHaveBeenCalledTimes(1);
    expect(sentinel!.released).toBe(true);
  });

  it('addEventListener is a no-op — keep-awake never fires a spontaneous release', async () => {
    const sentinel = await requestPlatformLock();
    const cb = vi.fn();
    sentinel!.addEventListener('release', cb);
    // Nothing the platform can do drives this callback; releasing our own handle must not fire it.
    await sentinel!.release();
    expect(cb).not.toHaveBeenCalled();
  });

  it('each request yields an independent sentinel', async () => {
    const a = await requestPlatformLock();
    const b = await requestPlatformLock();
    await a!.release();
    expect(a!.released).toBe(true);
    expect(b!.released).toBe(false);
  });
});
