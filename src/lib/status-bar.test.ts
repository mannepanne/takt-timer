// ABOUT: Tests for the web status-bar seam — a deliberate no-op that must stay callable.

import { describe, expect, it } from 'vitest';

import { setStatusBarAppearance } from './status-bar';

describe('status-bar (web seam)', () => {
  it('resolves without touching anything, for either appearance', async () => {
    await expect(setStatusBarAppearance('light')).resolves.toBeUndefined();
    await expect(setStatusBarAppearance('dark')).resolves.toBeUndefined();
  });
});
