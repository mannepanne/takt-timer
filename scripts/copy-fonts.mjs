// ABOUT: Copies the self-hosted variable font woff2 files from the @fontsource-variable
// ABOUT: packages into public/fonts/, for the native (Android) build which cannot use Google Fonts.
//
// The native build has no INTERNET permission and a `font-src 'self'` CSP, so it serves
// Figtree + JetBrains Mono from bundled woff2 instead of the Google Fonts <link> the web
// build uses.
//
// The committed files in public/fonts/ are the SOURCE OF TRUTH — the native build asserts they
// exist (nativeHtmlPlugin's buildStart) and fails without them. This script only REFRESHES them;
// run `pnpm fonts:copy` after bumping either @fontsource-variable package. Provenance lives here
// rather than being a mystery blob.
//
// We copy only the `latin` normal variable files: they cover English and Swedish (å ä ö
// live in Latin-1, inside the latin subset), all weights via the wght axis, no italics
// (the design uses none).

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'public/fonts');
mkdirSync(dest, { recursive: true });

const sources = [
  {
    from: 'node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2',
    to: 'figtree-latin-wght-normal.woff2',
  },
  {
    from: 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
    to: 'jetbrains-mono-latin-wght-normal.woff2',
  },
];

for (const { from, to } of sources) {
  copyFileSync(resolve(root, from), resolve(dest, to));
  console.log(`copied ${to}`);
}
