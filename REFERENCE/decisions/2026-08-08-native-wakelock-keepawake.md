# ADR: Native wake lock is backed by a Capacitor keep-awake plugin

**Date:** 2026-08-08
**Status:** Active (stub — the full backing design is specced and decided in Phase 7e)

---

## Decision

On the Android build, `src/lib/wakeLock.ts` is backed by `@capacitor-community/keep-awake` instead of the browser's `navigator.wakeLock`. Phase 7a's Spike 1 validated on real hardware that this plugin actually holds the screen on inside a Capacitor WebView — the load-bearing unknown that gated the whole native interval-timer story.

## Context

The interval timer auto-**pauses** on `visibilitychange`-hidden and waits for an explicit resume. On native, a screen timeout _fires that event_, so without a working keep-awake every interval session would pause on the first screen timeout — the interval timer would be effectively broken on native. Whether a Capacitor keep-awake plugin genuinely holds the screen _inside a WebView_ (not just from native code) was therefore the phase's highest-value unknown, ranked above every other spike.

## Evidence (Spike 1, 2026-08-08)

Throwaway Capacitor 8.5 + `@capacitor-community/keep-awake` 8.0.1 shell on a OnePlus `CPH2581`. Screen timeout forced to 15 s; OS state read from `dumpsys power` (ground truth, not a visual guess):

- After `keepAwake()`, **25 s idle** with the timeout at 15 s → `mWakefulness=Awake`, display suspend blocker still held. The screen stayed on well past the timeout.
- After `allowSleep()`, 25 s idle → `mWakefulness=Dozing`, display blocker released. The timeout fired once the hold was released, proving both that the mechanism works and that `allowSleep()` releases it.
- The calls were issued from the WebView JS context (confirmed via `Capacitor/Console` logcat), so the JS→native bridge is what moved the OS state.

Full readings: [SPECIFICATIONS/07a-spikes.md](../../SPECIFICATIONS/07a-spikes.md) → Spike 1 finding.

## What this ADR does NOT yet decide (deferred to 07e)

This is a stub recording the _validated plugin choice_. The mechanics of wiring it behind the existing owned interface are [07e](../../SPECIFICATIONS/07e-wake-lock-native.md)'s job and are **not** settled here:

- **The synthetic-sentinel backing.** `wakeLock.ts` is built around a `WakeLockSentinel` (`.released`, `.release()`, a `'release'` event); the keep-awake plugin exposes only `keepAwake()`/`allowSleep()`. The native path needs a hand-maintained synthetic sentinel to preserve the owner-keyed acquire/release convergence logic.
- **The stale-rehydrated-stopwatch re-acquire policy.** Keep-awake is **not** self-limiting the way `navigator.wakeLock` is on the web (the browser only grants it to a visible document and auto-releases on hide). A stopwatch left `running` and rehydrated on a later app launch would otherwise re-grab keep-awake on any screen. 07e must choose a deliberate policy (hold only while the running stopwatch is on screen, or expire a long-stale `running` state). See the cross-note in [ADR 2026-08-02](./2026-08-02-timer-mode-provider-scoped-state.md).
- **Confirmation with the real machine.** Spike 1 used a bare shell; 07e must confirm the hold survives when the actual interval reducer dispatches acquire/release.

## Trade-offs accepted

A second wake-lock implementation now exists (web `navigator.wakeLock`, native keep-awake) behind one interface. The native internals are a genuine rewrite, not a config flip — accepted because it's the only way to keep both call sites (`useTimerMachine`, `useStopwatchMachine`) unchanged.

---

## References

- Spike: [SPECIFICATIONS/07a-spikes.md](../../SPECIFICATIONS/07a-spikes.md)
- Deliverable that implements this: [SPECIFICATIONS/07e-wake-lock-native.md](../../SPECIFICATIONS/07e-wake-lock-native.md)
- Related: [2026-08-02-timer-mode-provider-scoped-state.md](./2026-08-02-timer-mode-provider-scoped-state.md) — the "self-limiting on web, not on native" note that this ADR's stale-lock deferral picks up.
