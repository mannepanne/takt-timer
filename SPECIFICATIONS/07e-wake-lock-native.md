# Phase 7e: Native wake-lock backing

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first, and the wake-lock architecture decision in it. **Living spec — detail firms up after [07a](./07a-spikes.md) Spike 1.** Do not start this until Spike 1 (keep-awake holds the screen in a WebView) has passed.

**Depends on:** 07a Spike 1 (go/no-go), 07b (native build).
**Gates:** 07g (back-button/lifecycle assumes the timers behave correctly under keep-awake).
**Shippable?** Yes — after this, both the interval timer and the stopwatch keep the screen on correctly on native.

---

## Goal

Back `src/lib/wakeLock.ts` with a native keep-awake path so both callers — the interval timer (`useTimerMachine`) and the stopwatch (`useStopwatchMachine`) — keep the screen on while running, **without changing their call sites.** This is a correctness dependency, not a comfort feature: without a working keep-awake, the interval machine pauses on the first screen timeout (see umbrella).

## Scope (firms up post-spike)

- [ ] Back `wakeLock.ts` with a Capacitor keep-awake plugin (e.g. `@capacitor-community/keep-awake`) on native, selected behind the existing **owner-keyed** interface so both callers are unchanged at their call sites.
- [ ] **The module internals are a real rewrite, not a one-line flip.** `acquire`/`release`/`reacquireIfNeeded` are built around a `WakeLockSentinel` (`.released`, `.release()`, a `'release'` event). The keep-awake plugin exposes only `keepAwake()`/`allowSleep()`. The native backing needs a **synthetic sentinel** with hand-maintained `released` bookkeeping to preserve the owner-keyed convergence logic, plus rewired `isSupported()`.
- [ ] **Correct the "platform auto-releases on hide" comment** — that auto-release is a _browser_ behaviour the native path does **not** have.
- [ ] **Design the stale-rehydrated-stopwatch trap out.** On mount, `useStopwatchMachine` re-acquires the lock if the rehydrated phase is `running`. On web that's self-limiting (`navigator.wakeLock` only granted to a visible document, auto-released on hide). The keep-awake flag is **not** self-limiting: combined with the deliberate "no staleness cutoff", a stopwatch started days ago and never reset would re-grab keep-awake on **every** app open and hold the screen on while the user is in Settings, presets, anywhere. Decide the native re-acquire policy **deliberately**:
  - only hold the screen while the running stopwatch is actually **on screen**, or
  - clear/expire a long-stale rehydrated `running` state,
  - rather than inheriting web semantics that only worked because the browser enforced them.

## Behaviour when the screen locks/backgrounds anyway (unchanged, faithful to web)

- **Stopwatch resumes to the correct elapsed** — elapsed is derived from wall-clock `startedAtMs`, not tick accumulation (verified against `src/lib/stopwatch/types.ts`); survives background, screen-lock, full process-kill.
- **Interval timer is best-effort** — pauses cleanly when backgrounded (needs manual resume), lost on process eviction (not persisted). Accepted for v1, no foreground service. Matches the web app's documented backgrounding limit — faithful, not a regression — with the honest caveat that a Play-Store app invites more casual multitasking than a face-up web tab, so pause-and-resume may _feel_ more intrusive.

## Acceptance criteria

- [ ] While a timer (interval or stopwatch) runs and Takt is foregrounded, the screen stays on with no manual interaction. _(Directly gated by 07a Spike 1.)_
- [ ] Both callers work unchanged at their call sites; the owner-keyed convergence (lock released only when the owner set empties) still holds with the synthetic sentinel.
- [ ] A forgotten running stopwatch does **not** hold the screen awake on unrelated screens (Settings, presets) — the stale-lock policy is enforced.
- [ ] Web behaviour unchanged: `wakeLock.ts` on web still uses `navigator.wakeLock`; `Run.tsx` and the stopwatch behave exactly as today; existing Vitest suite passes.
  - **Superseded by #131 (2026-08-10):** this "web unchanged" constraint was deliberately scoped to keep 07e native-only, but it left the same rehydrated-stopwatch trap latent on web (a cold load to Home with a stale `running` stopwatch pinned the screen). #131 extended option (a) to web — the `isNativePlatform()` gate is gone from `useStopwatchMachine.ts` and `Timer.tsx`, so the on-screen-only policy is now uniform. The web `navigator.wakeLock` _primitive_ is still what backs the seam on web; only the rehydrated re-acquire policy changed. See the wake-lock ADR's "#131 landed" amendment.

## Testing

- Unit-test the synthetic-sentinel bookkeeping (acquire/release/reacquire, owner-set convergence) with the native backing mocked.
- Manual (real device) — **set the device screen timeout to its minimum (15–30 s) first**, or a session shorter than the timeout proves nothing:
  - Interval session runs foregrounded past the timeout → screen stays on, no manual touch.
  - Stopwatch runs on the Timer screen past the timeout → screen stays on.
  - **Stale-lock (rehydrated):** start stopwatch → background → reopen to a **non-Timer** screen (Home/Settings), wait past the timeout → screen sleeps; it is **not** pinned on.
  - **Same-session (documented, expected to hold):** start stopwatch → navigate to Settings **without** backgrounding → the screen stays on (web-parity behaviour, see the ADR's "same-session off-screen hold" note). Confirm this matches the documented decision rather than reading as a bug.
  - **OEM/battery-saver:** repeat the interval-session check with battery-saver engaged on the target device — a rejected `keepAwake()` is swallowed by design, so observation is the only signal, and Android keep-awake is OEM-fragmented (the spike validated one OnePlus only).

## Cross-refs

- Umbrella wake-lock decision + the "recommend a short ADR" note (synthetic-sentinel backing + stale-lock policy is exactly a decision that outlasts the PR).
- [ADR 2026-08-02 — Timer mode provider-scoped state](../REFERENCE/decisions/2026-08-02-timer-mode-provider-scoped-state.md) already carries the "on the web this is self-limiting; on Android it is not" note pointing here.

## PR workflow

Branch `feature/phase-7e-wake-lock-native`. Real internals rewrite of a shared module — `/review-pr`, standard tier at minimum; consider team tier since a bug here silently breaks the interval timer on native. Open the wake-lock ADR alongside.
