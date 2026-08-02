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

- [ ] Add `@capacitor/core`, `@capacitor/android`; generate `android/` via `npx cap add android`, checked into the repo.
- [ ] `capacitor.config.ts` at repo root. **`androidScheme` + hostname (the WebView origin) is LOCKED before first release** — changing it later silently orphans every user's `localStorage` data (`takt.history.v1`, `takt.stopwatch.v1`, the presets key) with no migration path. Treat as immutable, on par with the application ID.
- [ ] Application ID `org.hultberg.takt` (mirrors `takt.hultberg.org`). Locked before first publish — can never change afterwards (see Capacitor ADR).
- [ ] **A distinct native Vite build mode**, not a byte-identical copy of the web bundle. Via a **mode-aware `transformIndexHtml` over the single `index.html`** — _not_ a forked `index.native.html`, which would silently drift as tags get added to the web entry. The native transform:
  - Self-hosts Figtree + JetBrains Mono as bundled `woff2` (new `public/fonts/`) instead of the Google Fonts `<link>`.
  - Omits the Cloudflare Web Analytics `<script>` entirely.
  - Injects a **scoped** CSP: `connect-src 'none'`, `font-src 'self'`, `script-src 'self'`, etc. **Not** a blanket `default-src 'none'` — that would stop the local WebView app loading at all.
- [ ] Service worker registration disabled for the native build. Must be a **build-time stub/alias for `virtual:pwa-register`, not a runtime `isNativePlatform()` guard** — disabling VitePWA removes the virtual module, so a bare `import` fails at _build_ time, which a runtime check runs too late to prevent. `main.tsx`'s `registerSW()` call goes through this alias.
- [ ] `android.permission.INTERNET` removed from the generated manifest. Note the division of labour, both needed:
  - Removing `INTERNET` prevents genuine off-device sockets (OS-enforced).
  - The scoped CSP makes a stray app-level `fetch` to a relative `/api/...` path (which would otherwise resolve against the local WebView origin) fail loudly.
- [ ] **`INTERNET`-removal must be durable across `npx cap sync` and Android's manifest merger** — the merger can re-introduce the permission from a dependency library. Use `tools:node="remove"` (or equivalent) and back it with a merged-manifest check.
- [ ] `src/lib/platform.ts` — `isNativePlatform()` wrapper (thin shim over `Capacitor.isNativePlatform()`), the single import every runtime branch elsewhere uses.
- [ ] App identity assets: icon + splash from the existing PWA SVG source. `scripts/gen-icons.mjs` already generates from SVG (flat `#F5F4F0` background, "takt" wordmark, green accent bar) with a maskable safe-zone variant — extend it to emit a transparent-background foreground layer + solid background layer for Android's adaptive-icon format. Small addition, not new artwork.

## Out of scope (belongs to later deliverables)

- Auth/network no-op inside the React tree (`SessionProvider` etc.) → **07c**.
- Local presets, `@/lib/presets` alias → **07d**.
- Native `wakeLock.ts` backing → **07e**.
- Native voice, `<queries>` block, `RECORD_AUDIO` → **07f**.
- Back-button / lifecycle wiring, copy forks → **07g**.
- Signing, store listing, publishing → **07h**.

## Acceptance criteria

- [ ] `npx cap sync android` produces a buildable Gradle project; a debug build installs and launches on a real device, showing the app (even if login/presets/voice aren't yet native-correct).
- [ ] The **merged** manifest (`aapt dump` / inspect after a release build) has **no `INTERNET` permission**, and this survives a fresh `cap sync`.
- [ ] The native build's `index.html` loads **no** Google Fonts `<link>` and **no** Cloudflare Analytics `<script>`; fonts render from bundled `woff2`; the scoped CSP is present.
- [ ] The native build completes with VitePWA disabled and **no** build-time error from a dangling `virtual:pwa-register` import.
- [ ] The **web** build is byte-for-byte unchanged in behaviour: existing Vitest suite passes, `index.html` still loads fonts + analytics on web, service worker still registers on web.

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
