// ABOUT: Tests for the native status-bar seam — the Style inversion, the background fallback, the
// ABOUT: navigation-bar call, and that each call is guarded on its own. Plugins are mocked; icon
// ABOUT: legibility on a real device is verified on hardware.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PAPER } from '@/lib/settings/theme';

const setStyle = vi.fn(async (_options: unknown) => {});
const setBackgroundColor = vi.fn(async (_options: unknown) => {});
const setNavAppearance = vi.fn(async (_options: unknown) => {});
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: (o: unknown) => setStyle(o),
    setBackgroundColor: (o: unknown) => setBackgroundColor(o),
  },
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
}));
vi.mock('@capacitor/core', () => ({
  registerPlugin: (name: string) => {
    if (name !== 'NavigationBar') throw new Error(`unexpected plugin ${name}`);
    return { setAppearance: (o: unknown) => setNavAppearance(o) };
  },
}));

import { setStatusBarAppearance } from './status-bar-native';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('status-bar-native', () => {
  it("a dark appearance asks for Style.Dark — the plugin's names describe the background", async () => {
    await setStatusBarAppearance('dark');
    expect(setStyle).toHaveBeenCalledWith({ style: 'DARK' });
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: PAPER.dark });
    expect(setNavAppearance).toHaveBeenCalledWith({ style: 'dark' });
  });

  it('a light appearance asks for Style.Light and the light paper', async () => {
    await setStatusBarAppearance('light');
    expect(setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: PAPER.light });
    expect(setNavAppearance).toHaveBeenCalledWith({ style: 'light' });
  });

  it('a setStyle failure does not skip the background fallback or the navigation bar', async () => {
    setStyle.mockRejectedValueOnce(new Error('unavailable'));
    await expect(setStatusBarAppearance('dark')).resolves.toBeUndefined();
    expect(setBackgroundColor).toHaveBeenCalledTimes(1);
    expect(setNavAppearance).toHaveBeenCalledTimes(1);
  });

  it('a setBackgroundColor failure does not skip the navigation bar', async () => {
    setBackgroundColor.mockRejectedValueOnce(new Error('unavailable'));
    await expect(setStatusBarAppearance('light')).resolves.toBeUndefined();
    expect(setNavAppearance).toHaveBeenCalledTimes(1);
  });

  it('a navigation-bar failure is swallowed too', async () => {
    setNavAppearance.mockRejectedValueOnce(new Error('unavailable'));
    await expect(setStatusBarAppearance('dark')).resolves.toBeUndefined();
  });
});
