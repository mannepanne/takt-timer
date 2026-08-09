// ABOUT: Tests for the web app-lifecycle seam — visibility via DOM visibilitychange; back-button
// ABOUT: and exitApp are no-ops (the web has no hardware back button).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { exitApp, subscribeAppVisibility, subscribeBackButton } from './app-lifecycle';

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('app-lifecycle (web)', () => {
  it('calls onHidden when the document becomes hidden, onVisible when visible', () => {
    const onHidden = vi.fn();
    const onVisible = vi.fn();
    const unsub = subscribeAppVisibility(onHidden, onVisible);

    setVisibility('hidden');
    expect(onHidden).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    expect(onVisible).toHaveBeenCalledTimes(1);

    unsub();
    setVisibility('hidden');
    expect(onHidden).toHaveBeenCalledTimes(1); // no longer listening
  });

  it('subscribeBackButton is a no-op that returns an unsubscribe', () => {
    const handler = vi.fn();
    const unsub = subscribeBackButton(handler);
    expect(unsub).toBeTypeOf('function');
    expect(() => unsub()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('exitApp resolves without doing anything', async () => {
    await expect(exitApp()).resolves.toBeUndefined();
  });
});
