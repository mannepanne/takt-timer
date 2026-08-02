// ABOUT: Global test setup — extends expect with jest-dom matchers.
// ABOUT: Resets the wakeLock module's owner set between tests; it's module-level state
// ABOUT: that would otherwise leak across tests within the same test file.

import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

import { __resetWakeLockForTest } from '@/lib/wakeLock';

beforeEach(() => {
  __resetWakeLockForTest();
});
