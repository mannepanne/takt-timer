# ADR: Capacitor wraps the existing SPA for the Android release

**Date:** 2026-07-26
**Status:** Active

---

## Decision

Phase 7 packages Takt for Android using Capacitor, which wraps a Vite build output in a native WebView shell (`android/`, generated via `npx cap add android`). There is no native rewrite and no cross-platform UI framework rewrite. The Android build reuses `src/` — the same components, state machines, styling, and i18n — with a small amount of runtime platform branching (`Capacitor.isNativePlatform()`), and ships with device-scoped local storage instead of the existing passkey/D1 account system — no login, no cloud sync, no personal data collected. iOS is deliberately deferred (the yearly Apple Developer fee isn't something Magnus wants to pay right now) but is structurally cheap to add later via `@capacitor/ios`, since it packages the same shared codebase.

**Amendment (same day, pre-implementation):** `/review-spec` found that a single, byte-identical build shared between web and native cannot honestly satisfy the "zero network requests, ever" requirement Magnus set for the Android build — `index.html`'s Google Fonts links and Cloudflare Analytics beacon load unconditionally, outside anything React-level runtime branching can guard, and `SessionProvider` fires a network call on mount before any platform check runs. The decision is refined, not reversed: native gets its **own Vite build mode/entry** (self-hosted fonts, no analytics script, `INTERNET` permission removed from the manifest, `connect-src 'none'` CSP), while everything inside the shared component tree still branches at runtime as originally decided. `src/` remains one codebase; there are now two build _targets_ rather than one build artifact reused verbatim. See the spec's "Native gets a distinct build variant" architecture decision for the mechanism.

**Amendment (2026-08-09, 07b implementation):** the WebView origin — locked-before-first-release per the spec but never given a concrete value there — is **`https://localhost`** (`server.androidScheme: 'https'`, no custom `hostname`, which is Capacitor's Android default). This is now immutable, on par with the application ID `org.hultberg.takt`. It is the storage key under which every user's `localStorage` lives (`takt.presets.v1`, `takt.history.v1`, `takt.stopwatch.v1`); changing it in any later release orphans all local data with no migration path. `https` (not `http`) is chosen because it yields a secure context, which `crypto.randomUUID()` (used by the local presets store) and other secure-context Web APIs require. Note that this origin is a **virtual** one: Capacitor's `WebViewAssetLoader` intercepts requests to `https://localhost` and serves the app's bundled assets from inside the APK — no socket is bound, no port is listened on, and each app's WebView storage is OS-sandboxed, so the origin cannot collide with anything else on the device. It is a filing label for local data, not a network address.

## Context

The goal of Phase 7 is to learn the real Google Play publishing pipeline — signing, store listing, review, the closed-testing gate — by shipping a genuinely purchasable (£0.99) Android app, not to maximise revenue or reach native feature parity with the web app. That goal shapes the whole decision: minimise new surface area, reuse everything that already works, and don't build more product than a symbolic-price learning project needs.

## Alternatives considered

- **Native rewrite (Kotlin + Jetpack Compose).** Full native fidelity and platform idioms.
  - Why not: throws away the entire existing React/TypeScript implementation — `TimerMachine`, i18n, styling, PWA groundwork — and rebuilds it from scratch for a £0.99 learning project. Wildly disproportionate effort for the stated goal.

- **React Native.** Shares "React" branding with the existing stack.
  - Why not: RN's component model isn't the DOM. Every screen, every CSS custom property, the whole hand-ported design system would need re-authoring against RN primitives. No meaningful code reuse despite the shared language.

- **PWA "Add to Home Screen" only, no native wrapper.** Already works today, genuinely free.
  - Why not: fails the actual goal outright — it isn't distributable or purchasable through Google Play, which is the point of this phase.

- **Chosen: Capacitor wrapping the existing Vite build.** `vite build` output becomes the WebView's content; a thin native shell provides the installable app, the Play Store listing surface, and access to any native APIs needed later.
  - Why this won: near-total reuse of the existing codebase, a native shell was needed as the whole point regardless, and the same investment keeps an iOS build cheap to add later.

## Reasoning

Every other option either discards the existing codebase (native rewrite, React Native) or fails to meet the actual requirement of being sellable through Google Play (PWA-only). Capacitor is the only option that reuses `src/` wholesale while still producing a real, installable, store-listed app. Given the stated goal is learning the app-store pipeline itself, spending effort on a UI rewrite would be optimising the wrong thing.

## Trade-offs accepted

**Two separate release cadences.** The web app deploys automatically on merge to `main` (GitHub Actions). The Android build does not, and can't — Play Store review and the closed-testing gate mean it needs a manual signed-build-and-upload step. No CI parity between the two for this phase.

**No shared auth with the web app.** The wrapped app runs from a `capacitor://` / custom-scheme origin, which the existing session cookie (`SameSite=Lax`) and origin allowlist don't recognise. Phase 7 sidesteps this rather than solving it — presets, history, and usage counts are local-only, so the Android build never calls an authenticated endpoint. Revisit if cloud backup becomes a real requirement later.

**WebView is a new runtime dependency.** Android WebView version varies across OEMs and OS versions in a way pure web development doesn't have to consider. Accepted as low-risk given the app has no heavy graphics or WebGL usage.

**Store-review risk if the wrapper "looks like a website."** Google Play is more lenient than Apple here, but a listing with visible browser chrome or no native polish can still draw scrutiny. Mitigated by giving it a proper icon, splash screen, and no visible browser UI.

## Implications

**Enables:**

- Reuses the entire existing timer/voice/presets frontend for Android in days, not weeks.
- Keeps an iOS release cheap to add later via `@capacitor/ios` — same web build, no rewrite — once the Apple Developer fee is worth paying.
- Web and Android share one component tree, so UI features can't silently drift apart between platforms.

**Prevents / complicates:**

- True native platform idioms (Material You theming, Android-specific gesture patterns) aren't available for free — they'd need native code the wrapper doesn't provide by default.
- Anything requiring genuine native performance (not a concern for this app) would force a reconsideration of this decision.

---

## References

- Related ADRs: [2026-04-19-vite-spa-over-nextjs.md](./2026-04-19-vite-spa-over-nextjs.md) — same "match the build to what the product actually needs" reasoning, applied here to platform packaging instead of the web framework choice.
- Phase spec: [SPECIFICATIONS/07-android-app.md](../../SPECIFICATIONS/07-android-app.md)
- Technology defaults: [.claude/COLLABORATION/technology-preferences.md](../../.claude/COLLABORATION/technology-preferences.md)
