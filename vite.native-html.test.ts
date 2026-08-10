import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NATIVE_CSP, NATIVE_FONT_FILES, transformNativeHtml } from './vite.native-html';

// The real web entry, so this test tracks index.html as it actually is — if a new network tag is
// added to the web entry, this test exercises the native strip against it rather than a stale copy.
const webHtml = readFileSync(resolve(__dirname, 'index.html'), 'utf8');

describe('transformNativeHtml', () => {
  const out = transformNativeHtml(webHtml);

  it('the web entry it starts from does load Google Fonts + analytics (guards the fixture)', () => {
    expect(webHtml).toMatch(/fonts\.googleapis\.com/);
    expect(webHtml).toMatch(/cloudflareinsights\.com/);
  });

  it('the web entry has no inline style= attributes or <style> blocks (guards the #21 CSP drop)', () => {
    // The web CSP drops 'unsafe-inline' from style-src, which is only safe while index.html carries
    // no literal style= attribute and no <style> block (React's style={{…}} goes through the CSSOM,
    // which style-src doesn't police — but served markup does). Reintroducing either would only
    // surface as a runtime CSP violation in a browser; this fails the build instead. Note the native
    // build deliberately DOES inject a <style> for @font-face and keeps 'unsafe-inline' — that's the
    // transformed output, not this source entry.
    expect(webHtml).not.toMatch(/\sstyle=/);
    expect(webHtml).not.toMatch(/<style[\s>]/);
  });

  it('strips every Google Fonts host from the native output', () => {
    expect(out).not.toMatch(/fonts\.googleapis\.com/);
    expect(out).not.toMatch(/fonts\.gstatic\.com/);
  });

  it('strips the Cloudflare Analytics beacon from the native output', () => {
    expect(out).not.toMatch(/cloudflareinsights\.com/);
    expect(out).not.toMatch(/cf-beacon/);
  });

  it('self-hosts both fonts from bundled woff2', () => {
    expect(out).toContain('/fonts/figtree-latin-wght-normal.woff2');
    expect(out).toContain('/fonts/jetbrains-mono-latin-wght-normal.woff2');
    expect(out).toContain('@font-face');
  });

  it('injects the scoped CSP with connect-src none, not default-src none', () => {
    expect(out).toContain(`content="${NATIVE_CSP}"`);
    expect(out).toContain("connect-src 'none'");
    expect(out).not.toContain("default-src 'none'");
  });

  it('throws if a network font/analytics host survives the strip (property is structural)', () => {
    // A reference outside any <link>/<script>/comment the strip targets — it must not slip through.
    const tampered = '<head><span>load fonts.googleapis.com please</span></head>';
    expect(() => transformNativeHtml(tampered)).toThrow(/network font\/analytics host/);
  });

  it('leaves the app entry script intact', () => {
    expect(out).toContain('/src/main.tsx');
  });

  it('the self-hosted fonts the @font-face references are committed in public/fonts/', () => {
    // public/fonts/ is the source of truth (the native build's buildStart guard fails without them).
    for (const file of NATIVE_FONT_FILES) {
      expect(existsSync(resolve(__dirname, 'public/fonts', file))).toBe(true);
      expect(out).toContain(`/fonts/${file}`);
    }
  });
});
