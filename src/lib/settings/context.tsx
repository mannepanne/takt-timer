// ABOUT: React context providing appearance mode, accent colour and sound-on/off state.
// ABOUT: Persists to localStorage immediately; accent and sound also sync to D1 for authenticated
// ABOUT: users. Appearance never syncs — it is a per-device preference.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/context';
import { apiFetch } from '@/lib/apiFetch';
import { subscribeAppVisibility } from '@/lib/app-lifecycle';
import { useSession } from '@/lib/auth/session';
import { isNativePlatform } from '@/lib/platform';
import { setStatusBarAppearance } from '@/lib/status-bar';
import { DEFAULT_ACCENT_ID, findAccent, type AccentId } from './accents';
import {
  applyThemeToDocument,
  darkAccentShades,
  prefersDark,
  readStoredTheme,
  resolveTheme,
  subscribeSystemTheme,
  writeStoredTheme,
  type ResolvedTheme,
  type ThemeMode,
} from './theme';

const ACCENT_KEY = 'takt.accent.v1';
const SOUND_KEY = 'takt.sound.v1';

function readStoredAccent(): AccentId {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (v) {
      const accent = findAccent(v);
      if (accent.id === v) return v as AccentId;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ACCENT_ID;
}

function readStoredSound(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v !== null) return v !== '0';
  } catch {
    // ignore
  }
  return true;
}

// Accent shades are written inline on <html>, where they beat any stylesheet rule — which is why
// the dark token block carries none. Light uses the hand-authored shades; dark derives lighter
// ones from the main colour, so the accent stays recognisable while its text/icon shade lifts.
function applyAccentCss(accentId: AccentId, theme: ResolvedTheme) {
  const accent = findAccent(accentId);
  const shades = theme === 'dark' ? darkAccentShades(accent.main) : accent;
  const root = document.documentElement;
  root.style.setProperty('--accent', accent.main);
  root.style.setProperty('--accent-deep', shades.deep);
  root.style.setProperty('--accent-soft', shades.soft);
}

export interface SettingsContextValue {
  accentId: AccentId;
  soundOn: boolean;
  /** The chosen appearance mode. */
  themeMode: ThemeMode;
  /** What the mode currently resolves to — System follows the OS, and can change live. */
  resolvedTheme: ResolvedTheme;
  setAccent: (id: AccentId) => void;
  setSoundOn: (on: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  /** Call after setLang() to persist the new language to D1. Pass the new lang explicitly
   *  because React state updates from setLang are async. */
  putAllSettings: (overrides?: { language?: string }) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  const { session } = useSession();
  const isAuthenticated = session.status === 'authenticated';

  const [accentId, setAccentId] = useState<AccentId>(readStoredAccent);
  const [soundOn, setSoundOnState] = useState<boolean>(readStoredSound);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);
  // Bumped on every return to the foreground, so effects keyed on it re-run even when nothing
  // else changed — the OS can restyle the system bars while the app is backgrounded.
  const [foregroundTick, setForegroundTick] = useState(0);
  const resolvedTheme = resolveTheme(themeMode, systemDark);

  // Follow the OS live while in System mode; the subscription is cheap enough to keep always, and
  // an explicit mode simply ignores the value. On return to the foreground re-read it too — the
  // OS may have flipped while the app was backgrounded without a change event reaching the
  // WebView (the app-lifecycle seam maps this to appStateChange on native). One subscription: both
  // state updates batch into a single render, so anything downstream applies exactly once.
  useEffect(() => subscribeSystemTheme(setSystemDark), []);
  useEffect(
    () =>
      subscribeAppVisibility(
        () => {},
        () => {
          setSystemDark(prefersDark());
          setForegroundTick((t) => t + 1);
        },
      ),
    [],
  );

  // Stamp the resolved appearance on the document, then the accent shades that depend on it.
  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);
  // The system bars follow too (a no-op on the web), re-applied on every return to the foreground.
  useEffect(() => {
    void setStatusBarAppearance(resolvedTheme);
  }, [resolvedTheme, foregroundTick]);
  useEffect(() => {
    applyAccentCss(accentId, resolvedTheme);
  }, [accentId, resolvedTheme]);

  // One-shot fetch from server when user authenticates. Platform-gated: native never syncs (07c);
  // settings stay purely localStorage-backed.
  useEffect(() => {
    if (isNativePlatform() || !isAuthenticated) return;
    apiFetch('/api/me/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { language?: string; accent_colour?: string; sound_on?: number } | null) => {
        if (!data) return;
        if (data.language === 'en' || data.language === 'sv') setLang(data.language);
        if (data.accent_colour) {
          const found = findAccent(data.accent_colour);
          setAccentId(found.id);
          try {
            localStorage.setItem(ACCENT_KEY, found.id);
          } catch {
            /* ignore */
          }
        }
        if (typeof data.sound_on === 'number') {
          const on = data.sound_on !== 0;
          setSoundOnState(on);
          try {
            localStorage.setItem(SOUND_KEY, on ? '1' : '0');
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
    // Only run when auth status transitions to authenticated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const persistToServer = useCallback(
    (overrides?: { language?: string; accent_colour?: string; sound_on?: number }) => {
      if (isNativePlatform() || !isAuthenticated) return;
      const body = {
        language: overrides?.language ?? lang,
        accent_colour: overrides?.accent_colour ?? accentId,
        sound_on: overrides?.sound_on ?? (soundOn ? 1 : 0),
      };
      apiFetch('/api/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
    },
    [isAuthenticated, lang, accentId, soundOn],
  );

  const putAllSettings = useCallback(
    (overrides?: { language?: string }) => {
      persistToServer(overrides);
    },
    [persistToServer],
  );

  const setAccent = useCallback(
    (id: AccentId) => {
      setAccentId(id);
      try {
        localStorage.setItem(ACCENT_KEY, id);
      } catch {
        /* ignore */
      }
      persistToServer({ accent_colour: id });
    },
    [persistToServer],
  );

  const setSoundOn = useCallback(
    (on: boolean) => {
      setSoundOnState(on);
      try {
        localStorage.setItem(SOUND_KEY, on ? '1' : '0');
      } catch {
        /* ignore */
      }
      persistToServer({ sound_on: on ? 1 : 0 });
    },
    [persistToServer],
  );

  // Device-scoped: localStorage only, never the server.
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    writeStoredTheme(mode);
  }, []);

  const value = useMemo(
    () => ({
      accentId,
      soundOn,
      themeMode,
      resolvedTheme,
      setAccent,
      setSoundOn,
      setThemeMode,
      putAllSettings,
    }),
    [
      accentId,
      soundOn,
      themeMode,
      resolvedTheme,
      setAccent,
      setSoundOn,
      setThemeMode,
      putAllSettings,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
