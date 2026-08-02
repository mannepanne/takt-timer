# Phase 7: Android app

## Phase overview

**Phase number:** 7
**Phase name:** Android app — Capacitor wrapper, device-scoped presets and usage, Play Store listing
**Estimated timeframe:** 8–12 days of work — larger than a pure packaging exercise because the on-device voice pipeline (recognizer integration, a new parser, and phrase-corpus validation) is genuinely new logic, not just platform branching. Google Play's closed-testing requirement adds a further 14 days of calendar time on top, which can't be compressed.
**Dependencies:** Phase 2 (core timer) complete, and Timer mode (the count-up stopwatch, #111/#112) complete — the Android build faithfully represents both, so both must be live in `src/` first (they are). Independent of Phase 4's account system — deliberately not reused here (see architecture decisions below).

**Brief description:**
Package the existing Takt SPA as a native Android app using Capacitor, and sell it on Google Play as a flat one-time £0.99 download. No login, no account, no personal data collected — presets, history, and usage counts live entirely on-device. **The app makes zero network requests, ever, for any functionality** — voice-driven session setup runs entirely on-device (local speech recognition + a local intent parser), not the web app's Workers AI pipeline. The primary goal of this phase is learning the real end-to-end app store publishing pipeline (Play Console, signing, review, closed testing), not maximising revenue.

**On feature parity:** the phase does _not_ aim for full parity — accounts and cloud sync are deliberately dropped (see below). But the app's **core timing behaviour is faithfully represented**, and that explicitly includes **both** the interval timer **and Timer mode** (the count-up stopwatch for rep-based exercises). Timer mode was built into the web app first (#111, #112) precisely so it could ship in both surfaces; because Capacitor reuses `src/` wholesale, it comes along for free — but "for free" isn't "for nothing," and the specifics it carries (wake lock, `localStorage` persistence, provider-scoped lifetime) are called out throughout this spec.

**Why web and Android deliberately diverge:** the web app stays exactly as it is — accounts, cloud sync, and analytics all serve real purposes there (registered users across devices, understanding how the live product is used). None of that applies to a locally-installed Android app: the only possible user is the phone's owner, so there's nothing for an account system to distinguish. People bring their phone into gyms and other locations without reliable signal, so the app needs to run a full session — including setting one up — with no connectivity at all. And once the app is required to work fully offline, making it also make zero network calls of any kind (no font downloads, no analytics) is a small further step that buys a genuinely differentiated pitch: **works forever, offline, nothing ever leaves the device, no account, ever** — for £0.99. That's the actual answer to "why would anyone pay for this instead of using the free website," and it's worth stating in the store listing copy, not just in this spec.

---

## Scope and deliverables

### In scope

- [ ] Add Capacitor (`@capacitor/core`, `@capacitor/android`) to the repo; generate the native `android/` project via `npx cap add android`.
- [ ] **A distinct native build variant, not just runtime branching.** `/review-spec` found that a single shared `vite build` output cannot honestly satisfy "zero network" — `index.html` loads Google Fonts and the Cloudflare Web Analytics beacon unconditionally, outside anything `Capacitor.isNativePlatform()` can guard. The native build gets its own Vite mode/entry that: self-hosts Figtree + JetBrains Mono as bundled `woff2` instead of the Google Fonts `<link>`, and omits the Cloudflare Analytics `<script>` entirely. Runtime `isNativePlatform()` branching still handles everything inside the React tree (auth UI, presets backend, voice pipeline).
- [ ] **Auth/network layer is a no-op on native, not merely hidden.** `SessionProvider` (`src/lib/auth/session.tsx`) currently calls `GET /api/auth/me` unconditionally on mount, before any UI decision is made — this must not fire at all on native, not just have its result ignored. Same treatment for `settings/context.tsx`, `history-sync.ts`, and `presets.ts`: on native, these modules are replaced by their local equivalents, not conditionally skipped downstream of a call that already happened.
- [ ] Service worker registration (`registerSW` in `main.tsx`, Workbox config in `vite.config.ts`) disabled for the native build — a stale-JS risk inside a WebView whose content is supposed to update only via Play Store releases. Confirm the `virtual:pwa-register` import Capacitor's build still resolves, or gate the import itself.
- [ ] `android.permission.INTERNET` removed from the generated Android manifest, plus a `connect-src 'none'` CSP in the native `index.html`. This turns "zero network" from a manually-observed property into one the OS enforces — a future accidental `fetch` fails loudly instead of shipping silently.
- [ ] A unit test asserting no `fetch`/`XMLHttpRequest` occurs under native platform detection, as a permanent regression guard — manual proxy verification (see testing strategy) catches the release build; this catches the next code change.
- [ ] New local-only presets module mirroring the existing `history.ts` pattern — presets stored device-side, no `user_handle`, includes a per-preset `usesCount` incremented on each run. A separate device-wide lifetime session counter is also tracked (see acceptance criteria).
- [ ] **Timer mode (the count-up stopwatch) works on native with the same behaviour as the web app.** It ships automatically — Capacitor reuses `src/` wholesale, so `src/lib/stopwatch/` comes along untouched — but it carries three specifics that need native attention rather than pure reuse: (1) its screen wake lock, which on native needs a keep-awake path rather than the Web Wake Lock API (see the wake-lock decision below); (2) its `localStorage` persistence (`takt.stopwatch.v1`), which must survive an app restart on native the same way it survives a browser restart on web, and must be wiped on reinstall alongside presets/history; and (3) its provider-scoped lifetime, which is why the back button treats it differently from an interval session (see below). By design it records nothing to `history.ts` and does not increment the lifetime session counter — that's parity with the web app, not a gap.
- [ ] Hide/disable all login, sign-in, cloud-sync, and account UI when running as the native Android build, **and make presets/history reachable unconditionally on native.** `PresetsDrawer` and its entry points currently render only `if (isAuthenticated)`, which is permanently false with no login system — as found in review, implementing "hide auth UI" literally would make the phase's main new feature invisible. On native, the presets UI must show regardless of auth state (there is no auth state); on web, behaviour is unchanged.
- [ ] `Privacy.tsx` content forked by platform — the current copy describes a passkey public key, D1-stored presets, and voice-call timestamps, none of which exist on native. Shipping it unchanged would contradict the Play Data Safety "no data collected" declaration.
- [ ] On-device voice pipeline: local speech recognition (Android's on-device recognizer, offline mode only) feeding a new, English-only, local deterministic intent parser. No audio or transcript ever leaves the device; no Workers AI call is made from the Android build. Low-confidence or failed parses fall back to the existing manual/Interpretation configuration screen — never a silent misconfiguration.
- [ ] App identity: application ID `org.hultberg.takt`, app name "Takt", icon and splash screen adapted from the existing PWA icon assets (see resolved item below).
- [ ] Play Console setup: paid listing at £0.99 (no Play Billing library needed — the store's own paid-app tier gates the download), store listing copy, screenshots, a privacy policy page (adapting the existing Privacy policy content — genuinely simple, since nothing is collected), and the Play Data Safety form declaring no data collected.
- [ ] Manual signed AAB build process, documented in `REFERENCE/`, including secure keystore backup (never committed to the repo).
- [ ] Closed testing track satisfying Google's 12-tester / 14-day requirement for new personal developer accounts, ahead of production release. Merchant/payments profile setup (required for a paid listing) and tester recruitment both have their own lead time — start both on day one, in parallel with build work, not after.
- [ ] Android hardware back-button handling (`@capacitor/app`'s `backButton` listener) wired to the router, with an explicit, **per-timer** decision for mid-session behaviour: **confirm before exiting a running _interval_ session** (you're mid-workout with the phone in front of you — losing it is bad), but **let the back button exit silently while only the stopwatch is running** — it keeps running via its persisted state and resumes to the correct elapsed on relaunch. The asymmetry is intentional and reflects the two use cases: the interval timer assumes you're actively exercising and watching it; the stopwatch explicitly expects you to start it and then go do something else on the phone.
- [ ] `RECORD_AUDIO` runtime permission request and a permanently-denied recovery path (deep link to the app's Android settings page) — the existing web permission-denied copy assumes a browser context and needs an Android-appropriate variant.

### Out of scope (this phase)

- iOS/Apple build. Deliberately deferred — Magnus isn't paying the yearly Apple Developer fee right now. Capacitor's cross-platform design means adding `@capacitor/ios` later is additive, not a redo, so this door stays open cheaply.
- Any account system, passkeys, or cloud sync for the Android build.
- Play Billing / in-app purchases — using the store's flat paid-app price instead.
- Automated CI deploy pipeline to Play Console — v1 ships via manual upload.
- Voice support for languages other than English (the web app's Nordic-cousins support is out of scope for this build; revisit if there's real demand).
- Any network call of any kind, for any feature, under any condition.

### Resolved decisions

- **App icon/splash:** adapt for Android's native adaptive icon format. Good news: `scripts/gen-icons.mjs` already generates the PWA icon from an SVG source (flat `#F5F4F0` background, "takt" wordmark, green accent bar) rather than a static image, and the existing maskable variant already centres the artwork in a safe zone. Extending the script to emit a separate transparent-background foreground layer and a solid background layer is a small addition, not new artwork.
- **Application ID:** `org.hultberg.takt`, mirroring the `takt.hultberg.org` domain. Locked in before first publish — see the Capacitor ADR for why this can never change afterwards.
- **Usage counts:** both — a per-preset `usesCount` and a separate device-wide lifetime session counter. Both increment at the same point `history.ts` already records a completed session (i.e. on completion, not on an abandoned/skipped-out session) — consistent with existing behaviour, not a new rule. The per-preset count is displayed next to the preset in the presets drawer; the lifetime count reuses the existing session-count chip location on Home (`Home.tsx`), which today is only shown for anonymous users and is a natural fit for a build that's always "anonymous." **Timer mode is excluded from both counters:** the stopwatch records nothing to `history.ts` by design, so a completed stopwatch run neither has a preset to increment nor bumps the lifetime session counter. This is deliberate parity with the web app, not a missing case.
- **Voice:** on-device, English-only, zero network — see the architecture decision below and its accompanying ADR.

### Acceptance criteria

- [ ] Magnus can install a signed release build on his own Android phone (via Play Store internal testing) and run a full session — including voice-driven setup — with the device in airplane mode.
- [ ] The Android manifest declares no `INTERNET` permission, and the native `index.html` sets `connect-src 'none'` — "zero network" is a structural property of the build, not just an observed one.
- [ ] No network request of any kind is observed from the Android app during a full manual test pass (proxy or Android's per-app data usage monitor), as a release-build sanity check on top of the structural guarantee above.
- [ ] Opening the app cold requires zero taps beyond normal onboarding — no login screen, no registration prompt, ever — and the presets drawer is reachable and usable immediately, with no auth gate of any kind.
- [ ] Voice-driven session creation correctly parses a representative corpus of common English phrasings (see testing strategy) with results Magnus judges usable, understanding upfront this won't match the web app's Llama-based accuracy.
- [ ] When on-device recognition is unavailable (unsupported device, no offline language pack) or the local parser can't produce a confident result, the app falls back to the existing manual/Interpretation screen — never a silent or wrong auto-configuration.
- [ ] Creating a preset, running it, and reopening the app after a full device restart shows the preset with an incremented usage count, and the device-wide lifetime session counter reflects the same run.
- [ ] Timer mode (the count-up stopwatch) behaves the same as on web: it starts, counts up, keeps running while the user navigates away and back, and resumes to the correct elapsed after the app is backgrounded / the screen is locked and then reopened.
- [ ] While a timer (interval or stopwatch) is running and Takt is in the foreground, the device screen stays on with no manual interaction.
- [ ] Pressing the Android back button during a running interval session prompts a confirm before exiting; pressing it while only the stopwatch is running exits silently, and the stopwatch is still running (correct elapsed) when the app is reopened.
- [ ] A completed stopwatch run adds no history entry and does not increment the lifetime session counter — by design, matching the web app.
- [ ] Uninstalling and reinstalling the app returns to zero presets/history/usage counts **and clears any persisted stopwatch state (`takt.stopwatch.v1`)** — documented and expected, not a bug. (This assumes Android Auto Backup is disabled for the app; see the manifest note under Known risks.)
- [ ] The app passes Play Console review and the closed-testing requirement, and is purchasable at £0.99.
- [ ] **The web app's behaviour is unaffected, meaning:** the existing Vitest suite passes unchanged, the Cloudflare Worker deploy pipeline is untouched, and no web user sees any different behaviour — accounts, cloud sync, and analytics all continue to work exactly as today. This does _not_ mean no shared file is touched: `index.html`, `main.tsx`, `session.tsx`, and `Privacy.tsx` all need native-side changes; the requirement is that every web-side code path through those files is provably identical to today, verified by the existing tests plus new tests covering the native branch.

---

## Technical approach

### Architecture decisions

**Capacitor wraps the existing Vite build — no second codebase**

- Choice: `npx cap add android` generates `android/`, checked into the repo alongside `src/`. `vite build` output is copied in via `npx cap sync android` and becomes the app's WebView content.
- Rationale: reuses all of `src/` — `TimerMachine`, i18n, styling, PWA groundwork — for a fraction of a rewrite's cost, directly serving the "learn the pipeline" goal without inventing a second app to maintain.
- Alternatives considered: full native rewrite (SwiftUI/Compose) — rejected, disproportionate to a £0.99 learning project. React Native — rejected, would mean re-porting all UI from scratch for no benefit given the web app already exists and works.
- **This decision outlasts this PR — recommend recording as an ADR** (flagged at the end of this doc, per CLAUDE.md guidance).

**Local-only identity: no accounts, no passkeys — presets, history, and usage counts live device-side**

- Choice: a new local presets module, following the same localStorage pattern `history.ts` already uses (or Capacitor's `Preferences` API, which is slightly more robust against WebView storage-clearing edge cases — to be confirmed during implementation). On native, this module is reachable unconditionally — it is not gated behind `isAuthenticated`, because native has no concept of authentication at all.
- Rationale: the web app's accounts exist for real reasons — cross-device sync and understanding how the live product is used — that simply don't apply to a phone-owner-only, single-device install. Also sidesteps the SameSite-cookie / origin-allowlist problem entirely for presets and history, since the Android build never calls `/api/presets` or `/api/sessions`.
- Alternatives considered: reusing the existing passkey system — rejected for v1. It reopens the cookie/CORS problem and adds real friction (a sign-in ceremony) that the whole point of this phase was to avoid. Giving the _web_ app anonymous local presets too (raised in review) — rejected: the web app's account system is deliberately kept exactly as-is, since accounts serve a real purpose there that a native single-owner device doesn't share. Can be revisited later as an optional "back up to the cloud" feature for Android specifically.

**Native gets a distinct build variant — zero network is enforced structurally, not just branched at runtime**

- Choice: the native build is produced from its own Vite mode/entry, not a byte-identical copy of the web bundle. It self-hosts fonts instead of loading them from Google Fonts, omits the Cloudflare Analytics beacon entirely, and ships with `android.permission.INTERNET` removed from the manifest plus `connect-src 'none'` in its CSP. Everything else — auth UI, presets backend, voice pipeline — branches at runtime via `Capacitor.isNativePlatform()` inside the shared component tree.
- Rationale: `/review-spec` found that a single shared build cannot honestly satisfy "zero network," because `index.html`'s font links and analytics script sit outside anything React-level runtime branching can guard, and `SessionProvider` fires a network call before any UI decision is made. Removing the `INTERNET` permission converts the requirement from something manually observed during QA into something the OS enforces — a future accidental `fetch` fails immediately rather than shipping silently.
- Trade-off accepted: the native and web builds are no longer byte-identical artifacts from the same `vite build` invocation — there are now two build targets sharing one `src/`. This is a small deviation from the Capacitor ADR's original framing ("vite build output becomes the WebView's content") and is recorded there as an amendment, not a new decision.
- Alternatives considered: runtime-only branching with a single shared build — rejected, per the finding above; it cannot actually deliver zero network given `index.html`'s static content and `SessionProvider`'s unconditional mount-time call.

**Voice parsing runs entirely on-device — no network call, English only**

- Choice: Android's on-device speech recognizer (offline mode only — reject if the platform would silently fall back to an online recognition path), feeding a new deterministic intent parser scoped to English closed-grammar phrasings ("three sets of one minute, thirty seconds rest").
- Rationale: this is the one place the "zero network, ever" requirement actually bites — the web app's voice pipeline (Whisper + Llama on Workers AI) is a network call by construction. On-device recognition plus a local parser is the only way to keep voice-driven setup while honouring that requirement.
- **Direct precedent conflict, addressed head-on:** [ADR 2026-04-20](../REFERENCE/decisions/2026-04-20-llama-primary-ndjson-streaming.md) documents a spike that built and rejected exactly this shape — a deterministic parser fed by speech-recognition transcripts — because Whisper's transcription variance broke it on ~50% of Swedish phrases. That finding is real and doesn't disappear just because the transcription engine changes from Whisper to Android's on-device recognizer; transcript noise defeating a closed-grammar parser is the underlying failure mode, not a Whisper-specific quirk.
- Why this phase proceeds anyway, differently: (1) scoped to **English only**, which removes the specific Swedish/Icelandic misdetection pattern that drove the original failure rate — English-only accuracy was never separately measured in the spike, so this isn't disproven, just untested; (2) the parser fails **loudly and safely** — any low-confidence or failed parse routes straight to the existing manual/Interpretation configuration screen, never a silent wrong guess; (3) the explicit acceptance bar is "usable," not "matches the web app's Llama accuracy" — a materially smaller, honestly-scoped claim than what the 2026-04-20 spike was measured against.
- Alternatives considered: keep calling Workers AI over network when online (rejected — violates the hard zero-network requirement); an on-device LLM instead of a rule-based parser (rejected — disproportionate app-size/engineering cost for a closed-grammar problem this narrow, per the reasoning already in REFERENCE); reusing the archived prototype parser (`SPECIFICATIONS/prototype-design-files/voice.js`) as-is (rejected — that's the specific design the 2026-04-20 ADR rejected; needs rebuilding with its lessons applied, not resurrecting unchanged).
- **This is a new ADR** (see `REFERENCE/decisions/`), separate from and referencing the Capacitor ADR and the 2026-04-20 ADR — it doesn't supersede either; it's a different trade-off for a different, more constrained product surface.
- **Scope note — Timer mode is out of the voice parser's scope entirely.** The count-up stopwatch is launched by touch and has nothing to parse — no sets, no durations, no rest. The on-device parser only ever produces interval-session configuration; a reader shouldn't expect (or build) any voice path into Timer mode.
- Validation plan: build a pinned phrase corpus (same methodology as the original Phase 3 spike) covering common English set/duration/rest phrasings, run it through the new parser before shipping, and test on real hardware with real speech — not just typed-out transcripts.

**The screen stays awake while a timer runs — via a native keep-awake path, not the Web Wake Lock API**

- Choice: on native, `src/lib/wakeLock.ts` is backed by a Capacitor keep-awake plugin (e.g. `@capacitor-community/keep-awake`) instead of the browser's `navigator.wakeLock`, selected behind the existing owner-keyed `wakeLock.ts` interface so both callers — the interval timer (`useTimerMachine`) and the stopwatch (`useStopwatchMachine`) — are unchanged. While any timer is in a keep-awake phase and Takt is in the foreground, the device screen stays on with no manual interaction.
- Rationale: `navigator.wakeLock` is not reliably present in an Android WebView, and `wakeLock.ts` already degrades to a silent no-op when it's absent — on native that would mean the screen sleeps mid-set. A keep-awake plugin is the native-appropriate equivalent. This matters more now that Timer mode has shipped: its wake lock is held above the router, so a running stopwatch must keep the screen on even while the user is on Home, not only on `/timer`.
- Behaviour when the screen locks or backgrounds anyway (user forces the power button, or the OS backgrounds the app): the **stopwatch resumes to the correct elapsed** on return, because its elapsed is derived from wall-clock timestamps (`startedAtMs`), not tick accumulation — so from the user's point of view it "kept running." The **interval timer is best-effort**: a backgrounded WebView suspends its ticking and audio (a documented platform limit — see root `CLAUDE.md`, "Audio operating mode"), so a forced lock mid-interval-session may desync or reset. Accepted for v1 under the "basic exercise timer, best effort" scope — we are **not** adding an Android foreground service to keep JS alive in the background. A rare reset when the user leaves the screen (or restarts the phone) is an acceptable edge case, not a defect.
- **Recommend recording as a short ADR** alongside the Capacitor one — it is a deliberate native/web divergence inside a shared module (`wakeLock.ts`), the kind of decision this repo's ADR process exists to capture.
- Alternatives considered: keep relying on `navigator.wakeLock` in the WebView (rejected — unreliable/absent, fails silently); an Android foreground service so timers keep ticking and beeping while backgrounded (rejected for v1 — disproportionate to a basic exercise timer, and the stopwatch's timestamp model already covers the "kept running" expectation without it).

### Technology choices

- **Capacitor** (`@capacitor/core`, `@capacitor/android`) — native wrapper.
- Possibly **`@capacitor/preferences`** in place of raw `localStorage` for the new local presets module — decide during implementation based on whether plain `localStorage` proves reliable enough in testing.
- A Capacitor speech-recognition plugin (e.g. `@capacitor-community/speech-recognition`) configured for offline/on-device recognition only, feeding the new local parser.
- A Capacitor keep-awake plugin (e.g. `@capacitor-community/keep-awake`) backing `wakeLock.ts` on native, so the screen stays on while a timer runs (the Web Wake Lock API is unreliable in an Android WebView).

### Key files and components

```
android/                        # generated by Capacitor — native Gradle project
capacitor.config.ts             # new, repo root
index.native.html               # new — native entry: self-hosted fonts, no analytics beacon, CSP
public/fonts/                   # new — bundled woff2 for Figtree + JetBrains Mono
src/
├── lib/
│   ├── platform.ts             # isNativePlatform() wrapper
│   ├── presets-local.ts        # new — device-scoped presets + usage counts
│   ├── presets-local.test.ts
│   ├── session-counter.ts      # new — device-wide lifetime session count
│   ├── session-counter.test.ts
│   ├── auth/session.tsx        # modified — SessionProvider skips GET /api/auth/me on native
│   ├── wakeLock.ts             # modified — native keep-awake backing (Web Wake Lock unreliable in WebView)
│   ├── stopwatch/              # unchanged — Timer mode; ships as-is, relies on wakeLock.ts + localStorage persistence
│   ├── timer/useTimerMachine.ts # unchanged behaviour; shares the native keep-awake backing via wakeLock.ts
│   └── voice-local/
│       ├── recognizer.ts       # on-device speech-recognition wrapper, offline-only
│       ├── parser.ts           # English-only deterministic intent parser
│       ├── parser.test.ts
│       └── fixtures/phrase-corpus.ts   # pinned validation phrases
├── main.tsx                    # modified — skip registerSW() on native
├── components/
│   └── PresetsDrawer.tsx       # modified — reachable unconditionally on native, unchanged on web
└── routes/
    └── Privacy.tsx             # modified — forked content by platform
```

### Database schema changes

None. This phase deliberately avoids touching D1 — presets, history, and usage counts for the Android build live entirely on-device.

---

## Testing strategy

### Unit tests

- New local presets module and session counter tested to the project's usual coverage targets (95%+ lines/functions, 90%+ branches).
- The new local parser (`voice-local/parser.ts`) tested against the pinned phrase corpus — every corpus entry asserts an exact expected `{ sets, workSec, restSec }` output or an explicit "low confidence, fall back" result.
- A permanent regression test asserting zero `fetch`/`XMLHttpRequest` calls occur when `isNativePlatform()` is mocked true — covers `SessionProvider`, presets, history-sync, settings, and the stopwatch persistence/machine modules in one pass so a future shared-code change can't silently reintroduce a network call. (The stopwatch is already network-free — in-memory state plus `localStorage` — so this is a guard against regression, not a suspected gap.)
- The existing Vitest suite must pass unchanged — this phase must not alter shared logic in a way that affects the web build.

### Manual testing checklist

- [ ] Install a signed build on a real Android device via the internal testing track.
- [ ] Verify offline behaviour: run a full session — including voice-driven setup — with the device in airplane mode.
- [ ] Verify preset persistence and both usage counters (per-preset and lifetime) across app restarts and device reboots.
- [ ] Verify Timer mode: start the stopwatch, confirm the screen stays on while it runs in the foreground, then background the app / lock the screen, reopen, and confirm it resumes to the correct elapsed. Confirm the back button exits silently while it's running and it's still counting on relaunch.
- [ ] Speak the phrase corpus aloud on real hardware (not just typed transcripts) and compare against expected parses.
- [ ] Verify the fallback path: force a low-confidence/failed parse and confirm it lands on the manual/Interpretation screen, never a silent wrong session.
- [ ] Verify behaviour when on-device recognition is unavailable (e.g. offline language pack not installed) — should fail towards manual entry, not attempt any network fallback.
- [ ] Capture network traffic during a full test pass (e.g. via a local proxy or Android's per-app data usage) and confirm zero requests are made.
- [ ] Confirm the built APK/AAB has no `INTERNET` permission in its merged manifest (`android/app/build/outputs/.../AndroidManifest.xml` after a release build, or via `aapt dump permissions`).
- [ ] Confirm the web app (`takt.hultberg.org`) is unaffected after this change ships — spot-check sign-in, presets, and voice on the live site, not just the test suite.

No automated testing is possible for the Play Console review process or store listing correctness — that part is manual, one-time verification.

---

## Pre-commit checklist

Before creating the PR, verify:

- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Coverage meets targets (`pnpm test:coverage`)
- [ ] Manual verification complete (see checklist above)
- [ ] `REFERENCE/` updated with the Android build/release process
- [ ] Root `CLAUDE.md` updated to mention the Android app once live
- [ ] No secrets (keystore, signing credentials) anywhere in the repo

---

## PR workflow

**Branch:** `feature/phase-7-android-app` (already created)

This phase now includes genuinely new client-side logic (the local parser and its fallback behaviour), not just build tooling and platform branching — use `/review-pr` and expect it to land at standard tier at minimum; consider `/review-pr-team` given the parser is the one place a bug could silently misconfigure a user's session.

---

## Edge cases and considerations

### Known risks

- **Google Play's closed-testing gate** (12 testers, 14 days) is calendar time that can't be sped up — plan the release timeline around it, not through it.
- **Losing the Android upload keystore** after the first release makes the app impossible to update without publishing under a new listing. Must be backed up securely, outside the repo.
- **Store review risk is lower than iOS** (Play Store has no equivalent to Apple's 4.2 "minimum functionality" bar), but a listing that reads as a bare wrapped website can still draw policy scrutiny — needs to look and feel like a proper app (icon, splash screen, no visible browser chrome).
- **On-device recognition availability varies by device.** Android's offline speech recognition depends on the user having downloaded an offline language pack via the Google app — not guaranteed present on every device. Mitigated by detecting unavailability and routing straight to manual entry; not treated as a bug, but worth surfacing to the user with a clear message rather than a silent failure.
- **Local parser accuracy is an open empirical question**, not a known quantity — the closest precedent (2026-04-20 ADR) measured a different language and a different transcription engine failing at ~50%. English-only scope and the phrase-corpus validation bound this risk but don't eliminate it; if real-hardware testing shows the parser is unusably unreliable even for English, the fallback is to cut voice from v1 entirely (session creation stays manual-only) rather than ship something that guesses wrong.
- **The on-device recognizer's "offline-only, fails closed" behaviour is unverified.** If the chosen plugin silently falls back to an online recognition path when no offline language pack is installed, audio could leave the device in a way local network monitoring on the _app_ wouldn't catch (recognition can run in a separate OS process/service). A short spike confirming this plugin behaviour is needed before committing further voice work.
- **Screen-wake depends on a native plugin, and background execution has a hard limit.** The Web Wake Lock API `wakeLock.ts` uses on web isn't reliably available in an Android WebView, so native uses a keep-awake plugin instead (see architecture decisions). Even with it, a user-forced screen lock or an OS-backgrounded app suspends the interval timer's ticking and audio — the stopwatch survives via its timestamp model, the interval timer is best-effort. Not treated as a defect for v1; a foreground service to keep JS alive in the background is explicitly out of scope. Confirm the chosen keep-awake plugin actually holds the screen on in the WebView during a spike, the same way the speech-recognition plugin needs one.
- **Android Auto Backup could preserve app data across a reinstall or device change without any app-initiated network call.** Needs an explicit manifest decision (`android:allowBackup`) so the "reinstall wipes data" acceptance criterion is actually true rather than assumed — this covers presets, history, usage counts, **and the stopwatch's `takt.stopwatch.v1` key**, all of which are WebView `localStorage` under the same backup umbrella.
- **Reinstall data-loss reads as a bug to PWA users who buy the app expecting their existing presets/history to carry over** — they don't, because WebView storage is a different origin from Chrome's. Worth a line in the store listing or first-run copy.
- **A £0.99 Play Store price cannot later become free** (Play permits paid→free transitions but the reverse is restricted) — treat the price as similarly locked-in as the application ID.

### Security considerations

- No new attack surface — the Android build talks to zero endpoints of any kind, authenticated or otherwise, and the `INTERNET` permission is removed from the manifest so this is enforced by the OS, not just by code discipline.
- Release keystore stored outside the repo; location and backup process documented in `REFERENCE/`, never committed.

### Future optimisation opportunities

- Optional cloud backup of presets via the existing passkey system, once/if the cookie-auth-for-native problem is worth solving.
- iOS build via `@capacitor/ios`, whenever the yearly Apple fee is worth paying.

---

## Technical debt introduced

Beyond the scope deliberately deferred above (iOS, cloud sync, Play Billing) — each tracked as "out of scope, revisit later" rather than debt — publishing to Google Play is itself an ongoing compliance commitment, not a one-off: Google's annual target-API-level requirement, periodic Data Safety re-attestation, and Gradle/AGP upgrades all arrive on their own schedule regardless of whether Takt is under active development. Worth budgeting a small amount of recurring maintenance time, not treating this as a one-time ship-and-forget release.

---

## Related documentation

- [Root CLAUDE.md](../CLAUDE.md) — project navigation
- [ADR: Capacitor wraps the existing SPA for the Android release](../REFERENCE/decisions/2026-07-26-capacitor-android-wrapper.md)
- [ADR: On-device English-only voice parsing for the Android release](../REFERENCE/decisions/2026-07-26-android-on-device-voice-parsing.md)
- [voice-api-contract.md](../REFERENCE/voice-api-contract.md) — the web app's pipeline, for contrast with this phase's on-device approach
- New: `REFERENCE/android-app.md`, to be written once implementation lands, documenting the build/release process and the local voice parser's supported grammar

---

## Notes

Learning goal, explicitly: understand the Play Console and Android release pipeline end to end. Feature completeness relative to the web app is a non-goal for v1.
