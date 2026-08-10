# Phase 7: Android app

> **This is the umbrella spec** — the north star, the architecture decisions, the cross-cutting acceptance criteria, the risk register, and the publishing overview. The detailed, independently-reviewable scope for each piece of work lives in the child specs (`07a`–`07h`) indexed under [Delivery plan](#delivery-plan) below. Read this first; implement from the children.

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

### Delivery plan

The phase is delivered as eight independently-reviewable child specs. Each owns its own detailed scope, acceptance criteria, testing, and PR workflow; this umbrella owns the architecture and the cross-cutting criteria. The dependency order is real — respect the gating.

| #                                  | Deliverable                                                                                                                                                                                                                                        | Depends on                            | Shippable                   | Detail                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------- | --------------------------------- |
| [07a](./07a-spikes.md)             | **Spikes** — keep-awake, `appStateChange`, speech-recognition go/no-go                                                                                                                                                                             | —                                     | No (findings only)          | full now                          |
| [07b](./07b-capacitor-scaffold.md) | **Capacitor scaffold + native build variant** — `android/`, `transformIndexHtml`, fonts, `INTERNET` removal, CSP, SW stub, manifest checks                                                                                                         | —                                     | Installable, not yet usable | full now                          |
| [07c](./07c-auth-network-noop.md)  | **Auth/network no-op on native** — `SessionProvider`→`unauthenticated`, `isAuthenticated` audit, regression guard                                                                                                                                  | 07b                                   | Yes                         | full now                          |
| [07d](./07d-local-presets.md)      | **Local presets + native creation** — `presets-local`, alias routing, unhide presets, native "Save as preset"                                                                                                                                      | 07c                                   | Yes                         | full now                          |
| [07e](./07e-wake-lock-native.md)   | **Native wake-lock backing** — synthetic sentinel, keep-awake, stale-lock policy                                                                                                                                                                   | 07a·1, 07b                            | Yes                         | firms up after 07a·1              |
| [07f](./07f-voice-pipeline.md)     | **Native voice pipeline** — recognizer + English parser + corpus + capture UI + `RECORD_AUDIO` + `<queries>`                                                                                                                                       | 07a·3, 07b                            | Yes (or cut to manual)      | firms up after 07a·3              |
| [07g](./07g-back-button-copy.md)   | **Back button, lifecycle, copy forks** — `backButton`/`appStateChange` wiring, `Privacy`/`Onboarding`/`Settings`. **Split in delivery:** the copy forks landed with 07c (independent of 07e); the back-button + lifecycle half still gates on 07e. | 07a·2, 07e (back-button half only)    | Yes                         | copy forks done; wiring after 07e |
| [07h](./07h-publishing.md)         | **Signing + store listing + publishing** — AAB, keystore, Data Safety, closed testing, `REFERENCE/android-app.md`                                                                                                                                  | all code (admin track starts day one) | This is the ship            | admin now, release doc later      |

**Sequencing notes:**

- **Spikes (07a) run first.** Keep-awake is _the_ load-bearing unknown; if it fails, the native interval timer needs a different approach and 07e reshapes. 07f and 07g are similarly gated on their spikes.
- **07b→07c→07d is the spine** of a usable, login-free app with working local presets. 07e and 07f are the two hard-logic chunks and can run in parallel once their spikes clear.
- **07h runs on two clocks.** Its _admin track_ (developer account, merchant profile, tester recruitment, the 12-tester/14-day closed test) starts **day one, in parallel with all code work** — that calendar time, not the code, sets the earliest launch date. Its _code/release track_ (signed AAB, `REFERENCE/` doc) waits for the code deliverables.

The per-area detail that used to live inline here (exact files, the async-presets contract, the `transformIndexHtml`-vs-forked-HTML reasoning, the vacuous-test warning, and so on) now lives in the child spec that owns it — follow the links rather than duplicating, so the umbrella and children can't drift apart. What remains below is genuinely cross-cutting: out-of-scope boundaries, resolved decisions, the whole-phase acceptance criteria, the architecture decisions, and the risk register.

### Out of scope (this phase)

- iOS/Apple build. Deliberately deferred — Magnus isn't paying the yearly Apple Developer fee right now. Capacitor's cross-platform design means adding `@capacitor/ios` later is additive, not a redo, so this door stays open cheaply.
- Any account system, passkeys, or cloud sync for the Android build.
- Play Billing / in-app purchases — using the store's flat paid-app price instead.
- Automated CI deploy pipeline to Play Console — v1 ships via manual upload.
- Voice support for languages other than English. Note this is a _parser_ constraint, not a recogniser one: since we accept the system recogniser's online path, Google could transcribe other languages, but the local intent parser is English-only for v1. Multilingual voice is a future option, not a v1 goal. Because voice is English-only, the **whole native UI is English-only** — `I18nProvider` forces `'en'` on native and the Settings language toggle is hidden (a Swedish UI over an English-only mic is a dead-end); Swedish-speaking users use the (English) manual/Interpretation entry, which is fully faithful. The web app keeps full Swedish.
- An Android foreground service to keep timers ticking/beeping while backgrounded — the stopwatch's timestamp model already covers "kept running," and the interval timer stays best-effort (see keep-awake decision).

### Resolved decisions

- **App icon/splash:** adapt for Android's native adaptive icon format. `scripts/gen-icons.mjs` already generates the PWA icon from an SVG source (flat `#F5F4F0` background, "takt" wordmark, green accent bar) rather than a static image, and the existing maskable variant already centres the artwork in a safe zone. Extending the script to emit a separate transparent-background foreground layer and a solid background layer is a small addition, not new artwork.
- **Application ID:** `org.hultberg.takt`, mirroring the `takt.hultberg.org` domain. Locked in before first publish — see the Capacitor ADR for why this can never change afterwards.
- **WebView origin locked before first release.** All local data (`takt.history.v1`, `takt.stopwatch.v1`, the new presets key) is `localStorage` keyed to Capacitor's WebView origin (`server.androidScheme` + hostname in `capacitor.config.ts`). Changing that origin in any later release silently orphans every user's data with no migration path — the same failure mode as the PWA-vs-Chrome origin split, self-inflicted. Treat this value as locked-in on par with the application ID.
- **Local storage substrate: raw `localStorage` for everything** (history, stopwatch, and the new presets module) — _not_ `@capacitor/preferences`. Rationale: the shipped `history.ts` and `stopwatch/persistence.ts` already read `localStorage` **synchronously at hook init / during render**, so the sync substrate is what the existing code needs; Preferences is async and would force a refactor of those read sites for no user-visible benefit. One substrate also means one Auto-Backup umbrella (`android:allowBackup`), keeping the "reinstall wipes data" story simple. Durability note (hedge, not a guarantee): WebView `localStorage` is **strongly durable but evictable** under storage pressure on some OEM WebViews — this is exactly why Capacitor's own guidance nudges toward Preferences. We accept that because all three consumers degrade gracefully on a read miss (loss is non-fatal, not a crash), and because the sync-read requirement is real. Treat persistence as "strongly durable, tolerant of loss," and don't let the "reinstall wipes data" criterion imply the inverse (survival) is _guaranteed_.
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
- [ ] While a timer (interval or stopwatch) is running and Takt is in the foreground, the device screen stays on with no manual interaction. _(Verified by the keep-awake spike — see the Spikes section; a green tick here depends on that spike passing.)_
- [ ] Pressing the Android back button during a running interval session prompts a confirm before exiting; pressing it while only the stopwatch is running exits silently, and the stopwatch is still running (correct elapsed) when the app is reopened.
- [ ] Uninstalling and reinstalling the app returns to zero presets/history **and clears any persisted stopwatch state (`takt.stopwatch.v1`)** — documented and expected, not a bug. (This assumes Android Auto Backup is disabled for the app; see the manifest note under Known risks.)
- [ ] The app passes Play Console review and the closed-testing requirement, and is purchasable at £0.99.
- [ ] **The web app's behaviour is unaffected, meaning:** the existing Vitest suite passes unchanged, the Cloudflare Worker deploy pipeline is untouched, and no web user sees any different behaviour — accounts, cloud sync, and analytics all continue to work exactly as today. This does _not_ mean no shared file is touched: `index.html` (build-time transform), `main.tsx`, `session.tsx`, `Home.tsx`, `Complete.tsx`, `Settings.tsx`, `settings/context.tsx`, the voice-capture components, and `Privacy.tsx` all need native-side changes; `PresetsDrawer`/`SavePresetSheet` stay byte-identical (alias-routed). The requirement is that every web-side code path is provably identical to today, verified by the existing tests plus new tests covering the native branch.

---

## Technical approach

### Architecture decisions

**Capacitor wraps the existing Vite build — no second codebase**

- Choice: `npx cap add android` generates `android/`, checked into the repo alongside `src/`. The native `vite build` output is copied in via `npx cap sync android` and becomes the app's WebView content.
- Rationale: reuses all of `src/` — `TimerMachine`, the stopwatch, i18n, styling, PWA groundwork — for a fraction of a rewrite's cost, directly serving the "learn the pipeline" goal and the faithful-to-web north star without inventing a second app to maintain.
- Alternatives considered: full native rewrite (SwiftUI/Compose) — rejected, disproportionate. React Native — rejected, would mean re-porting all UI from scratch for no benefit given the web app already exists and works.
- **This decision outlasts this PR — recommend recording as an ADR** (the Capacitor ADR already exists; keep it current).

**Local-only identity: no accounts, no passkeys — presets and history live device-side**

- Choice: a new local presets module backed by `localStorage` but exposing `presets.ts`'s **async** function surface (see scope for why the drawer needs Promises, not sync reads), swapped in on native via a build-time alias. On native it is reachable unconditionally — not gated behind `isAuthenticated`, because native has no concept of authentication. Preset _creation_ reuses the web app's Complete-screen "Save as preset" flow with the sign-in gate removed (see scope).
- Rationale: the web app's accounts exist for real reasons — cross-device sync and product analytics — that don't apply to a phone-owner-only, single-device install where identity is implicit. Also sidesteps the SameSite-cookie / origin-allowlist problem entirely, since the Android build never calls `/api/presets` or `/api/sessions`.
- Alternatives considered: reusing the passkey system — rejected for v1 (reopens the cookie/CORS problem and adds a sign-in ceremony the phase exists to avoid). Giving the _web_ app anonymous local presets too — rejected; the web account system is kept exactly as-is. Both can be revisited later as an optional "back up to the cloud" feature for Android specifically.

**Native gets a distinct build variant — Takt's own no-network property is enforced structurally, not just branched at runtime**

- Choice: the native build is produced from its own Vite mode (a `transformIndexHtml` over the single `index.html`, not a forked entry file), not a byte-identical copy of the web bundle. It self-hosts fonts instead of loading them from Google Fonts, omits the Cloudflare Analytics beacon entirely, and ships with `android.permission.INTERNET` removed from the manifest plus a scoped CSP. Everything else — auth UI, presets backend, voice pipeline — branches at runtime via `Capacitor.isNativePlatform()` inside the shared component tree, or via a build-time module alias (`@/lib/presets` → `presets-local`) where keeping the component byte-identical matters.
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

- Choice: on native, `src/lib/wakeLock.ts` is backed by a Capacitor keep-awake plugin (e.g. `@capacitor-community/keep-awake`) instead of the browser's `navigator.wakeLock`, selected behind the existing owner-keyed `wakeLock.ts` interface so both callers — the interval timer (`useTimerMachine`) and the stopwatch (`useStopwatchMachine`) — are unchanged **at their call sites**. The module _internals_ are a real rewrite, though, not a one-line flip: `acquire`/`release`/`reacquireIfNeeded` are built around a `WakeLockSentinel` (`.released`, `.release()`, a `'release'` event listener), and the keep-awake plugin exposes only `keepAwake()`/`allowSleep()` with none of that. The native backing needs a **synthetic sentinel** with hand-maintained `released` bookkeeping to preserve the owner-keyed convergence logic, plus rewired `isSupported()` and corrected "platform auto-releases on hide" comment (that auto-release is a browser behaviour the native path does **not** have — see the stale-lock bullet).
- **Keep-awake is the highest-value correctness dependency — spike it first.** The interval machine auto-**pauses** on `visibilitychange`-hidden and waits for an explicit resume. On native a screen timeout _fires that event_, so without a working keep-awake **every interval session pauses mid-set on the first screen timeout**. If the plugin doesn't actually hold the screen inside the WebView, the interval timer is broken on native — this is the load-bearing unknown, ranked above the visibility question below.
- **Drive the background-pause off `@capacitor/app`'s `appStateChange`, not DOM `visibilitychange`.** Review corrected an earlier draft here: the interval reducer resets the phase clock (`enterActive` sets `phaseStartMs = now`) on **every** transition, so a resumed rAF burst crosses **exactly one** phase boundary and then resumes normal real-time counting — the "fast-forwards through phases straight to `complete`, recording a phantom session" scenario the earlier draft described **cannot happen**, and the completion guard it proposed is both mis-targeted (it would only fire in synthetic tests) and un-buildable (it would either break the legitimate skip-to-complete path or violate the "web paths byte-identical" criterion). The real, milder risk is that if the WebView doesn't fire `visibilitychange`, the timer silently eats the rest of the current phase and the "you were paused" dialog never appears — a broken pause UX, not a phantom record. Mitigation: map `@capacitor/app`'s `appStateChange` (already in the plugin inventory for the back button) onto the existing `visibilityHidden`/`visibilityVisible` machine events — a reliable native app-lifecycle signal, no new machine states, no reducer change, and the existing pause dialog keeps working. The remaining spike just _confirms_ which signal fires; there is no completion guard to build.
- **Trap to design around: a stale rehydrated stopwatch pins the screen on.** On mount, `useStopwatchMachine` re-acquires the wake lock if the rehydrated phase is `running`. On web that's self-limiting — `navigator.wakeLock` is only granted to a visible document and auto-released on hide. The keep-awake flag is **not** self-limiting: combined with the deliberate "no staleness cutoff," a stopwatch started days ago and never reset would re-grab keep-awake on **every** app open and hold the screen on while the user is in Settings, presets, anywhere — until they return and reset it. Bounded (the flag is inert while the Activity is backgrounded, so not a pocket-drain). Decide the native re-acquire policy **deliberately**: only hold the screen while the running stopwatch is actually on screen, or clear/expire a long-stale rehydrated `running` state, rather than inheriting web semantics that only worked because the browser enforced them. _(Framed as native-only when written; **#131 (2026-08-10) showed web had the same latent trap** — a cold load landing on Home has a visible document, so the launch re-acquire was granted there too. Resolved uniformly: 07e chose option (a) on native, #131 extended it to web, and the launch re-acquire is now removed on both. See the [wake-lock ADR](../REFERENCE/decisions/2026-08-08-native-wakelock-keepawake.md).)_
- Behaviour when the screen locks/backgrounds anyway: the **stopwatch resumes to the correct elapsed**, because its elapsed is derived from wall-clock `startedAtMs`, not tick accumulation — verified against `src/lib/stopwatch/types.ts`; it survives background, screen-lock, and full process-kill. The **interval timer is best-effort**: it pauses cleanly when the app backgrounds (and needs a manual resume), and is lost outright on process eviction because it is not persisted. Accepted for v1 — no foreground service. This matches the web app's own documented backgrounding limit, so it's faithful, not a regression — with one honest caveat: a Play-Store app invites more casual multitasking (a call or notification stealing focus) than a deliberately face-up web tab, so the same pause-and-manual-resume behaviour may _feel_ more intrusive on Android. A conscious acceptance, not an oversight.
- **Recommend a short ADR** for this native/web divergence inside `wakeLock.ts` (the synthetic-sentinel backing and the stale-lock re-acquire policy are exactly the kind of decision that outlasts the PR).

### Technology choices

- **Capacitor** (`@capacitor/core`, `@capacitor/android`) — native wrapper.
- **Raw `localStorage`** for all local data (history, stopwatch, presets) — synchronous, matching the shipped pattern; `@capacitor/preferences` rejected (async, incompatible with the sync render-time reads).
- A Capacitor **speech-recognition** plugin (e.g. `@capacitor-community/speech-recognition`) — prefers on-device recognition, accepts the online path where the device lacks it.
- A Capacitor **keep-awake** plugin (e.g. `@capacitor-community/keep-awake`) backing `wakeLock.ts` on native.
- A Capacitor **native-settings/app-launcher** plugin for the permanently-denied `RECORD_AUDIO` deep-link recovery path (`@capacitor/app` doesn't expose this).

### Key files and components

```
android/                        # generated by Capacitor — native Gradle project; RecognitionService <queries> present, INTERNET removed
capacitor.config.ts             # new, repo root — androidScheme/hostname LOCKED before first release
public/fonts/                   # new — bundled woff2 for Figtree + JetBrains Mono
vite.config.ts                  # modified — native build mode; build-time stub for virtual:pwa-register;
                                #   native alias @/lib/presets → presets-local; native index.html transform (see below)
index.html                      # modified — native build strips fonts <link> + analytics <script> and injects the
                                #   scoped CSP via a mode-aware transformIndexHtml plugin (preferred over a forked
                                #   index.native.html, which would silently drift from the web entry)
src/
├── lib/
│   ├── platform.ts             # isNativePlatform() wrapper
│   ├── presets-local.ts        # new — device-scoped presets; ASYNC surface mirroring presets.ts (no user_handle, no counts)
│   ├── presets-local.test.ts
│   ├── auth/session.tsx        # modified — native: no getMe() on mount/refresh()/login(); resolves straight to 'unauthenticated'
│   ├── settings/context.tsx    # modified — native: suppress the apiFetch sync (already localStorage-backed otherwise)
│   ├── wakeLock.ts             # modified — native keep-awake backing via synthetic sentinel; deliberate stale-lock re-acquire policy
│   ├── stopwatch/              # unchanged — Timer mode; relies on wakeLock.ts + localStorage persistence
│   ├── timer/useTimerMachine.ts # unchanged; background-pause driven by @capacitor/app appStateChange on native
│   └── voice-local/
│       ├── recognizer.ts       # system speech-recognition wrapper (prefers on-device, accepts online)
│       ├── parser.ts           # English-only deterministic intent parser
│       ├── parser.test.ts
│       └── fixtures/phrase-corpus.ts   # pinned validation phrases
├── main.tsx                    # modified — no registerSW() on native (build-time)
├── components/
│   ├── PresetsDrawer.tsx       # UNCHANGED — imports @/lib/presets, aliased to presets-local on native
│   ├── MicButton.tsx / VoiceOverlay.tsx  # modified — native capture via plugin; substitute mic-feedback affordance
│   └── SavePresetSheet.tsx     # UNCHANGED — imports @/lib/presets, aliased on native
└── routes/
    ├── Home.tsx                # modified — native: gate the /api/sessions fetch AND unhide the presets entry (List button + drawer)
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
- The load-bearing network guard: assert **on native, `SessionProvider` resolves to `unauthenticated` and `getMe` is never called** (spy on the fetch). A test that only mocks `isNativePlatform() === true` is vacuous — native already implies unauthenticated, so the `Home`/`Complete`/`Settings` fetches short-circuit regardless of whether a platform gate exists. The structural guarantees (INTERNET absent from the merged manifest + the scoped CSP) carry the rest; a component-level "no fetch on native" test is belt-and-braces only, and only meaningful if it forces the impossible-in-production native-and-authenticated state.
- `presets-local`: cover create/list/update/delete, `order_index` assignment, and — importantly — the **write-failure path** (a full/evicted store surfaces an error to the caller, never a false "saved"). No test should assume silent success.
- (No interval-completion guard — see the keep-awake decision: the "phantom session" it was meant to catch cannot occur, and the background-pause is handled by `@capacitor/app` `appStateChange`, tested by asserting it dispatches the existing `visibilityHidden`/`visibilityVisible` machine events.)
- The existing Vitest suite must pass unchanged — this phase must not alter shared logic in a way that affects the web build.

### Spikes (run before committing dependent work)

- [ ] **Keep-awake plugin holds the screen inside the WebView** — _the_ highest-value unknown: if it doesn't, every interval session pauses on the first screen timeout and the interval timer is effectively broken on native. Spike first.
- [ ] **App-lifecycle signal for background-pause** — confirm `@capacitor/app` `appStateChange` fires on background/screen-lock and can drive the existing `visibilityHidden`/`visibilityVisible` events. (Secondary to keep-awake; the worst case if mis-handled is a missed pause dialog, not a phantom session — see the keep-awake decision.)
- [ ] **Speech-recognition plugin** — confirm Takt can invoke it with no `INTERNET` permission (expected, since it's a separate `RecognitionService` process), that `isRecognitionAvailable()` returns true with the `<queries>` block present, its on-device vs online behaviour on target devices, and how it reports unavailability (so the manual fallback triggers correctly).

### Manual testing checklist

- [ ] Install a signed build on a real Android device via the internal testing track.
- [ ] Verify offline behaviour: run a full interval and stopwatch session with the device in airplane mode; confirm voice either works (on-device) or falls back cleanly to manual entry.
- [ ] Verify preset creation from Complete (no sign-in), and preset/history persistence across app restarts and device reboots.
- [ ] Verify Timer mode: start the stopwatch, confirm the screen stays on while it runs in the foreground, then background the app / lock the screen, reopen, and confirm it resumes to the correct elapsed. Confirm the back button exits silently while it's running and it's still counting on relaunch.
- [ ] Speak the phrase corpus aloud on real hardware (not just typed transcripts) and compare against expected parses.
- [ ] Verify the fallback path: force a low-confidence/failed parse and confirm it lands on the manual/Interpretation screen, never a silent wrong session.
- [ ] Verify behaviour when recognition is unavailable — should fall back to manual entry.
- [ ] Capture network traffic during a full test pass and confirm Takt's own process makes zero requests (the recogniser subprocess is expected and out of scope for this check).
- [ ] Confirm the built APK/AAB's **merged** manifest has no `INTERNET` permission **and** does contain the `RecognitionService` `<queries>` block (`aapt dump` / inspect the merged manifest, after a release build) — both must survive `cap sync`.
- [ ] Confirm a forgotten running stopwatch does not hold the screen awake on unrelated screens — start the stopwatch, background, reopen to a non-Timer screen, and check the screen sleeps normally (guards the stale-keep-awake trap).
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

**This phase ships as a sequence of PRs, one per child spec (`07a`–`07h`)** — not a single branch. Each child spec names its own branch (`feature/phase-7b-…`, `feature/phase-7c-…`, etc.) and its own review tier. The original single `feature/phase-7-android-app` branch was used only for this spec's own docs and has been merged/deleted; do **not** implement on it.

Respect the gating in the [Delivery plan](#delivery-plan) table: spikes (07a) first, then the `07b→07c→07d` spine, with `07e`/`07f` in parallel once their spikes clear, and `07h`'s admin track running on its own calendar clock from day one. `07g` splits in practice — its **copy forks** have no dependency on `07e` and landed alongside `07c` (native has no accounts, so removing account/passkey copy is part of the same native-correctness pass); only `07g`'s **back-button + lifecycle** wiring waits for `07e`.

The phase includes genuinely new client-side logic (the local parser and its fallback, the native preset-creation path), not just build tooling — most children land at `/review-pr` standard tier; the voice pipeline (07f) is the one place a bug could silently misconfigure a session, so it calls for `/review-pr-team`.

---

## Edge cases and considerations

### Known risks

- **Google Play's closed-testing gate** (12 testers, 14 days) is calendar time that can't be sped up — plan the release timeline around it, not through it.
- **Losing the Android upload keystore** after the first release makes the app impossible to update without publishing under a new listing. Must be backed up securely, outside the repo.
- **WebView origin is a one-way door.** All local data is keyed to the WebView origin; changing `androidScheme`/hostname in a later release orphans every user's data. Lock it before first publish (see resolved decisions).
- **Store review risk is lower than iOS** (no equivalent to Apple's 4.2 "minimum functionality" bar), but a listing that reads as a bare wrapped website can still draw scrutiny — needs to look and feel like a proper app (icon, splash, no visible browser chrome).
- **Keep-awake is the highest-value unknown.** If the plugin doesn't hold the screen inside the WebView, every interval session pauses on the first screen-timeout and the interval timer is effectively broken on native. Spike it first, before dependent work.
- **Background-pause signal.** The interval pause is driven off `@capacitor/app` `appStateChange` on native (not DOM `visibilitychange`). Worst case if that's mis-wired is a missed "you were paused" dialog — not a phantom session; an earlier draft's "fast-forward to a phantom completion" was a misread of the reducer (it resets the phase clock per transition, so no cascade is possible). Secondary spike.
- **Stale rehydrated stopwatch can pin the screen on.** Because keep-awake isn't self-limiting like the browser wake lock, a long-forgotten running stopwatch re-acquiring on app open would hold the screen on across unrelated screens until reset. Handled by a deliberate re-acquire policy (see keep-awake decision); called out here so it isn't reintroduced by accident. _(Originally flagged native-only; **#131 found web shared the trap on a cold load to Home** and resolved it the same way — launch re-acquire removed on both platforms, hold now scoped to the Timer screen.)_
- **Recognition availability varies by device.** On-device recognition depends on an installed language pack; not guaranteed present. Mitigated by detecting unavailability and routing to manual entry with a clear message, not a silent failure.
- **Voice silently unavailable without the manifest `<queries>` block.** On Android 11+, `isRecognitionAvailable()` returns false unless `RecognitionService` is declared in `<queries>` — presenting as "the parser never works" when the recogniser was never reached. Present-and-durable-across-`cap sync` is verified in the manifest checks.
- **Saved presets could silently vanish if the module inherits `history.ts`'s write contract.** That helper ignores write failures and caps at 30, dropping the oldest. Unacceptable for a paid user's curated presets with no cloud backstop — `presets-local` must surface write failures and must not silently evict (see scope).
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
