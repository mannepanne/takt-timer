// ABOUT: Unit tests for I18nProvider and useI18n — defaults, localStorage, lang switching, param interpolation.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider, useI18n } from './context';
import { isNativePlatform } from '@/lib/platform';

vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(isNativePlatform).mockReturnValue(false);
});
afterEach(() => vi.unstubAllGlobals());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe('useI18n', () => {
  it('throws when used outside I18nProvider', () => {
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used inside I18nProvider');
  });

  it('defaults to en when no localStorage entry and navigator.language is en-GB', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');
  });

  it('defaults to sv when navigator.language is sv-SE and no localStorage entry', () => {
    vi.stubGlobal('navigator', { language: 'sv-SE' });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('sv');
  });

  it('forces en on native even when navigator.language is sv-SE (Android is English-only)', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    vi.stubGlobal('navigator', { language: 'sv-SE' });
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');
  });

  it('forces en on native even when localStorage has sv stored', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    localStorage.setItem('takt.lang.v1', 'sv');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');
  });

  it('reads language from localStorage and overrides navigator.language', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    localStorage.setItem('takt.lang.v1', 'sv');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('sv');
  });

  it('persists language to localStorage when setLang is called', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('sv'));
    expect(localStorage.getItem('takt.lang.v1')).toBe('sv');
  });

  it('t() returns the English string for a known key', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    localStorage.clear();
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('nav.backToHome')).toBe('Back to Home');
  });

  it('t() returns the Swedish string after switching to sv', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('sv'));
    expect(result.current.t('nav.backToHome')).toBe('Tillbaka till start');
  });

  it('t() interpolates a single param', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('en'));
    expect(result.current.t('voice.rateLimit.minutes', { count: 5 })).toBe(
      'You’ve used today’s voice allowance. Try again in 5 minutes.',
    );
  });

  it('t() interpolates multiple params', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('en'));
    expect(result.current.t('run.phase.work', { idx: 2, total: 3 })).toBe('Work · Set 2 / 3');
  });

  it('t() leaves unknown placeholders intact', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('en'));
    expect(result.current.t('run.phase.work', {})).toBe('Work · Set {idx} / {total}');
  });
});
