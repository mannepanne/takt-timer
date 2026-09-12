// @vitest-environment node
// ABOUT: Guards the native build's module aliases in vite.config.ts. A mistyped alias KEY falls
// ABOUT: through to the '@' catch-all and silently resolves to the web module — CI stays green and
// ABOUT: the APK runs, but the native seam never activates. Each key must name a real web seam and
// ABOUT: each target must exist.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import viteConfig from './vite.config';

type AliasMap = Record<string, string>;

function nativeAliases(): AliasMap {
  const config = (
    viteConfig as (env: { mode: string; command: 'build' }) => { resolve: { alias: AliasMap } }
  )({ mode: 'native', command: 'build' });
  return config.resolve.alias;
}

describe('native build aliases', () => {
  const aliases = nativeAliases();
  const seamKeys = Object.keys(aliases).filter((k) => k.startsWith('@/'));

  it('has the seams the native build depends on', () => {
    expect(seamKeys).toEqual(
      expect.arrayContaining([
        '@/lib/presets',
        '@/lib/wakeLock-platform',
        '@/lib/voice/useVoiceMachine',
        '@/lib/app-lifecycle',
        '@/lib/status-bar',
      ]),
    );
  });

  it.each(seamKeys)('%s names a real web module and an existing native target', (key) => {
    const webModule = resolve(__dirname, 'src', key.slice(2));
    expect(
      existsSync(`${webModule}.ts`) || existsSync(`${webModule}.tsx`),
      `no web seam at src/${key.slice(2)}.ts(x) — a typo here silently resolves to nothing`,
    ).toBe(true);
    expect(existsSync(aliases[key]), `native target missing: ${aliases[key]}`).toBe(true);
  });

  it('keeps every seam key above the "@" catch-all so it wins the first-match resolution', () => {
    const keys = Object.keys(aliases);
    expect(keys.indexOf('@')).toBe(keys.length - 1);
  });
});
