// ABOUT: Vitest configuration for SPA unit and component tests.
// ABOUT: Worker-runtime tests (with @cloudflare/vitest-pool-workers) arrive in Phase 3.

import { defineConfig, type UserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Cast works around a transient vite@6 / vitest@2 plugin-type mismatch.
const plugins = [react()] as UserConfig['plugins'];

export default defineConfig({
  plugins,
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
        'src/components/icons.tsx',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
});
