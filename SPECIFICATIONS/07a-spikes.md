# Phase 7a: Spikes — go/no-go before dependent work

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first for the north star, architecture decisions, and cross-cutting risks. This deliverable owns the three de-risking investigations that gate everything downstream.

**Depends on:** nothing (runs first).
**Gates:** 07e (keep-awake), 07f (speech recognition), 07g (background-pause signal).
**Shippable?** No — these are throwaway/minimal investigations, not production code. Their output is a documented finding, not a merged feature.

---

## Why this exists

Three unknowns in the Phase 7 approach are load-bearing: if any fails, the deliverable that depends on it changes shape. Discovering that _after_ building the dependent work is expensive. Each spike answers one question with the smallest possible experiment, records the finding (here and, where it outlasts the PR, in an ADR), and either greenlights or reshapes the dependent deliverable.

A spike is done when its question has a definite yes/no answer backed by a real device observation — not when code is pretty. Spike branches are not merged; the finding is the deliverable.

---

## Spike 1 — Keep-awake holds the screen inside the WebView

**The highest-value unknown. Spike this first, before anything in 07e.**

**Question:** Does a Capacitor keep-awake plugin (`@capacitor-community/keep-awake` or equivalent) actually prevent the screen from timing out _while the WebView is foregrounded_, on a real device?

**Why it's load-bearing:** the interval machine auto-**pauses** on `visibilitychange`-hidden and waits for an explicit resume. On native, a screen timeout _fires that event_. So without a working keep-awake, **every interval session pauses mid-set on the first screen timeout** — the interval timer is effectively broken on native. This ranks above every other unknown in the phase.

**Pass criteria:**

- `keepAwake()` called on a booted WebView screen keeps the display on past the device's configured screen-timeout (test with a short timeout, e.g. 15–30s).
- `allowSleep()` restores normal timeout behaviour.
- The effect works from _inside_ the WebView JS context (i.e. callable through the plugin bridge from `src/`), not only from native code.

**If it fails:** the interval timer cannot be faithfully represented on native without an alternative (a foreground service, or a different keep-awake mechanism). That's a material scope change — surface it before starting 07e, don't paper over it.

**Output:** a finding recorded here + the short `wakeLock.ts` native/web-divergence ADR the umbrella recommends (synthetic-sentinel backing + stale-lock policy live in 07e, but the "does keep-awake even work in a WebView" answer belongs to this spike).

### Finding (2026-08-08) — ✅ PASS

Validated on a real device (OnePlus `CPH2581`, Android) via a throwaway Capacitor 8.5 + `@capacitor-community/keep-awake` 8.0.1 shell (`org.hultberg.taktspike`, built and installed but **not** committed — findings only). The system screen timeout was set to 15 s (`adb shell settings put system screen_off_timeout 15000`, original restored after), and OS state was read from `dumpsys power` rather than eyeballed:

| Step                         | `mWakefulness` | `mHoldingDisplaySuspendBlocker` | reading                                                                                      |
| ---------------------------- | -------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| baseline (no `keepAwake`)    | Awake          | true                            | screen just on                                                                               |
| after `keepAwake()`          | Awake          | true                            | —                                                                                            |
| **+25 s idle, keepAwake on** | **Awake**      | **true**                        | **screen held well past the 15 s timeout — the load-bearing pass**                           |
| after `allowSleep()`         | Awake          | true                            | just tapped                                                                                  |
| +25 s idle, allowSleep       | **Dozing**     | **false**                       | timeout fired once released — proves the mechanism and that `allowSleep()` releases the hold |

The `keepAwake()`/`allowSleep()` calls were issued from the WebView JS context (confirmed in logcat: `Capacitor/Console … SPIKE allowSleep() called …`), so the JS→native bridge is what moved the OS state — satisfying the "works from inside the WebView JS context" criterion, not just native init.

**Conclusion:** keep-awake holds the screen inside a Capacitor WebView on real hardware. The interval timer's core native assumption is safe; no foreground-service fallback needed for v1.

**Limit handed to [07e](./07e-wake-lock-native.md):** this is a bare shell, not Takt's WebView with the interval machine driving `wakeLock.ts`. 07e must (a) confirm the hold survives when the real reducer dispatches acquire/release through the owner-keyed synthetic-sentinel backing, and (b) implement the deliberate stale-rehydrated-stopwatch re-acquire policy — keep-awake is **not** self-limiting the way `navigator.wakeLock` is on the web. Recorded in [ADR 2026-08-08](../REFERENCE/decisions/2026-08-08-native-wakelock-keepawake.md).

---

## Spike 2 — App-lifecycle signal for background-pause

**Question:** Does `@capacitor/app`'s `appStateChange` reliably fire on background / screen-lock, and can it drive the existing `visibilityHidden` / `visibilityVisible` machine events?

**Why it matters:** the interval timer's pause-on-background UX depends on _some_ reliable native lifecycle signal. The umbrella deliberately drives this off `@capacitor/app` `appStateChange` rather than DOM `visibilitychange`, because the WebView's `visibilitychange` behaviour under a native wrapper is exactly what's uncertain. This spike confirms which signal actually fires.

**Scope correction already baked in:** an earlier draft feared a "fast-forward through phases to a phantom `complete` session" if the visibility event was missed. That was a misread — `enterActive` resets `phaseStartMs` on _every_ transition, so a resumed rAF burst crosses exactly one phase boundary, no cascade. There is **no completion guard to build.** The real risk this spike bounds is milder: a _missed_ "you were paused" dialog. Confirm the signal; don't build a guard.

**Pass criteria:**

- `appStateChange` fires on home/app-switch and on screen-lock, with `isActive: false` → `true` transitions.
- Mapping it onto the existing `visibilityHidden`/`visibilityVisible` events reproduces the web pause dialog on native, with no new machine states and no reducer change.

**If it fails (no reliable signal):** fall back to whichever signal _does_ fire on the target devices (possibly DOM `visibilitychange` after all, if it turns out reliable under the wrapper). Worst realistic case is a missed pause dialog, not data corruption.

**Output:** finding recorded here; the wiring itself is built in 07g.

### Finding (2026-08-08) — ✅ PASS

Captured live on the OnePlus `CPH2581` from the native `Capacitor/AppPlugin` dispatch logs (ground truth) plus the JS listener via `Capacitor/Console`:

| Action            | `appStateChange`     | DOM `visibilitychange` |
| ----------------- | -------------------- | ---------------------- |
| open / reopen     | `isActive=true`      | `visible`              |
| HOME (background) | `isActive=false`     | `hidden`               |
| **screen lock**   | **`isActive=false`** | `hidden`               |
| unlock            | `isActive=true`      | `visible`              |

`@capacitor/app` `appStateChange` fires reliably on **both** app-background and screen-lock, and DOM `visibilitychange` fires alongside every time. Either can drive the existing `visibilityHidden`/`visibilityVisible` machine events; the umbrella's choice of `appStateChange` (the native ground truth) stands. No new machine states and no completion guard — the phantom-session fear was a reducer misread, already settled. Wiring is 07g's job.

**Harness note (not a Takt issue):** this device's ColorOS blocks `pm grant` and scripted (`monkey`/`am`) launches of the app, and a chatty log evicts events from a buffer dump — so the clean capture used real manual interaction with a _streaming_ logcat. Worth remembering for Spikes on this device.

---

## Spike 3 — Speech-recognition plugin behaviour

**Question:** Can Takt invoke the system speech recogniser through a Capacitor plugin (`@capacitor-community/speech-recognition` or equivalent) **with no `INTERNET` permission**, and how does it behave across devices?

**Why it matters:** the whole voice pipeline (07f) sits on top of this. Two things are uncertain: whether the recogniser is reachable at all without `INTERNET` (expected, since it runs in a separate `RecognitionService` Google process — but "expected" isn't "proven"), and whether the manifest `<queries>` block is genuinely required for `isRecognitionAvailable()` to return `true`.

**Pass criteria:**

- The plugin returns a transcript with `INTERNET` absent from Takt's manifest.
- `isRecognitionAvailable()` returns `true` **only** with `<queries><intent><action android:name="android.speech.RecognitionService"/></intent></queries>` present, and `false` without it (confirming the block is load-bearing on Android 11+).
- Observe on-device vs online transcription behaviour on the target device(s), and how the plugin reports unavailability (so 07f's manual fallback triggers correctly).

**If it fails (recogniser needs `INTERNET`, or is unreachable):** the "Takt's own process makes zero network calls" property collides with voice. Options then: cut voice from v1 (manual-only, fully faithful), or re-open the `INTERNET`-removal decision. Surface before starting 07f.

**Output:** finding recorded here; feeds the `INTERNET`-absent + `<queries>`-present merged-manifest checks that 07b and 07f both rely on.

### Finding (2026-08-08) — ✅ PASS

Built with `@capacitor-community/speech-recognition` 7.0.1, `RECORD_AUDIO`, the `RecognitionService` `<queries>` block, and `INTERNET` removed via `tools:node="remove"`. Verified on the OnePlus `CPH2581`:

**Structural** (merged manifest, `aapt2 dump` of the built APK):

- `INTERNET` **absent** from the merged manifest (count 0) — `tools:node="remove"` beat the library manifest-merge. This validates the exact durable-removal approach 07b needs.
- `RECORD_AUDIO` present; the `RecognitionService` `<queries>` block present in the merged manifest.

**Runtime** (live, spoken by Magnus):

- `SpeechRecognition.available()` → `{"available": true}` — **with no `INTERNET` permission**. The recogniser runs in the system `RecognitionService` process (log: `RecognitionService#onStartListening … callingApp: org.hultberg.taktspike`), so Takt invokes it without holding `INTERNET` itself. The separate-process premise is confirmed, not just assumed.
- `RECORD_AUDIO` runtime flow works: `checkPermissions()` → `prompt`, `requestPermissions()` → `granted`.
- Spoken _"three sets of one minute, thirty seconds rest"_ transcribed to **`"three sets of one minute 30 seconds rest"`** (plus a `"…1 minute…"` variant). Feeding either through the shipped `parseIntent` (07f) yields `{ sets: 3, workSec: 60, restSec: 30 }` — a **correct end-to-end result on the first real utterance.**

**Conclusion:** the voice pipeline is viable. The recogniser is reachable with `INTERNET` removed, `<queries>` enables it, and a real transcript parses correctly. **Voice stays in v1.**

**Not isolated (follow-ups for 07f validation, not blockers):**

- On-device vs online path wasn't isolated — the device may have used Google's online recogniser (the [2026-07-26 ADR addendum](../REFERENCE/decisions/2026-07-26-android-on-device-voice-parsing.md) already accepts this). Re-check in airplane mode during 07f to observe the offline behaviour and the manual fallback when a language pack is absent.
- The negative case (`<queries>` removed → `available()` returns `false`) wasn't separately rebuilt; it's documented Android 11+ behaviour and the positive case is confirmed. 07f's merged-manifest test enforces the block's presence.

---

## Acceptance criteria for this deliverable

- [x] Spike 1 has a definite pass/fail on real hardware, recorded here. **PASS (2026-08-08).**
- [x] Spike 2 has a definite pass/fail on real hardware, recorded here. **PASS (2026-08-08).**
- [x] Spike 3 has a definite pass/fail on real hardware, recorded here. **PASS (2026-08-08).**
- [x] Any spike that fails has its consequence for the dependent deliverable written down _before_ that deliverable starts. **N/A — all three passed.**
- [x] The `wakeLock.ts` native/web-divergence ADR is opened (even as a stub) if Spike 1 passes. **[ADR 2026-08-08](../REFERENCE/decisions/2026-08-08-native-wakelock-keepawake.md).**

## PR workflow

Spikes don't merge production code, but the **findings** should land as a docs PR updating this file (and any ADR). `/review-pr` will classify that as light. Branch: `spike/phase-7-<name>` per spike, or one `spike/phase-7-derisk` branch capturing all three findings — findings-only, no app code.
