// ABOUT: React context providing accent colour and sound-on/off state.
// ABOUT: Persists to localStorage immediately; syncs to D1 for authenticated users.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/context';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from '@/lib/auth/session';
import { isNativePlatform } from '@/lib/platform';
import { DEFAULT_ACCENT_ID, findAccent, type AccentId } from './accents';

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

function applyAccentCss(accentId: AccentId) {
  const accent = findAccent(accentId);
  const root = document.documentElement;
  root.style.setProperty('--accent', accent.main);
  root.style.setProperty('--accent-deep', accent.deep);
  root.style.setProperty('--accent-soft', accent.soft);
}

export interface SettingsContextValue {
  accentId: AccentId;
  soundOn: boolean;
  setAccent: (id: AccentId) => void;
  setSoundOn: (on: boolean) => void;
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

  // Apply CSS whenever accent changes.
  useEffect(() => {
    applyAccentCss(accentId);
  }, [accentId]);

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

  const value = useMemo(
    () => ({ accentId, soundOn, setAccent, setSoundOn, putAllSettings }),
    [accentId, soundOn, setAccent, setSoundOn, putAllSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
