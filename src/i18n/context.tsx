// ABOUT: React context providing the active language, a language setter, and the t() translation helper.
// ABOUT: Language is persisted in localStorage (takt.lang.v1); D1 persistence is added in Phase 5 PR 2.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import strings, { type Lang, type StringKey } from './strings';
import { detectLanguage } from './detect';

const STORAGE_KEY = 'takt.lang.v1';

export type TFunc = (key: StringKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'sv') return v;
  } catch {
    // localStorage unavailable
  }
  return null;
}

function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? detectLanguage());

  const setLang = useCallback((next: Lang) => {
    storeLang(next);
    setLangState(next);
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      const raw = strings[key][lang];
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
