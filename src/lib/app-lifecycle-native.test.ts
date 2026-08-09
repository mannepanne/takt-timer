// ABOUT: Tests for the native app-lifecycle seam — appStateChange → hidden/visible, backButton
// ABOUT: subscription, exitApp, and listener cleanup. @capacitor/app is mocked.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const remove = vi.fn(async () => {});
const addListener = vi.fn(async () => ({ remove }));
const exitAppNative = vi.fn(async () => {});
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, cb: unknown) => addListener(event, cb),
    exitApp: () => exitAppNative(),
  },
}));

import { exitApp, subscribeAppVisibility, subscribeBackButton } from './app-lifecycle-native';

beforeEach(() => {
  vi.clearAllMocks();
});

// Pulls the listener callback the seam registered for a given event.
function registeredCb(event: string): (arg: unknown) => void {
  const call = addListener.mock.calls.find((c) => c[0] === event);
  return call![1] as (arg: unknown) => void;
}

describe('app-lifecycle (native)', () => {
  it('maps appStateChange isActive=false → onHidden, true → onVisible', () => {
    const onHidden = vi.fn();
    const onVisible = vi.fn();
    subscribeAppVisibility(onHidden, onVisible);
    const cb = registeredCb('appStateChange');

    cb({ isActive: false });
    expect(onHidden).toHaveBeenCalledTimes(1);
    cb({ isActive: true });
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing removes the appStateChange listener once the handle resolves', async () => {
    const unsub = subscribeAppVisibility(vi.fn(), vi.fn());
    unsub();
    await Promise.resolve(); // let the addListener promise resolve
    await Promise.resolve();
    expect(remove).toHaveBeenCalled();
  });

  it('subscribeBackButton registers a backButton listener that fires the handler', () => {
    const handler = vi.fn();
    subscribeBackButton(handler);
    registeredCb('backButton')({ canGoBack: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('exitApp calls App.exitApp', async () => {
    await exitApp();
    expect(exitAppNative).toHaveBeenCalled();
  });
});
