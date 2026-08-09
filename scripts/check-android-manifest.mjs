// ABOUT: Guards the native APK's manifest invariants — the durable checks behind cap sync.
// ABOUT: Asserts the MERGED manifest's platform permissions are EXACTLY an allowlist ({RECORD_AUDIO},
// ABOUT: so INTERNET or any surprise permission fails) and that the RecognitionService <queries>
// ABOUT: block survives — the speech recogniser is silently unavailable on Android 11+ without it.
//
// The manifest merger can re-introduce INTERNET from a dependency, and can also drop a plugin's
// <queries>/permission across a `cap sync` — so checking the source AndroidManifest.xml is not
// enough; we inspect the actual built artifact. Run after a debug (or release) build:
// `pnpm android:check`. Exits non-zero (failing CI / the release flow) if INTERNET is present, if
// the recogniser surface is missing (07f: without the <queries> block, isRecognitionAvailable()
// returns false on Android 11+ and voice silently always falls back to manual), if the APK is
// missing, or if aapt2 can't be found.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function fail(msg) {
  console.error(`✗ android manifest check: ${msg}`);
  process.exit(1);
}

// Locate the debug APK (the release flow can pass a path as argv[2]).
const apk = process.argv[2] ?? resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(apk)) {
  fail(
    `APK not found at ${apk}. Build it first (pnpm cap:sync && cd android && ./gradlew assembleDebug).`,
  );
}

// Locate aapt2 in the newest installed build-tools.
const sdk =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  resolve(process.env.HOME ?? '', 'Library/Android/sdk');
const buildToolsDir = resolve(sdk, 'build-tools');
if (!existsSync(buildToolsDir)) {
  fail(`Android build-tools not found under ${buildToolsDir}. Set ANDROID_HOME.`);
}
const version = readdirSync(buildToolsDir).sort().reverse()[0];
const aapt2 = resolve(buildToolsDir, version, 'aapt2');
if (!existsSync(aapt2)) {
  fail(`aapt2 not found at ${aapt2}.`);
}

// (1) Assert the platform permission set is EXACTLY the allowlist — an allowlist, not a denylist,
// so a future plugin's manifest merge introducing ANY new android.permission.* (INTERNET,
// ACCESS_NETWORK_STATE, storage, …) fails the build rather than slipping into the Play listing.
// Only android.permission.* are policed; app-private permissions (org.hultberg.takt.*, e.g. the
// androidx-generated DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION) are not capabilities and are ignored.
const ALLOWED_PERMISSIONS = new Set(['android.permission.RECORD_AUDIO']);
const permissions = execFileSync(aapt2, ['dump', 'permissions', apk], { encoding: 'utf8' });
const declared = new Set(
  [...permissions.matchAll(/uses-permission: name='(android\.permission\.[^']+)'/g)].map(
    (m) => m[1],
  ),
);
if (declared.has('android.permission.INTERNET')) {
  fail(
    'INTERNET permission present in the MERGED manifest. tools:node="remove" is not taking effect — ' +
      'a dependency library likely re-introduced it. Fix before shipping; the zero-network property is broken.',
  );
}
const unexpected = [...declared].filter((p) => !ALLOWED_PERMISSIONS.has(p));
if (unexpected.length > 0) {
  fail(
    `Unexpected platform permission(s) in the MERGED manifest: ${unexpected.join(', ')}. ` +
      'A dependency likely contributed them via manifest merge. Add to the allowlist only after a ' +
      'deliberate privacy review, or remove the source; do not let permissions accrete silently.',
  );
}
const missing = [...ALLOWED_PERMISSIONS].filter((p) => !declared.has(p));
if (missing.length > 0) {
  fail(
    `Required permission(s) missing from the MERGED manifest: ${missing.join(', ')}. RECORD_AUDIO is ` +
      'contributed by the speech-recognition plugin — voice capture will fail without it (07f).',
  );
}

const xmltree = execFileSync(aapt2, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml'], {
  encoding: 'utf8',
});
if (!/android\.speech\.RecognitionService/.test(xmltree)) {
  fail(
    'RecognitionService <queries> block missing from the MERGED manifest. On Android 11+ ' +
      'isRecognitionAvailable() returns false without it, so voice silently always falls back to ' +
      'manual — reading as "the parser never works". Must survive cap sync (07f).',
  );
}

console.log(
  `✓ android manifest check: platform permissions = {${[...declared].join(', ') || 'none'}} ` +
    `(allowlisted, no INTERNET); RecognitionService <queries> present ` +
    `(${apk.split('/').pop()}, build-tools ${version}).`,
);
