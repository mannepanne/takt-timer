// ABOUT: Unit tests for detectLanguage — locale-string to Lang mapping.

import { describe, it, expect } from 'vitest';
import { detectLanguage } from './detect';

describe('detectLanguage', () => {
  it('maps sv-SE to sv', () => {
    expect(detectLanguage({ language: 'sv-SE' })).toBe('sv');
  });

  it('maps sv (bare tag) to sv', () => {
    expect(detectLanguage({ language: 'sv' })).toBe('sv');
  });

  it('maps sv-FI to sv', () => {
    expect(detectLanguage({ language: 'sv-FI' })).toBe('sv');
  });

  it('maps en-GB to en', () => {
    expect(detectLanguage({ language: 'en-GB' })).toBe('en');
  });

  it('maps en-US to en', () => {
    expect(detectLanguage({ language: 'en-US' })).toBe('en');
  });

  it('maps fr-FR to en (fallback)', () => {
    expect(detectLanguage({ language: 'fr-FR' })).toBe('en');
  });

  it('maps empty string to en (fallback)', () => {
    expect(detectLanguage({ language: '' })).toBe('en');
  });

  it('is case-insensitive for SV-SE', () => {
    expect(detectLanguage({ language: 'SV-SE' })).toBe('sv');
  });
});
