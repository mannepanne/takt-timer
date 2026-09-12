// ABOUT: Unit tests for the appearance helpers — storage, resolution, DOM side effects, and the
// ABOUT: contract they share with styles.css and public/theme-init.js.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import css from '@/styles.css?raw';
import nightColours from '../../../android/app/src/main/res/values-night/colors.xml?raw';
import dayColours from '../../../android/app/src/main/res/values/colors.xml?raw';
import { setPrefersDark } from '@/test-utils/matchMedia';

import {
  DARK_SCHEME_QUERY,
  PAPER,
  THEME_KEY,
  applyThemeToDocument,
  darkAccentShades,
  isThemeMode,
  prefersDark,
  readStoredTheme,
  resolveTheme,
  subscribeSystemTheme,
  writeStoredTheme,
} from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f4f0" />' +
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101214" />';
});
afterEach(() => {
  document.head.innerHTML = '';
});

describe('isThemeMode / readStoredTheme', () => {
  it('accepts exactly the three modes', () => {
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('sepia')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it('defaults to system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('reads a stored mode and ignores garbage', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readStoredTheme()).toBe('system');
  });

  it('round-trips through writeStoredTheme', () => {
    writeStoredTheme('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('falls back to system when localStorage throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(readStoredTheme()).toBe('system');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe('resolveTheme / prefersDark', () => {
  it('system follows the OS; explicit modes ignore it', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('prefersDark reads the media query', () => {
    setPrefersDark(false);
    expect(prefersDark()).toBe(false);
    setPrefersDark(true);
    expect(prefersDark()).toBe(true);
  });

  it('subscribeSystemTheme is a no-op where matchMedia is unavailable', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    try {
      const off = subscribeSystemTheme(() => {
        throw new Error('should never fire');
      });
      expect(() => off()).not.toThrow();
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: original });
    }
  });

  it('subscribeSystemTheme fires on change and unsubscribes cleanly', () => {
    const seen: boolean[] = [];
    const off = subscribeSystemTheme((dark) => seen.push(dark));
    setPrefersDark(true);
    setPrefersDark(false);
    off();
    setPrefersDark(true);
    expect(seen).toEqual([true, false]);
  });
});

describe('applyThemeToDocument', () => {
  it('stamps data-theme and points every theme-color meta at the resolved paper', () => {
    applyThemeToDocument('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect([...metas].map((m) => m.content)).toEqual([PAPER.dark, PAPER.dark]);

    applyThemeToDocument('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect([...metas].map((m) => m.content)).toEqual([PAPER.light, PAPER.light]);
  });
});

describe('darkAccentShades', () => {
  it('derives the deep and soft shades from the accent main colour', () => {
    expect(darkAccentShades('#4ea47a')).toEqual({
      deep: 'color-mix(in srgb, #4ea47a 72%, white)',
      soft: 'color-mix(in srgb, #4ea47a 24%, transparent)',
    });
  });
});

describe('contracts with the stylesheet and the pre-paint script', () => {
  it('PAPER matches --paper in both token blocks of styles.css', () => {
    const light = css.match(/^:root\s*\{[\s\S]*?--paper:\s*([^;]+);/m)?.[1];
    const dark = css.match(/^:root\[data-theme='dark'\]\s*\{[\s\S]*?--paper:\s*([^;]+);/m)?.[1];
    expect(light).toBe(PAPER.light);
    expect(dark).toBe(PAPER.dark);
  });

  it('exports the media query the pre-paint script evaluates', () => {
    expect(DARK_SCHEME_QUERY).toBe('(prefers-color-scheme: dark)');
  });

  it('matches the Android colour resources that paint before the page does', () => {
    // The pre-paint window/WebView background and the splash must be the same paper as the app,
    // or a dark-mode launch flashes a different shade — a bug only a real device would show.
    const colour = (xml: string, name: string) =>
      xml.match(new RegExp(`<color name="${name}">(#[0-9a-fA-F]{6})</color>`))?.[1].toLowerCase();
    expect(colour(dayColours, 'window_background')).toBe(PAPER.light);
    expect(colour(nightColours, 'window_background')).toBe(PAPER.dark);
    expect(colour(nightColours, 'splash_background')).toBe(PAPER.dark);
  });
});
