import { afterEach, describe, expect, it, vi } from 'vitest';

import { haptic } from './haptics';

describe('haptic', () => {
  afterEach(() => {
    // @ts-expect-error — reset after each test
    delete navigator.vibrate;
  });

  it('calls navigator.vibrate with the correct pattern when supported', () => {
    const fn = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: fn });
    haptic('phase');
    expect(fn).toHaveBeenCalledWith(15);
    haptic('complete');
    expect(fn).toHaveBeenLastCalledWith([30, 80, 30]);
  });

  it('is a no-op when navigator.vibrate is undefined (iOS)', () => {
    // @ts-expect-error — simulate iOS
    delete navigator.vibrate;
    expect(() => haptic('start')).not.toThrow();
  });

  it('swallows errors from navigator.vibrate', () => {
    const fn = vi.fn(() => {
      throw new Error('some-iframe-error');
    });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: fn });
    expect(() => haptic('repeat')).not.toThrow();
  });
});
