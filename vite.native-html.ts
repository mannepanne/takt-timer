// ABOUT: The native (Android) build's index.html transform, extracted so it can be unit-tested.
// ABOUT: Strips Google Fonts + Cloudflare Analytics, self-hosts fonts, injects the scoped CSP.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

// The self-hosted fonts the native @font-face points at. They are committed to public/fonts/ (the
// source of truth); scripts/copy-fonts.mjs only refreshes them. The build must FAIL if they are
// missing — otherwise it silently ships an unresolvable @font-face and the app renders in a fallback
// font with no signal. This list is the single check tying the committed binaries to the build.
export const NATIVE_FONT_FILES = [
  'figtree-latin-wght-normal.woff2',
  'jetbrains-mono-latin-wght-normal.woff2',
];

// The scoped Content-Security-Policy for the native build. Deliberately NOT `default-src 'none'`
// (that stops the local WebView app loading at all). `connect-src 'none'` makes any stray app-level
// fetch — e.g. a relative `/api/...` that resolves against the local WebView origin — fail loudly,
// backing up the OS-level guarantee of a manifest with no INTERNET permission.
//
// `style-src` keeps 'unsafe-inline' here even though the web CSP dropped it (#21): the native build
// injects NATIVE_FONT_STYLE as an inline <style> block for the self-hosted @font-face, and a literal
// <style> element IS policed by style-src (unlike React's CSSOM style={{…}}, which isn't). Web has
// no inline <style> — it loads fonts via an external <link>. Do NOT copy the web drop here without
// first moving the @font-face into the bundled stylesheet, or native fonts silently fail to load.
export const NATIVE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  // Note: frame-ancestors is intentionally omitted — it is ignored in a <meta>-delivered CSP
  // (header-only per spec), and framing isn't a concern for a local-content WebView.
].join('; ');

// Self-hosted @font-face for the native build, pointing at the bundled variable woff2 in
// public/fonts/ (see scripts/copy-fonts.mjs). Web keeps the Google Fonts <link>; native cannot.
export const NATIVE_FONT_STYLE = `<style>
      @font-face {
        font-family: 'Figtree';
        font-style: normal;
        font-weight: 300 900;
        font-display: swap;
        src: url('/fonts/figtree-latin-wght-normal.woff2') format('woff2');
      }
      @font-face {
        font-family: 'JetBrains Mono';
        font-style: normal;
        font-weight: 100 800;
        font-display: swap;
        src: url('/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2');
      }
    </style>`;

/**
 * Rewrite `index.html` for the native build: strip the Google Fonts links and the Cloudflare
 * Analytics beacon, self-host the fonts, and inject the scoped CSP. Pure function so a test can
 * assert the "zero network" property on the output directly. Throws if a network font/analytics
 * host survives the strip — the property must be structural, not observed in QA.
 */
export function transformNativeHtml(html: string): string {
  let out = html
    // Google Fonts preconnect + stylesheet links (no `>` until each tag closes, so [^>] spans lines).
    .replace(/\s*<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
    // Cloudflare Web Analytics comment + beacon script.
    .replace(/\s*<!--\s*Cloudflare Web Analytics[\s\S]*?-->/g, '')
    .replace(/\s*<script[^>]*cloudflareinsights\.com[\s\S]*?<\/script>/g, '');

  if (/fonts\.(?:googleapis|gstatic)\.com|cloudflareinsights\.com/.test(out)) {
    throw new Error(
      'takt-native-html: index.html still references a network font/analytics host after transform',
    );
  }

  const head = `${NATIVE_FONT_STYLE}\n    <meta http-equiv="Content-Security-Policy" content="${NATIVE_CSP}" />\n  </head>`;
  return out.replace('</head>', head);
}

/**
 * Vite plugin wrapper. Editing the one entry file (rather than forking `index.native.html`) means
 * new tags added to the web entry can't silently miss the native path. A no-op on the web build,
 * because it is only registered when `--mode native` is active.
 */
export function nativeHtmlPlugin(): Plugin {
  return {
    name: 'takt-native-html',
    buildStart() {
      // Fail early if a bundled font is missing — the native @font-face would otherwise resolve to
      // nothing and the app would silently render in a fallback font.
      const fontsDir = resolve(process.cwd(), 'public/fonts');
      const missing = NATIVE_FONT_FILES.filter((f) => !existsSync(resolve(fontsDir, f)));
      if (missing.length > 0) {
        throw new Error(
          `takt-native-html: missing self-hosted font(s) in public/fonts/: ${missing.join(', ')}. ` +
            'Run `pnpm fonts:copy` to restore them from @fontsource-variable/*.',
        );
      }
    },
    transformIndexHtml(html) {
      return transformNativeHtml(html);
    },
  };
}
