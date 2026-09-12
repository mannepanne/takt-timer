// ABOUT: Tests for the native status-bar seam — the Style inversion and the background fallback.
// ABOUT: The plugin is mocked; icon legibility on a real device is verified on hardware.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const setStyle = vi.fn(async (_options: unknown) => {});
const setBackgroundColor = vi.fn(async (_options: unknown) => {});
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: (o: unknown) => setStyle(o),
    setBackgroundColor: (o: unknown) => setBackgroundColor(o),
  },
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
}));

import { setStatusBarAppearance } from './status-bar-native';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('status-bar-native', () => {
  it("a dark appearance asks for Style.Dark — the plugin's names describe the background", async () => {
    await setStatusBarAppearance('dark');
    expect(setStyle).toHaveBeenCalledWith({ style: 'DARK' });
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: '#101214' });
  });

  it('a light appearance asks for Style.Light and the light paper', async () => {
    await setStatusBarAppearance('light');
    expect(setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: '#f5f4f0' });
  });

  it('swallows plugin failures — the app must not break over a status bar', async () => {
    setStyle.mockRejectedValueOnce(new Error('unavailable'));
    await expect(setStatusBarAppearance('dark')).resolves.toBeUndefined();
  });
});
