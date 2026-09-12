// ABOUT: Global test setup — extends expect with jest-dom matchers and installs the matchMedia
// ABOUT: fake jsdom lacks. Resets the wakeLock owner set and the matchMedia fake between tests;
// ABOUT: both are module-level state that would otherwise leak across tests within a file.

import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

import { __resetWakeLockForTest } from '@/lib/wakeLock';
import { installMatchMediaFake, resetMatchMediaFake } from '@/test-utils/matchMedia';

installMatchMediaFake();

beforeEach(() => {
  __resetWakeLockForTest();
  resetMatchMediaFake();
});
