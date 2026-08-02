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

---

## Acceptance criteria for this deliverable

- [ ] Spike 1 has a definite pass/fail on real hardware, recorded here.
- [ ] Spike 2 has a definite pass/fail on real hardware, recorded here.
- [ ] Spike 3 has a definite pass/fail on real hardware, recorded here.
- [ ] Any spike that fails has its consequence for the dependent deliverable written down _before_ that deliverable starts.
- [ ] The `wakeLock.ts` native/web-divergence ADR is opened (even as a stub) if Spike 1 passes.

## PR workflow

Spikes don't merge production code, but the **findings** should land as a docs PR updating this file (and any ADR). `/review-pr` will classify that as light. Branch: `spike/phase-7-<name>` per spike, or one `spike/phase-7-derisk` branch capturing all three findings — findings-only, no app code.
