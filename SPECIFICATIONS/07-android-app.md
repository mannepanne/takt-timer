# Phase 7: Android app

## Phase overview

**Phase number:** 7
**Phase name:** Android app — Capacitor wrapper, device-scoped presets, Play Store listing
**Estimated timeframe:** 8–12 days of work — larger than a pure packaging exercise because the voice pipeline (system-recogniser integration, a new English parser, and phrase-corpus validation) is genuinely new logic, not just platform branching. Google Play's closed-testing requirement adds a further 14 days of calendar time on top, which can't be compressed.
**Dependencies:** Phase 2 (core timer) complete, and Timer mode (the count-up stopwatch, #111/#112) complete — the Android build faithfully represents both, so both must be live in `src/` first (they are). Independent of Phase 4's account system — deliberately not reused here (see architecture decisions below).

**Brief description:**
Package the existing Takt SPA as a native Android app using Capacitor, and sell it on Google Play as a flat one-time £0.99 download. No login, no account, no cloud sync — presets and history live entirely on-device.

**North star — faithful to the web app.** From the user's point of view, the Android app should behave as close to the web app as the platform allows. Storage, identity, and the voice pipeline all work differently _under the hood_ (local storage instead of D1, no passkeys, the phone's own speech recogniser instead of Workers AI), but the _experience_ — configure a session by voice or by hand, run it, save it as a preset, run the stopwatch — should feel the same. Where this spec makes an under-the-hood choice, that faithfulness is the tie-breaker.

**Takt's own app makes zero network calls.** No accounts, no cloud sync, no analytics, no font downloads — the app process itself never talks to a server, and this is enforced structurally (see the build-variant decision). The **one** exception is voice input: it is delegated to Android's built-in speech recogniser (a separate Google process, exactly the one your keyboard's microphone uses), which _may_ send audio to Google to transcribe it. That's an accepted trade to stay lean rather than build our own recogniser — see the voice decision and its consequences for the store listing and the Play Data Safety form.

The primary goal of this phase is learning the real end-to-end app store publishing pipeline (Play Console, signing, review, closed testing), not maximising revenue.

**On feature parity:** the phase does _not_ aim for full parity — accounts and cloud sync are deliberately dropped. But the app's **core timing behaviour is faithfully represented**, and that explicitly includes **both** the interval timer **and Timer mode** (the count-up stopwatch for rep-based exercises). Timer mode was built into the web app first (#111, #112) precisely so it could ship in both surfaces; because Capacitor reuses `src/` wholesale, it comes along for free — but "for free" isn't "for nothing," and the specifics it carries (wake lock, `localStorage` persistence, provider-scoped lifetime) are called out throughout this spec.

**Why web and Android deliberately diverge:** the web app stays exactly as it is — accounts, cloud sync, and analytics all serve real purposes there (registered users across devices, understanding how the live product is used). None of that applies to a locally-installed Android app: the only possible user is the phone's owner, so there's nothing for an account system to distinguish, and the identity is implicit — it's whoever owns the phone. People also bring their phone into gyms and other locations without reliable signal, so timing must run fully offline. That gives a genuinely differentiated pitch: **your presets and history never leave your device, no account ever, works offline** — for £0.99. Voice input uses the phone's built-in speech recognition (so it may use Google's service when transcribing, like any Android mic button), but nothing Takt itself stores ever leaves the device. That honest version of the pitch belongs in the store listing copy, not just this spec.

---

## Scope and deliverables

### In scope

- [ ] Add Capacitor (`@capacitor/core`, `@capacitor/android`) to the repo; generate the native `android/` project via `npx cap add android`.
- [ ] **A distinct native build variant, not just runtime branching.** `/review-spec` found that a single shared `vite build` output cannot honestly satisfy "Takt makes no network calls" — `index.html` loads Google Fonts and the Cloudflare Web Analytics beacon unconditionally, outside anything `Capacitor.isNativePlatform()` can guard. The native build gets its own Vite mode/entry that: self-hosts Figtree + JetBrains Mono as bundled `woff2` instead of the Google Fonts `<link>`, and omits the Cloudflare Analytics `<script>` entirely. Runtime `isNativePlatform()` branching still handles everything inside the React tree (auth UI, presets backend, voice pipeline).
- [ ] **Auth/network layer is a no-op on native, not merely hidden.** `SessionProvider` (`src/lib/auth/session.tsx`) currently calls `GET /api/auth/me` unconditionally on mount, before any UI decision is made — this must not fire at all on native. Critically, on native `SessionProvider` must resolve to a **definite `unauthenticated` state, not sit at the initial `loading`** — the whole UI branches on `isAuthenticated`/`loading`, and a permanent `loading` would strand spinners and mis-render every auth-dependent view. Same no-network treatment for `settings/context.tsx` (already localStorage-backed for the anonymous path — only its `apiFetch` sync needs suppressing, not a rewrite), `history-sync.ts`, and `presets.ts`: on native, these are replaced by their local equivalents, not conditionally skipped downstream of a call that already happened.
- [ ] **Every `isAuthenticated` consumer is audited, not just the named modules.** Review found several _components_ (not lib modules) fire `apiFetch` gated on auth state rather than platform: `Home.tsx` (`GET /api/sessions?latest=1`), `Complete.tsx` (`pushSession`), plus the account block in `Settings.tsx`. These stay silent on native only because `isAuthenticated` is incidentally false — that's fragile. The audit makes platform, not auth state, the thing that gates network.
- [ ] Service worker registration (`registerSW` in `main.tsx`, Workbox config in `vite.config.ts`) disabled for the native build — a stale-JS risk inside a WebView whose content is supposed to update only via Play Store releases. This must be a **build-time stub/alias for `virtual:pwa-register`, not a runtime `isNativePlatform()` guard**: disabling VitePWA removes the virtual module, so a bare `import` would fail at _build_ time, which a runtime check runs too late to prevent.
- [ ] `android.permission.INTERNET` removed from the generated Android manifest, plus a **scoped** CSP in the native `index.html` (`connect-src 'none'`, `font-src 'self'`, `script-src 'self'`, etc. — **not** a blanket `default-src 'none'`, which would stop the local WebView app loading at all). Note the correct division of labour: the app's code calls _relative_ `/api/...` paths, which resolve against Capacitor's local WebView origin and would be answered by its interception server, not blocked by a missing `INTERNET` permission — so it is the **CSP** that makes a stray app-level `fetch` fail loudly, while removing `INTERNET` is what prevents genuine off-device sockets. Both are needed; they cover different things. (This constrains Takt's own process; the system speech recogniser runs in its own Google process and is unaffected — see the voice decision.)
- [ ] Assert the `INTERNET`-removal is **durable across `npx cap sync` and Android's manifest merger** — the merger can re-introduce the permission from a dependency library. Use the `tools:node="remove"` manifest directive (or equivalent) and back it with the merged-manifest check in the testing strategy, so a regenerated `android/` can't silently ship it.
- [ ] A unit test asserting no `fetch`/`XMLHttpRequest` occurs under native platform detection, as a permanent regression guard. It must cover the components found in the audit above (`Home`, `Complete`, `Settings`), not only lib modules — a component calling `apiFetch` directly would otherwise slip past. Manual proxy verification (see testing strategy) catches the release build; this catches the next code change.
- [ ] **New local-only presets module** mirroring the existing `history.ts` pattern — presets stored device-side in `localStorage`, no `user_handle`. **No per-preset usage count and no lifetime session counter** — those were an addition beyond web parity and are dropped so Android mirrors the web app exactly (the web app has no per-preset counter; its Home session-count chip is history-derived and comes along unchanged via `src/` reuse). The module implements the same _synchronous_ read/write shape `history.ts` uses (reads happen during render), so `PresetsDrawer` can consume it without an async refactor.
- [ ] **A working native path to _create_ a preset.** On web, "Save as preset" on the Complete screen is replaced by "Sign in to save" → the passkey ceremony when unauthenticated. On native there is no sign-in and no passkeys, so that gate is removed entirely: **"Save as preset" is always available on native and writes to the local presets module.** This is faithful to the web experience for a signed-in user, minus the sign-in step. Touches `Complete.tsx`, `SavePresetSheet`, and the passkey entry points (which are hidden on native).
- [ ] **Timer mode (the count-up stopwatch) works on native with the same behaviour as the web app.** It ships automatically — Capacitor reuses `src/` wholesale, so `src/lib/stopwatch/` comes along untouched — but it carries two specifics that need native attention: (1) its screen wake lock, which on native needs a keep-awake path rather than the Web Wake Lock API (see the wake-lock decision below); and (2) its `localStorage` persistence (`takt.stopwatch.v1`), which must survive an app restart on native the same way it survives a browser restart on web, and must be wiped on reinstall alongside presets/history. By design it records nothing to `history.ts` — that's parity with the web app, not a gap. As on web, there is **no staleness cutoff**: a stopwatch left running resumes exactly where it was, with the existing Home "Timer · m:ss" indicator surfacing it and reset clearing it.
- [ ] Hide/disable all login, sign-in, cloud-sync, and account UI on native, **and make presets/history reachable unconditionally.** `PresetsDrawer` and its entry points currently render only `if (isAuthenticated)`, which is permanently false with no login system — implementing "hide auth UI" literally would make the phase's main feature invisible. On native, the presets UI must show regardless of auth state (there is none). This also covers the **`Settings.tsx` account block** (signed-in state, sign out, delete account, passkey prompt) and any account/cloud references in **`Onboarding.tsx`** first-run copy. On web, all of this is unchanged.
- [ ] `Privacy.tsx` content forked by platform — the current copy describes a passkey public key, D1-stored presets, and voice-call timestamps, none of which exist on native. It must instead describe the native reality: local-only storage, no account, and that voice input is transcribed by the phone's speech recogniser (which may involve Google). Must be consistent with the Play Data Safety declaration (see below).
- [ ] **Voice pipeline on native.** Replace the web capture-and-parse path (`MicButton` → `useVoiceMachine` → `POST /api/voice/parse`, Whisper + Llama) with: Android's **system speech recogniser** via a Capacitor plugin (preferring on-device where the platform offers it, but accepting an online transcription path where it doesn't — we don't fight Google here), feeding a new **English-only deterministic intent parser** that runs locally. The parser converts recogniser text → `{ sets, workSec, restSec }`. Low-confidence or failed parses fall back to the existing manual/Interpretation configuration screen — **never a silent misconfiguration.** This touches the capture UI (`MicButton`, `VoiceOverlay`, `useVoiceMachine`) because the plugin does its own capture, a different mechanism from the web `MediaRecorder` path.
- [ ] App identity: application ID `org.hultberg.takt`, app name "Takt", icon and splash screen adapted from the existing PWA icon assets (see resolved item below).
- [ ] Play Console setup: paid listing at £0.99 (no Play Billing library needed — the store's own paid-app tier gates the download), store listing copy, screenshots, a privacy policy page, and the **Play Data Safety form** — declaring no account/personal data collected, and disclosing that voice audio may be processed by Google's speech-recognition service (pending a policy check on whether the system recogniser counts as app-collected data or a user-invoked OS service; declare conservatively if unclear).
- [ ] Manual signed AAB build process, documented in `REFERENCE/`, including secure keystore backup (never committed to the repo).
- [ ] Closed testing track satisfying Google's 12-tester / 14-day requirement for new personal developer accounts, ahead of production release. Merchant/payments profile setup (required for a paid listing) and tester recruitment both have their own lead time — start both on day one, in parallel with build work, not after.
- [ ] Android hardware back-button handling (`@capacitor/app`'s `backButton` listener) wired to the router, with an explicit, **per-timer** decision for mid-session behaviour: **confirm before exiting a running _interval_ session** (you're mid-workout with the phone in front of you — losing it is bad), but **let the back button exit silently while only the stopwatch is running** — it keeps running via its persisted state and resumes to the correct elapsed on relaunch. The asymmetry is intentional: the interval timer assumes you're actively exercising and watching it; the stopwatch expects you to start it and then go do something else. Note the honest limits: the confirm only guards the literal back gesture — HOME/app-switch already pauses an interval session silently (via `visibilitychange`, see keep-awake decision), and the interval session is **not persisted**, so an OS process-eviction while backgrounded loses it regardless. Define the concurrent case too (stopwatch running _and_ an interval session active): the interval-confirm rule wins while on `/run`.
- [ ] `RECORD_AUDIO` runtime permission request, with both a first-denial re-prompt and a permanently-denied recovery path (deep link to the app's Android settings page — needs a native-settings plugin, which `@capacitor/app` does not provide; add one to the inventory). The existing web permission-denied copy assumes a browser context and needs an Android-appropriate variant.

### Out of scope (this phase)

- iOS/Apple build. Deliberately deferred — Magnus isn't paying the yearly Apple Developer fee right now. Capacitor's cross-platform design means adding `@capacitor/ios` later is additive, not a redo, so this door stays open cheaply.
- Any account system, passkeys, or cloud sync for the Android build.
- Play Billing / in-app purchases — using the store's flat paid-app price instead.
- Automated CI deploy pipeline to Play Console — v1 ships via manual upload.
- Voice support for languages other than English. Note this is a _parser_ constraint, not a recogniser one: since we accept the system recogniser's online path, Google could transcribe other languages, but the local intent parser is English-only for v1. Multilingual voice is a future option, not a v1 goal; Swedish-speaking users use manual entry (fully faithful) or English voice.
- An Android foreground service to keep timers ticking/beeping while backgrounded — the stopwatch's timestamp model already covers "kept running," and the interval timer stays best-effort (see keep-awake decision).

### Resolved decisions

- **App icon/splash:** adapt for Android's native adaptive icon format. `scripts/gen-icons.mjs` already generates the PWA icon from an SVG source (flat `#F5F4F0` background, "takt" wordmark, green accent bar) rather than a static image, and the existing maskable variant already centres the artwork in a safe zone. Extending the script to emit a separate transparent-background foreground layer and a solid background layer is a small addition, not new artwork.
- **Application ID:** `org.hultberg.takt`, mirroring the `takt.hultberg.org` domain. Locked in before first publish — see the Capacitor ADR for why this can never change afterwards.
- **WebView origin locked before first release.** All local data (`takt.history.v1`, `takt.stopwatch.v1`, the new presets key) is `localStorage` keyed to Capacitor's WebView origin (`server.androidScheme` + hostname in `capacitor.config.ts`). Changing that origin in any later release silently orphans every user's data with no migration path — the same failure mode as the PWA-vs-Chrome origin split, self-inflicted. Treat this value as locked-in on par with the application ID.
- **Local storage substrate: raw `localStorage` for everything** (history, stopwatch, and the new presets module) — _not_ `@capacitor/preferences`. Rationale: the shipped `history.ts` and `stopwatch/persistence.ts` already use `localStorage` with **synchronous** reads consumed during render; Preferences is async and would force an async refactor of every read site for no user-visible benefit. One substrate also means one Auto-Backup umbrella (`android:allowBackup`), keeping the "reinstall wipes data" story simple. The stopwatch already relies on `localStorage` surviving a restart on web and that behaviour must hold on native regardless, so committing to it for presets too is the consistent choice.
- **No usage counters.** Per-preset `usesCount` and a device-wide lifetime session counter were an addition beyond web parity in the original spec; dropped to mirror the web app exactly. This also removes the need to thread preset identity through the shared timer machine (which the shipped code doesn't carry — `preset.id` is dropped before `/run`), so nothing in the shared web/native timer path changes for this.
- **Voice:** system speech recogniser (may use Google's online path) + a local English-only parser; Takt's own process still makes no network calls. See the architecture decision below and its ADR (which needs an addendum recording this shift away from the original "zero network, ever" framing).

### Acceptance criteria

- [ ] Magnus can install a signed release build on his own Android phone (via Play Store internal testing) and run a full **interval and stopwatch** session with the device in airplane mode. Voice-driven setup works offline **where the device has an on-device recogniser/language pack**; where it doesn't, voice cleanly falls back to manual entry rather than failing — timing itself is always fully offline.
- [ ] Takt's own app process makes **no network request** during a full manual test pass (proxy or Android's per-app data-usage monitor), excluding the system speech-recogniser subprocess. The Android manifest declares no `INTERNET` permission (verified in the _merged_ manifest), and the native `index.html` uses a scoped CSP — so this is a structural property of the build, not just an observed one.
- [ ] Opening the app cold requires zero taps beyond normal onboarding — no login screen, no registration prompt, ever — and the presets drawer is reachable and usable immediately, with no auth gate of any kind. `SessionProvider` resolves to `unauthenticated` on native without any network call.
- [ ] A native user can **create a preset** from the Complete screen (no sign-in step), run it, and see it persist after a full device restart.
- [ ] Voice-driven session creation correctly parses a representative corpus of common English phrasings (see testing strategy) with results Magnus judges usable, understanding upfront this won't match the web app's Llama-based accuracy.
- [ ] When recognition is unavailable, or the local parser can't produce a confident result, the app falls back to the existing manual/Interpretation screen — never a silent or wrong auto-configuration.
- [ ] Timer mode (the count-up stopwatch) behaves the same as on web: it starts, counts up, keeps running while the user navigates away and back, and resumes to the correct elapsed after the app is backgrounded / the screen is locked and then reopened. It records no history entry — matching the web app.
- [ ] While a timer (interval or stopwatch) is running and Takt is in the foreground, the device screen stays on with no manual interaction. _(Verified by the keep-awake spike — see conditions; a green tick here depends on that spike passing.)_
- [ ] Pressing the Android back button during a running interval session prompts a confirm before exiting; pressing it while only the stopwatch is running exits silently, and the stopwatch is still running (correct elapsed) when the app is reopened.
- [ ] Uninstalling and reinstalling the app returns to zero presets/history **and clears any persisted stopwatch state (`takt.stopwatch.v1`)** — documented and expected, not a bug. (This assumes Android Auto Backup is disabled for the app; see the manifest note under Known risks.)
- [ ] The app passes Play Console review and the closed-testing requirement, and is purchasable at £0.99.
- [ ] **The web app's behaviour is unaffected, meaning:** the existing Vitest suite passes unchanged, the Cloudflare Worker deploy pipeline is untouched, and no web user sees any different behaviour — accounts, cloud sync, and analytics all continue to work exactly as today. This does _not_ mean no shared file is touched: `index.html`, `main.tsx`, `session.tsx`, `Complete.tsx`, `Settings.tsx`, `PresetsDrawer.tsx`, the voice-capture components, and `Privacy.tsx` all need native-side changes; the requirement is that every web-side code path through those files is provably identical to today, verified by the existing tests plus new tests covering the native branch.

---

## Technical approach

### Architecture decisions

**Capacitor wraps the existing Vite build — no second codebase**

- Choice: `npx cap add android` generates `android/`, checked into the repo alongside `src/`. The native `vite build` output is copied in via `npx cap sync android` and becomes the app's WebView content.
- Rationale: reuses all of `src/` — `TimerMachine`, the stopwatch, i18n, styling, PWA groundwork — for a fraction of a rewrite's cost, directly serving the "learn the pipeline" goal and the faithful-to-web north star without inventing a second app to maintain.
- Alternatives considered: full native rewrite (SwiftUI/Compose) — rejected, disproportionate. React Native — rejected, would mean re-porting all UI from scratch for no benefit given the web app already exists and works.
- **This decision outlasts this PR — recommend recording as an ADR** (the Capacitor ADR already exists; keep it current).

**Local-only identity: no accounts, no passkeys — presets and history live device-side**

- Choice: a new local presets module following the same synchronous `localStorage` pattern `history.ts` already uses. On native it is reachable unconditionally — not gated behind `isAuthenticated`, because native has no concept of authentication. Preset _creation_ reuses the web app's Complete-screen "Save as preset" flow with the sign-in gate removed (see scope).
- Rationale: the web app's accounts exist for real reasons — cross-device sync and product analytics — that don't apply to a phone-owner-only, single-device install where identity is implicit. Also sidesteps the SameSite-cookie / origin-allowlist problem entirely, since the Android build never calls `/api/presets` or `/api/sessions`.
- Alternatives considered: reusing the passkey system — rejected for v1 (reopens the cookie/CORS problem and adds a sign-in ceremony the phase exists to avoid). Giving the _web_ app anonymous local presets too — rejected; the web account system is kept exactly as-is. Both can be revisited later as an optional "back up to the cloud" feature for Android specifically.

**Native gets a distinct build variant — Takt's own no-network property is enforced structurally, not just branched at runtime**

- Choice: the native build is produced from its own Vite mode/entry, not a byte-identical copy of the web bundle. It self-hosts fonts instead of loading them from Google Fonts, omits the Cloudflare Analytics beacon entirely, and ships with `android.permission.INTERNET` removed from the manifest plus a scoped CSP. Everything else — auth UI, presets backend, voice pipeline — branches at runtime via `Capacitor.isNativePlatform()` inside the shared component tree.
- Rationale: a single shared build cannot honestly satisfy "Takt makes no network calls," because `index.html`'s font links and analytics script sit outside anything React-level runtime branching can guard, and `SessionProvider` fires a network call before any UI decision is made. Removing `INTERNET` converts the off-device-socket guarantee from something manually observed in QA into something the OS enforces.
- Scope of the guarantee: this covers **Takt's own process**. The system speech recogniser runs in a separate Google process with its own permissions and is deliberately outside this boundary (see voice decision). The store copy and Data Safety form reflect that distinction honestly.
- Trade-off accepted: the native and web builds are no longer byte-identical artifacts from one `vite build` — two build targets share one `src/`. Recorded in the Capacitor ADR as an amendment.

**Voice: system speech recogniser + a local English parser — Takt itself still makes no network call**

- Choice: use Android's system speech recogniser through a Capacitor plugin (e.g. `@capacitor-community/speech-recognition`), preferring an on-device path where the platform provides one but **accepting an online transcription path where it doesn't**. Its text output feeds a new deterministic intent parser scoped to English closed-grammar phrasings ("three sets of one minute, thirty seconds rest"). The recogniser runs in Google's process, so Takt can still ship without the `INTERNET` permission and still invoke it (confirm this in the spike — it's the expected behaviour of `RecognitionService`, but worth proving).
- Why we accept the online path: building or bundling our own guaranteed-offline recogniser is disproportionate for a lean £0.99 learning project. Delegating to the OS recogniser — the same one every Android voice-keyboard uses — is the lean choice. The cost is honesty in the pitch and the Data Safety form (below), not a technical blocker.
- **Consequence, explicitly (owner-approved):** the store listing cannot claim "nothing ever leaves the device, ever." It claims instead that _your presets and history_ never leave the device, no account ever, and that voice input uses the phone's built-in speech recognition. The Data Safety form is completed accordingly. This is a deliberate trade of an absolute privacy _claim_ for working, lean voice.
- **Parser precedent conflict, addressed head-on:** [ADR 2026-04-20](../REFERENCE/decisions/2026-04-20-llama-primary-ndjson-streaming.md) documents a spike that built and rejected exactly this shape — a deterministic parser fed by speech-recognition transcripts — because transcription variance broke it on ~50% of Swedish phrases. That finding is about transcript noise defeating a closed-grammar parser, not a Whisper-specific quirk, so it doesn't vanish just because the engine changes. This phase proceeds differently: (1) scoped to **English only**, removing the specific Nordic misdetection pattern that drove the failure rate — English-only accuracy was never separately measured, so it's untested, not disproven; (2) the parser fails **loudly and safely** — any low-confidence/failed parse routes to the manual/Interpretation screen, never a silent wrong guess; (3) the acceptance bar is "usable," not "matches Llama accuracy."
- **Scope note — Timer mode is out of the voice parser's scope entirely.** The count-up stopwatch is launched by touch and has nothing to parse. The parser only ever produces interval-session configuration.
- **ADR:** the existing on-device-voice ADR (2026-07-26) was written around "zero network calls ever." It needs an **addendum** recording this shift: Takt's own process stays network-free, but voice transcription is delegated to the OS recogniser, which may go online, with the pitch/Data Safety consequences above.
- Validation plan: build a pinned English phrase corpus (same methodology as the Phase 3 spike), run it through the parser before shipping, and test on real hardware with real speech — not just typed transcripts.

**The screen stays awake while a timer runs — a native keep-awake path, and a correctness dependency, not a comfort feature**

- Choice: on native, `src/lib/wakeLock.ts` is backed by a Capacitor keep-awake plugin (e.g. `@capacitor-community/keep-awake`) instead of the browser's `navigator.wakeLock`, selected behind the existing owner-keyed `wakeLock.ts` interface so both callers — the interval timer (`useTimerMachine`) and the stopwatch (`useStopwatchMachine`) — are unchanged at their call sites. `wakeLock.ts`'s `isSupported()` (which tests `navigator.wakeLock`) and its "platform auto-releases on hide" comment must be rewired/updated for the native backing, or the module silently reports unsupported and both callers no-op.
- **Why it's a correctness dependency, not a nicety:** the interval machine auto-**pauses** on `visibilitychange`-hidden and waits for an explicit resume. On native, a screen timeout _fires that event_ — so without a working keep-awake, **every interval session pauses mid-set on the first screen timeout**. That reclassifies the keep-awake spike from "confirm the screen stays on" to "if this fails, the interval timer is broken on native." Elevate it.
- **The load-bearing untested platform bet — add a spike:** the interval machine's clean pause depends on the Android WebView actually firing `document` `visibilitychange` on background/screen-lock. If it does **not**, the machine stays `running`, the rAF loop resumes on return, and `stepActive` fast-forwards through phases within a few frames straight to `complete` — recording a **phantom session** (and, on web, it already writes history). Add a spike for WebView visibility semantics, and make any completion-side effect defensive against a zero-real-time completion.
- Behaviour when the screen locks/backgrounds anyway: the **stopwatch resumes to the correct elapsed**, because its elapsed is derived from wall-clock `startedAtMs`, not tick accumulation — verified against `src/lib/stopwatch/types.ts`; it survives background, screen-lock, and full process-kill. The **interval timer is best-effort**: it pauses cleanly when `visibilitychange` fires (and needs a manual resume), and is lost outright on process eviction because it is not persisted. Accepted for v1 — no foreground service. This matches the web app's own documented backgrounding limit, so it's faithful, not a regression.
- **Recommend a short ADR** for this native/web divergence inside `wakeLock.ts`.

### Technology choices

- **Capacitor** (`@capacitor/core`, `@capacitor/android`) — native wrapper.
- **Raw `localStorage`** for all local data (history, stopwatch, presets) — synchronous, matching the shipped pattern; `@capacitor/preferences` rejected (async, incompatible with the sync render-time reads).
- A Capacitor **speech-recognition** plugin (e.g. `@capacitor-community/speech-recognition`) — prefers on-device recognition, accepts the online path where the device lacks it.
- A Capacitor **keep-awake** plugin (e.g. `@capacitor-community/keep-awake`) backing `wakeLock.ts` on native.
- A Capacitor **native-settings/app-launcher** plugin for the permanently-denied `RECORD_AUDIO` deep-link recovery path (`@capacitor/app` doesn't expose this).

### Key files and components

```
android/                        # generated by Capacitor — native Gradle project
capacitor.config.ts             # new, repo root — androidScheme/hostname LOCKED before first release
index.native.html               # new — native entry: self-hosted fonts, no analytics beacon, scoped CSP
public/fonts/                   # new — bundled woff2 for Figtree + JetBrains Mono
vite.config.ts                  # modified — native build mode + build-time stub for virtual:pwa-register
src/
├── lib/
│   ├── platform.ts             # isNativePlatform() wrapper
│   ├── presets-local.ts        # new — device-scoped presets (sync localStorage, no usage counts)
│   ├── presets-local.test.ts
│   ├── auth/session.tsx        # modified — native: no getMe() call, resolves straight to 'unauthenticated'
│   ├── wakeLock.ts             # modified — native keep-awake backing; isSupported() + comments rewired
│   ├── stopwatch/              # unchanged — Timer mode; relies on wakeLock.ts + localStorage persistence
│   ├── timer/useTimerMachine.ts # unchanged; shares the native keep-awake backing via wakeLock.ts
│   └── voice-local/
│       ├── recognizer.ts       # system speech-recognition wrapper (prefers on-device, accepts online)
│       ├── parser.ts           # English-only deterministic intent parser
│       ├── parser.test.ts
│       └── fixtures/phrase-corpus.ts   # pinned validation phrases
├── main.tsx                    # modified — no registerSW() on native (build-time)
├── components/
│   ├── PresetsDrawer.tsx       # modified — reachable unconditionally on native, unchanged on web
│   ├── MicButton.tsx / VoiceOverlay.tsx  # modified — native capture via plugin, not MediaRecorder
│   └── SavePresetSheet.tsx     # modified — native create path, no sign-in gate
└── routes/
    ├── Complete.tsx            # modified — "Save as preset" always available on native
    ├── Settings.tsx            # modified — account block hidden on native
    ├── Onboarding.tsx          # checked/forked — no account/cloud references on native
    └── Privacy.tsx             # modified — forked content by platform
```

### Database schema changes

None. This phase deliberately avoids touching D1 — presets and history for the Android build live entirely on-device.

---

## Testing strategy

### Unit tests

- New local presets module tested to the project's usual coverage targets (95%+ lines/functions, 90%+ branches).
- The new local parser (`voice-local/parser.ts`) tested against the pinned phrase corpus — every corpus entry asserts an exact expected `{ sets, workSec, restSec }` output or an explicit "low confidence, fall back" result.
- A permanent regression test asserting zero `fetch`/`XMLHttpRequest` calls occur when `isNativePlatform()` is mocked true — covering the **components** found in the audit (`Home`, `Complete`, `Settings`) as well as `SessionProvider`, presets, history-sync, settings, and the stopwatch modules, so a future shared-code change can't silently reintroduce an app-level network call.
- A guard around the interval machine's completion so a zero-real-time fast-forward (the phantom-session case) cannot record a session — pairs with the WebView-visibility spike.
- The existing Vitest suite must pass unchanged — this phase must not alter shared logic in a way that affects the web build.

### Spikes (run before committing dependent work)

- [ ] **WebView `visibilitychange` semantics** — does the Android WebView fire it on background/screen-lock? Gates the phantom-session guard and the interval-timer behaviour.
- [ ] **Keep-awake plugin** actually holds the screen on inside the WebView — gates the "screen stays on" AC and the interval timer's usability.
- [ ] **Speech-recognition plugin** — confirm Takt can invoke it with no `INTERNET` permission, what its on-device vs online behaviour is on target devices, and how it reports unavailability (so the manual fallback triggers correctly).

### Manual testing checklist

- [ ] Install a signed build on a real Android device via the internal testing track.
- [ ] Verify offline behaviour: run a full interval and stopwatch session with the device in airplane mode; confirm voice either works (on-device) or falls back cleanly to manual entry.
- [ ] Verify preset creation from Complete (no sign-in), and preset/history persistence across app restarts and device reboots.
- [ ] Verify Timer mode: start the stopwatch, confirm the screen stays on while it runs in the foreground, then background the app / lock the screen, reopen, and confirm it resumes to the correct elapsed. Confirm the back button exits silently while it's running and it's still counting on relaunch.
- [ ] Speak the phrase corpus aloud on real hardware (not just typed transcripts) and compare against expected parses.
- [ ] Verify the fallback path: force a low-confidence/failed parse and confirm it lands on the manual/Interpretation screen, never a silent wrong session.
- [ ] Verify behaviour when recognition is unavailable — should fall back to manual entry.
- [ ] Capture network traffic during a full test pass and confirm Takt's own process makes zero requests (the recogniser subprocess is expected and out of scope for this check).
- [ ] Confirm the built APK/AAB has no `INTERNET` permission in its **merged** manifest (`aapt dump permissions`, after a release build).
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

This phase includes genuinely new client-side logic (the local parser and its fallback behaviour, the native preset-creation path), not just build tooling and platform branching — use `/review-pr` and expect it to land at standard tier at minimum; consider `/review-pr-team` given the parser is the one place a bug could silently misconfigure a user's session.

---

## Edge cases and considerations

### Known risks

- **Google Play's closed-testing gate** (12 testers, 14 days) is calendar time that can't be sped up — plan the release timeline around it, not through it.
- **Losing the Android upload keystore** after the first release makes the app impossible to update without publishing under a new listing. Must be backed up securely, outside the repo.
- **WebView origin is a one-way door.** All local data is keyed to the WebView origin; changing `androidScheme`/hostname in a later release orphans every user's data. Lock it before first publish (see resolved decisions).
- **Store review risk is lower than iOS** (no equivalent to Apple's 4.2 "minimum functionality" bar), but a listing that reads as a bare wrapped website can still draw scrutiny — needs to look and feel like a proper app (icon, splash, no visible browser chrome).
- **The WebView-visibility bet is the highest-value unknown.** If the WebView doesn't fire `visibilitychange` on background/lock, the interval timer can fast-forward to a phantom completion. Mitigated by the spike + the completion guard (see testing strategy); do not build dependent work before the spike.
- **Keep-awake is a correctness dependency.** If the plugin doesn't hold the screen in the WebView, every interval session pauses on screen-timeout. Spike it early.
- **Recognition availability varies by device.** On-device recognition depends on an installed language pack; not guaranteed present. Mitigated by detecting unavailability and routing to manual entry with a clear message, not a silent failure.
- **Local parser accuracy is an open empirical question.** The closest precedent (2026-04-20 ADR) measured a different language/engine failing at ~50%. English-only scope and phrase-corpus validation bound this but don't eliminate it; if real-hardware testing shows it's unusably unreliable even for English, the fallback is manual-only session creation for v1 rather than shipping something that guesses wrong.
- **Voice audio egress vs the Data Safety form.** Because we accept the recogniser's online path, voice audio may reach Google. The Data Safety declaration must reflect this (or confirm, via policy check, that a user-invoked system recogniser isn't app-collected data). Getting this wrong is an inaccurate legal attestation, not just a copy nit — resolve before the listing goes live.
- **Android Auto Backup could preserve app data across a reinstall** without any app-initiated network call. Needs an explicit `android:allowBackup` decision so the "reinstall wipes data" acceptance criterion is true rather than assumed — covers presets, history, **and the stopwatch's `takt.stopwatch.v1` key**, all `localStorage` under the same umbrella.
- **Reinstall data-loss reads as a bug to PWA users** who buy the app expecting existing presets/history to carry over — they don't, because WebView storage is a different origin from Chrome's. Worth a line in the store listing or first-run copy.
- **The £0.99 price is effectively locked.** Play permits paid→free transitions but restricts free→paid, so treat "£0.99 now" as a commitment you can drop to free later but not re-raise — plan accordingly, and don't launch free intending to charge later.

### Security considerations

- Takt's own build talks to zero endpoints of any kind; the `INTERNET` permission is removed from the manifest so this is OS-enforced, not just code discipline. The system speech recogniser is a separate, user-invoked OS service and the only path by which any audio can leave the device — disclosed, not hidden.
- Release keystore stored outside the repo; location and backup process documented in `REFERENCE/`, never committed.

### Future optimisation opportunities

- Optional cloud backup of presets via the existing passkey system, once/if the cookie-auth-for-native problem is worth solving.
- Multilingual voice, if the online recogniser path makes non-English transcription reliable enough to justify extending the parser.
- iOS build via `@capacitor/ios`, whenever the yearly Apple fee is worth paying.

---

## Technical debt introduced

Beyond the scope deliberately deferred above (iOS, cloud sync, Play Billing) — each tracked as "out of scope, revisit later" rather than debt — publishing to Google Play is itself an ongoing compliance commitment, not a one-off: Google's annual target-API-level requirement, periodic Data Safety re-attestation, and Gradle/AGP upgrades all arrive on their own schedule regardless of whether Takt is under active development. Worth budgeting a small amount of recurring maintenance time, not treating this as a one-time ship-and-forget release.

---

## Related documentation

- [Root CLAUDE.md](../CLAUDE.md) — project navigation
- [ADR: Capacitor wraps the existing SPA for the Android release](../REFERENCE/decisions/2026-07-26-capacitor-android-wrapper.md)
- [ADR: On-device English-only voice parsing for the Android release](../REFERENCE/decisions/2026-07-26-android-on-device-voice-parsing.md) — **needs an addendum** for the accepted online-recogniser path
- [voice-api-contract.md](../REFERENCE/voice-api-contract.md) — the web app's pipeline, for contrast with this phase's on-device approach
- New: `REFERENCE/android-app.md`, to be written once implementation lands, documenting the build/release process and the local voice parser's supported grammar

---

## Notes

Learning goal, explicitly: understand the Play Console and Android release pipeline end to end. Faithfulness to the web app's user experience is the design tie-breaker; full feature parity (accounts, cloud sync) is a non-goal for v1.
