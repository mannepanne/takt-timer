// ABOUT: Guards the "Takt's own process makes zero network calls" property against the built APK.
// ABOUT: Asserts the MERGED manifest has no INTERNET permission — the durable check behind tools:node="remove".
//
// The manifest merger can re-introduce INTERNET from a dependency library, so checking the source
// AndroidManifest.xml is not enough — we inspect the actual built artifact. Run after a debug (or
// release) build: `pnpm android:check`. Exits non-zero (failing CI / the release flow) if INTERNET
// is present, if the APK is missing, or if aapt2 can't be found.
//
// 07f will extend this to also assert the RecognitionService <queries> block is present.

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

// Dump the merged manifest from the APK and assert INTERNET is absent.
const dump = execFileSync(aapt2, ['dump', 'permissions', apk], { encoding: 'utf8' });
if (/android\.permission\.INTERNET/.test(dump)) {
  fail(
    'INTERNET permission present in the MERGED manifest. tools:node="remove" is not taking effect — ' +
      'a dependency library likely re-introduced it. Fix before shipping; the zero-network property is broken.',
  );
}

console.log(
  `✓ android manifest check: no INTERNET permission in merged manifest (${apk.split('/').pop()}, build-tools ${version}).`,
);
