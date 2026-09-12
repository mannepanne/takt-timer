// ABOUT: Appearance mode (System / Light / Dark) — storage key, resolution against the OS
// ABOUT: preference, and the DOM side effects (the data-theme attribute, the theme-color metas,
// ABOUT: the dark accent shades). Pure helpers; SettingsProvider wires them together.

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const THEME_KEY = 'takt.theme.v1';
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

// The page colour the browser chrome should match — keep in step with --paper in styles.css
// (theme.test.ts checks). Written into every <meta name="theme-color"> when the appearance resolves.
export const PAPER = { light: '#f5f4f0', dark: '#101214' } as const;

// The dark accent derivation. A contract shared with scripts/check-contrast.mjs, which judges these
// exact mixes for contrast — change both together.
const DARK_ACCENT_DEEP_MIX = 72;
const DARK_ACCENT_SOFT_MIX = 24;

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

/** The stored mode, or `system` when nothing valid is stored or storage is unavailable. */
export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // Private mode / blocked storage: behave as if nothing was stored.
  }
  return 'system';
}

export function writeStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
}

/** Whether the OS currently prefers dark. False where matchMedia is unavailable. */
export function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_SCHEME_QUERY).matches;
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}

/** Calls onChange whenever the OS preference flips. Returns an unsubscribe function. */
export function subscribeSystemTheme(onChange: (dark: boolean) => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

/**
 * Stamps the resolved appearance on <html> — the one thing the stylesheet's dark block keys off —
 * and points the theme-color metas at the matching paper so the browser chrome follows. Idempotent:
 * public/theme-init.js has usually already set the same attribute before first paint.
 */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = PAPER[resolved];
  }
}

/** The dark-mode `deep` (lighter) and `soft` (stronger) shades derived from an accent's main colour. */
export function darkAccentShades(main: string): { deep: string; soft: string } {
  return {
    deep: `color-mix(in srgb, ${main} ${DARK_ACCENT_DEEP_MIX}%, white)`,
    soft: `color-mix(in srgb, ${main} ${DARK_ACCENT_SOFT_MIX}%, transparent)`,
  };
}
