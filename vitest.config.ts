// ABOUT: Vitest configuration for SPA unit and component tests.
// ABOUT: Worker-runtime tests (with @cloudflare/vitest-pool-workers) arrive in Phase 3.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'worker/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-utils/**',
        'worker/**/*.test.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/components/icons.tsx',
        'src/routes/Spike.tsx',
        // Build-time alias target for the native build (replaces virtual:pwa-register); never runs
        // in the web/test path, so it carries no runtime tests.
        'src/lib/pwa-register-stub.ts',
      ],
      // Recalibrated for vitest 4's AST-aware v8 coverage, which measures the
      // identical suite a few points lower than vitest 2 did. Goal is to climb
      // back to 95/90 — see GitHub issue #101 (technical-debt: restore coverage).
      thresholds: {
        lines: 95,
        functions: 92,
        statements: 94,
        branches: 88,
      },
    },
  },
});
