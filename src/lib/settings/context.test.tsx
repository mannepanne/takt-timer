// ABOUT: Unit tests for SettingsProvider and useSettings — accent, sound, and the appearance mode.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/i18n/context';
import { SessionProvider } from '@/lib/auth/session';
import { setPrefersDark } from '@/test-utils/matchMedia';
import { SettingsProvider, useSettings } from './context';

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({ getMe: vi.fn() }));

import { apiFetch } from '@/lib/apiFetch';
import { getMe } from '@/lib/auth/client';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
  vi.mocked(getMe).mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>
    <SessionProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </SessionProvider>
  </I18nProvider>
);

function makeAuthWrapper(serverSettings: object) {
  const ok200 = new Response(JSON.stringify(serverSettings), { status: 200 });
  return ({ children }: { children: React.ReactNode }) => {
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'u1', isAdmin: false });
    vi.mocked(apiFetch).mockResolvedValue(ok200);
    return (
      <I18nProvider>
        <SessionProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </SessionProvider>
      </I18nProvider>
    );
  };
}

describe('useSettings', () => {
  it('throws when used outside SettingsProvider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used inside SettingsProvider',
    );
  });

  it('defaults to lichen accent and sound on', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.accentId).toBe('lichen');
    expect(result.current.soundOn).toBe(true);
  });

  it('reads accent from localStorage', () => {
    localStorage.setItem('takt.accent.v1', 'coral');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.accentId).toBe('coral');
  });

  it('reads sound from localStorage', () => {
    localStorage.setItem('takt.sound.v1', '0');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.soundOn).toBe(false);
  });

  it('setAccent persists to localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setAccent('iris'));
    expect(result.current.accentId).toBe('iris');
    expect(localStorage.getItem('takt.accent.v1')).toBe('iris');
  });

  it('setSoundOn persists to localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSoundOn(false));
    expect(result.current.soundOn).toBe(false);
    expect(localStorage.getItem('takt.sound.v1')).toBe('0');
  });

  it('setSoundOn to true writes 1 to localStorage', () => {
    localStorage.setItem('takt.sound.v1', '0');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSoundOn(true));
    expect(localStorage.getItem('takt.sound.v1')).toBe('1');
  });

  it('falls back to lichen for an unknown accent in localStorage', () => {
    localStorage.setItem('takt.accent.v1', 'magenta');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.accentId).toBe('lichen');
  });

  it('applies server settings when user authenticates', async () => {
    const authWrapper = makeAuthWrapper({
      language: 'sv',
      accent_colour: 'coral',
      sound_on: 0,
    });
    const { result } = renderHook(() => useSettings(), { wrapper: authWrapper });
    await waitFor(() => {
      expect(result.current.accentId).toBe('coral');
      expect(result.current.soundOn).toBe(false);
    });
    expect(localStorage.getItem('takt.accent.v1')).toBe('coral');
    expect(localStorage.getItem('takt.sound.v1')).toBe('0');
  });

  it('putAllSettings fires PUT when authenticated', async () => {
    const putMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'u1', isAdmin: false });
    // First call is the GET /api/me/settings; subsequent calls are PUTs.
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockImplementation(putMock);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    act(() => result.current.putAllSettings({ language: 'sv' }));
    await waitFor(() => expect(putMock).toHaveBeenCalled());
    const [url, init] = putMock.mock.calls[0];
    expect(url).toBe('/api/me/settings');
    expect(JSON.parse(init.body)).toMatchObject({ language: 'sv' });
  });

  it('setAccent fires PUT when authenticated', async () => {
    const putMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'u1', isAdmin: false });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockImplementation(putMock);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    act(() => result.current.setAccent('iris'));
    await waitFor(() => expect(putMock).toHaveBeenCalled());
    const [, init] = putMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ accent_colour: 'iris' });
  });

  it('setSoundOn fires PUT when authenticated', async () => {
    const putMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'u1', isAdmin: false });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockImplementation(putMock);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    act(() => result.current.setSoundOn(false));
    await waitFor(() => expect(putMock).toHaveBeenCalled());
    const [, init] = putMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ sound_on: 0 });
  });
});

describe('appearance mode', () => {
  const root = () => document.documentElement;

  beforeEach(() => {
    root().removeAttribute('data-theme');
    document.head.innerHTML =
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f4f0" />' +
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101214" />';
  });

  it('defaults to system, resolved from the OS (light here)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.themeMode).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(root().dataset.theme).toBe('light');
  });

  it('reads a stored mode and stamps the document', () => {
    localStorage.setItem('takt.theme.v1', 'dark');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.themeMode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(root().dataset.theme).toBe('dark');
  });

  it('falls back to system for garbage in localStorage', () => {
    localStorage.setItem('takt.theme.v1', 'sepia');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.themeMode).toBe('system');
  });

  it('setThemeMode persists to localStorage and re-stamps the document', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setThemeMode('dark'));
    expect(localStorage.getItem('takt.theme.v1')).toBe('dark');
    expect(root().dataset.theme).toBe('dark');
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect([...metas].every((m) => m.content === '#101214')).toBe(true);
  });

  it('system follows the OS live, without a reload', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => setPrefersDark(true));
    expect(result.current.resolvedTheme).toBe('dark');
    expect(root().dataset.theme).toBe('dark');
    act(() => setPrefersDark(false));
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('an explicit mode ignores the OS in both directions', () => {
    setPrefersDark(true);
    localStorage.setItem('takt.theme.v1', 'light');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.resolvedTheme).toBe('light');
    act(() => setPrefersDark(false));
    act(() => result.current.setThemeMode('dark'));
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('re-reads the OS preference when the app returns to the foreground', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    // The OS flips while the app is backgrounded and no change event reaches the WebView …
    setPrefersDark(true, false);
    expect(result.current.resolvedTheme).toBe('light');
    // … so coming back to the foreground must re-read it.
    const setVisibility = (state: DocumentVisibilityState) =>
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    try {
      setVisibility('hidden');
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      setVisibility('visible');
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(result.current.resolvedTheme).toBe('dark');
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
  });

  it('writes the authored accent shades in light and derived ones in dark', () => {
    localStorage.setItem('takt.accent.v1', 'coral');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(root().style.getPropertyValue('--accent-deep')).toBe('#ab3636');
    act(() => result.current.setThemeMode('dark'));
    expect(root().style.getPropertyValue('--accent')).toBe('#e05c5c');
    expect(root().style.getPropertyValue('--accent-deep')).toBe(
      'color-mix(in srgb, #e05c5c 72%, white)',
    );
    expect(root().style.getPropertyValue('--accent-soft')).toBe(
      'color-mix(in srgb, #e05c5c 24%, transparent)',
    );
  });

  it('never syncs the appearance to the server, even when authenticated', async () => {
    const putMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'u1', isAdmin: false });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockImplementation(putMock);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    act(() => result.current.setThemeMode('dark'));
    expect(putMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('takt.theme.v1')).toBe('dark');
  });

  it('does not let a server settings fetch touch the appearance', async () => {
    localStorage.setItem('takt.theme.v1', 'dark');
    const authWrapper = makeAuthWrapper({ language: 'en', accent_colour: 'coral', sound_on: 1 });
    const { result } = renderHook(() => useSettings(), { wrapper: authWrapper });
    await waitFor(() => expect(result.current.accentId).toBe('coral'));
    expect(result.current.themeMode).toBe('dark');
  });
});
