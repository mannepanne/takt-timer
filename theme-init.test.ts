// ABOUT: Tests for public/theme-init.js, the pre-paint appearance resolver — run against the real
// ABOUT: file with stubbed globals, and checked against the constants the app uses.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DARK_SCHEME_QUERY, THEME_KEY } from './src/lib/settings/theme';

const source = readFileSync(resolve(__dirname, 'public/theme-init.js'), 'utf8');

type Run = {
  stored?: string | null;
  systemDark?: boolean;
  storageThrows?: boolean;
  noMatchMedia?: boolean;
};

function run({
  stored = null,
  systemDark = false,
  storageThrows = false,
  noMatchMedia = false,
}: Run) {
  const attrs: Record<string, string> = {};
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
  };
  const localStorage = storageThrows
    ? {
        getItem: () => {
          throw new Error('blocked');
        },
      }
    : { getItem: (key: string) => (key === THEME_KEY ? stored : null) };
  const window = noMatchMedia
    ? {}
    : { matchMedia: (query: string) => ({ matches: query === DARK_SCHEME_QUERY && systemDark }) };
  new Function('window', 'document', 'localStorage', source)(window, document, localStorage);
  return attrs['data-theme'];
}

describe('theme-init.js', () => {
  it('system follows the OS', () => {
    expect(run({ systemDark: true })).toBe('dark');
    expect(run({ systemDark: false })).toBe('light');
    expect(run({ stored: 'system', systemDark: true })).toBe('dark');
  });

  it('explicit modes ignore the OS', () => {
    expect(run({ stored: 'dark', systemDark: false })).toBe('dark');
    expect(run({ stored: 'light', systemDark: true })).toBe('light');
  });

  it('treats garbage as system', () => {
    expect(run({ stored: 'sepia', systemDark: true })).toBe('dark');
    expect(run({ stored: 'sepia', systemDark: false })).toBe('light');
  });

  it('degrades to light when storage throws or matchMedia is missing', () => {
    expect(run({ storageThrows: true, systemDark: false })).toBe('light');
    expect(run({ storageThrows: true, systemDark: true })).toBe('dark');
    expect(run({ stored: 'system', noMatchMedia: true })).toBe('light');
  });

  it('uses the same storage key and media query as the app', () => {
    expect(source).toContain(`'${THEME_KEY}'`);
    expect(source).toContain(`'${DARK_SCHEME_QUERY}'`);
  });

  it('is plain ES5 — no arrow functions, const/let, or template strings for old WebViews', () => {
    expect(source).not.toMatch(/=>|\bconst\b|\blet\b|`/);
  });
});
