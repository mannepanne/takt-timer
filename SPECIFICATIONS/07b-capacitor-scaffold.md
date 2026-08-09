# Phase 7b: Capacitor scaffold + native build variant

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first. This deliverable is the foundation everything else builds on: the native project exists, produces an installable app, and Takt's own "no network calls" property is structurally enforced.

**Depends on:** nothing (can run alongside 07a).
**Gates:** 07c, 07d, 07e, 07f (all need the native project and build variant to exist).
**Shippable?** Produces an installable — though not yet usable — app (no login handling, no local presets, no native voice). Its job is the build machinery, not the UX.

---

## Goal

Package the existing Vite build as an Android app via Capacitor, reusing `src/` wholesale, and make **Takt's own process make zero network calls** a structural property of the build rather than something observed in QA. Everything the React tree does at runtime is out of scope here — this deliverable is the build variant and the manifest, not the app's behaviour.

---

## Scope

- [x] Add `@capacitor/core`, `@capacitor/android`; generate `android/` via `npx cap add android`, checked into the repo. (Capacitor 8.5.0; `@capacitor/cli` a devDep.)
- [x] `capacitor.config.ts` at repo root. **`androidScheme` + hostname (the WebView origin) is LOCKED before first release** — changing it later silently orphans every user's `localStorage` data (`takt.history.v1`, `takt.stopwatch.v1`, the presets key) with no migration path. Treat as immutable, on par with the application ID. **Locked value: `https://localhost`** (`androidScheme: 'https'`, default `localhost` hostname) — recorded in the [Capacitor ADR](../REFERENCE/decisions/2026-07-26-capacitor-android-wrapper.md).
- [x] Application ID `org.hultberg.takt` (mirrors `takt.hultberg.org`). Locked before first publish — can never change afterwards (see Capacitor ADR).
- [x] **A distinct native Vite build mode** (`vite build --mode native` → `dist-native/`), not a byte-identical copy of the web bundle. Via a **mode-aware `transformIndexHtml` over the single `index.html`** (`vite.native-html.ts`) — _not_ a forked `index.native.html`, which would silently drift as tags get added to the web entry. The native transform:
  - Self-hosts Figtree + JetBrains Mono as bundled variable `woff2` (`public/fonts/`, copied by `scripts/copy-fonts.mjs` from `@fontsource-variable/*`) instead of the Google Fonts `<link>`.
  - Omits the Cloudflare Web Analytics `<script>` entirely.
  - Injects a **scoped** CSP: `connect-src 'none'`, `font-src 'self'`, `script-src 'self'`, etc. **Not** a blanket `default-src 'none'` — that would stop the local WebView app loading at all.
- [x] Service worker registration disabled for the native build. A **build-time alias for `virtual:pwa-register`** (`src/lib/pwa-register-stub.ts`), not a runtime `isNativePlatform()` guard — disabling VitePWA removes the virtual module, so a bare `import` fails at _build_ time, which a runtime check runs too late to prevent. `main.tsx`'s `registerSW()` call goes through this alias.
- [x] `android.permission.INTERNET` removed from the generated manifest. Note the division of labour, both needed:
  - Removing `INTERNET` prevents genuine off-device sockets (OS-enforced).
  - The scoped CSP makes a stray app-level `fetch` to a relative `/api/...` path (which would otherwise resolve against the local WebView origin) fail loudly.
- [x] **`INTERNET`-removal is durable across `npx cap sync` and Android's manifest merger** — `tools:node="remove"` in `AndroidManifest.xml`, backed by the merged-manifest check `scripts/check-android-manifest.mjs` (`pnpm android:check`) which inspects the built APK.
- [x] `src/lib/platform.ts` — `isNativePlatform()` wrapper (thin shim over `Capacitor.isNativePlatform()`), the single import every runtime branch elsewhere uses.
- [x] App identity assets: adaptive icon + splash from the existing PWA SVG source. `scripts/gen-icons.mjs` extended to emit, into the Android res tree, the adaptive foreground (transparent, wordmark scaled to `0.62` so a circular mask doesn't clip it), legacy square + circular launcher PNGs at all five densities, and a splash logo; background colour set to `#F5F4F0`; splash is a single layer-list drawable (`drawable/splash.xml`) replacing the per-density raster overrides. Small addition, no new artwork.

## Out of scope (belongs to later deliverables)

- Auth/network no-op inside the React tree (`SessionProvider` etc.) → **07c**.
- Local presets, `@/lib/presets` alias → **07d**.
- Native `wakeLock.ts` backing → **07e**.
- Native voice, `<queries>` block, `RECORD_AUDIO` → **07f**.
- Back-button / lifecycle wiring, copy forks → **07g**.
- Signing, store listing, publishing → **07h**.

## Acceptance criteria

- [x] `pnpm cap:sync` (`build:native` → `cap sync android`) produces a buildable Gradle project; `./gradlew assembleDebug` builds `app-debug.apk`, which **installs and launches on a real device** (OnePlus `CPH2581`, Android 16) showing the app.
- [x] The **merged** manifest (`aapt2 dump permissions` of the built APK, via `pnpm android:check`) has **no `INTERNET` permission**, and this survives a fresh `cap sync` (`tools:node="remove"` + the check).
- [x] The native build's `index.html` loads **no** Google Fonts `<link>` and **no** Cloudflare Analytics `<script>`; fonts render from bundled `woff2`; the scoped CSP is present. Enforced by `vite.native-html.test.ts`.
- [x] The native build completes with VitePWA disabled and **no** build-time error from a dangling `virtual:pwa-register` import (build-time alias to `src/lib/pwa-register-stub.ts`).
- [x] The **web build's own outputs are unchanged**: the Vitest suite passes (967), `dist/index.html` still loads fonts + analytics, `dist/sw.js` still generated. Native carries none of these. **Caveat:** the safe-area-inset CSS added to shared `src/styles.css` (below) _is_ live on web — inert on desktop/non-notched, but active on notched mobile browsers / an iOS home-screen PWA (`viewport-fit=cover`). That's a deliberate improvement (the skip link previously sat under the notch on web PWA), not a regression, but it is a live-web change, not "web untouched".

**CSP exercised, not just asserted:** the native bundle was served (`vite preview --mode native`) and loaded in a real browser CSP engine. Under the scoped CSP the full app renders — onboarding _and_ the main "What cadence do you need?" screen — with the self-hosted Figtree font, **zero** console violations, and the **only** network request being the bundled `woff2` (no Google Fonts, no analytics, no `/api`). So `connect-src 'none'` + `style-src 'self' 'unsafe-inline'` do not blank the app.

**Device-verified (OnePlus `CPH2581`, Android 16):** installs, launches, renders onboarding / main / settings / session-editor correctly, adaptive launcher icon shows. Two rounds of on-device feedback drove safe-area-inset fixes (`.screen`, `.drawer`, `.onboarding`, overlays) so content clears the status bar and gesture-nav bar. Android 16 uses the system `SplashScreen` API, so `drawable/splash.xml` is superseded by the system splash (icon on `#F5F4F0`) — acceptable. Native-only UI leaks found on-device (Settings "Sign in / create account", onboarding slide-3 passkey copy) are **out of scope for 07b** — they need `isNativePlatform()` React-tree branching and are routed to 07c (auth no-op) / 07g (copy fork).

## Testing

- Merged-manifest assertion for `INTERNET`-absent, in the manifest-check harness (shared with 07f's `<queries>`-present check).
- A build-level check that the native `index.html` output contains no `fonts.googleapis.com` / analytics beacon and does contain the scoped CSP.
- Existing Vitest suite must pass unchanged (proves the web path is untouched).

## Risks specific to this deliverable

- **WebView origin is a one-way door** — lock it here, document it as immutable.
- **Manifest merger re-introducing `INTERNET`** — the durable-removal directive is the mitigation; the merged-manifest check is the guard.
- **A wrapped-website look drawing store scrutiny** (07h risk, but the icon/splash groundwork is here) — ship proper adaptive icon + splash, no visible browser chrome.

## PR workflow

Branch `feature/phase-7b-capacitor-scaffold`. New build tooling + a generated native project — `/review-pr`, expect standard tier. Consider `/review-pr-team` given the build-variant machinery is the load-bearing "no network" guarantee.
