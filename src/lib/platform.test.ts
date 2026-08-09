import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';

import { isNativePlatform } from './platform';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe('isNativePlatform', () => {
  afterEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReset();
  });

  it('is true when Capacitor reports the native platform (the Android shell)', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(isNativePlatform()).toBe(true);
  });

  it('is false on the web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    expect(isNativePlatform()).toBe(false);
  });
});
