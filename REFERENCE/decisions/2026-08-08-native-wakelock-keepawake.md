# ADR: Native wake lock is backed by a Capacitor keep-awake plugin

**Date:** 2026-08-08 (amended 2026-08-09 when 07e landed)
**Status:** Active

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

## What 07e settled (amendment, 2026-08-09)

**1. Where the divergence lives — a platform seam, not a runtime branch.** Rather than branch `wakeLock.ts` on `isNativePlatform()` (which would pull the plugin into the _web_ bundle and contort five functions), the platform primitive is a tiny seam — `src/lib/wakeLock-platform.ts` (web, `navigator.wakeLock`) aliased on native to `src/lib/wakeLock-platform-native.ts` (keep-awake). `wakeLock.ts` keeps **all** owner-set, `requestPending`, and convergence logic and calls `isPlatformSupported()` / `requestPlatformLock()` through the seam. Consequence: the plugin stays out of the web bundle, the convergence logic exists once and stays under the existing web-resolved vitest suite, and the web build is provably byte-identical (mirrors 07d's alias approach). A compile-time parity guard in the native module pins the seam's signature to the web module's.

**2. The synthetic sentinel is a ~15-line object, not a parallel implementation.** `requestPlatformLock()` on native calls `keepAwake()` and returns `{ released, release(), addEventListener() }`: `release()` calls `allowSleep()` once (idempotent) and flips `released`; `addEventListener` is a **no-op** because keep-awake never fires a spontaneous release — unlike `navigator.wakeLock`, which the browser auto-releases on tab-hide. The native primitive is genuinely _simpler_ than the web one (no sentinel to leak), so the "last owner released mid-request" race and the `requestPending` guard remain web concerns handled entirely in `wakeLock.ts`.

**3. Stale-rehydrated-stopwatch re-acquire policy: option (a), hold only while on screen.** On native the launch re-acquire in `useStopwatchMachine` (which fires for a rehydrated `running` phase) is **skipped**; instead `Timer.tsx` holds a **distinct owner** (`stopwatch-screen`) while the running stopwatch is actually shown, releasing it on leave. A distinct owner (not the reducer's `stopwatch`) is required — screen-presence is a second independent wanter, exactly what the owner set is for; sharing one key would make two controllers fight over it. **Only the rehydrated case diverges:** during an _active_ session the reducer's `stopwatch` owner is held regardless of screen, same as web. This is the only way to satisfy both "screen stays on while a timer runs, foregrounded" and "a forgotten running stopwatch doesn't pin the screen on Settings/presets."

**Web has the same latent behaviour — deliberately out of 07e's scope.** The spike's stated rationale ("on web that's self-limiting") is weaker than it reads: on a cold load that lands on Home with a stale `running` stopwatch, the document _is_ visible, so `navigator.wakeLock.request()` would be granted on web too. The _decision_ (a deliberate native re-acquire policy) stands; the _rationale_ does not for that case. 07e's acceptance criteria forbid changing the web path, so the equivalent web tidy-up (scope the rehydrated re-acquire to the Timer screen on web as well) is tracked separately, not folded in here.

**4. Real-machine confirmation.** Spike 1 used a bare shell. 07e's device verification (Magnus, real hardware) confirms the hold survives when the actual reducer dispatches acquire/release, and that a forgotten running stopwatch does not keep the screen awake on an unrelated screen.

## Trade-offs accepted

A second wake-lock backing now exists (web `navigator.wakeLock`, native keep-awake) behind one seam. The native backing is real code, not a config flip — accepted because it keeps both call sites (`useTimerMachine`, `useStopwatchMachine`) and `wakeLock.ts`'s convergence logic unchanged. The stale-lock policy adds one native-only branch to `Timer.tsx` and `useStopwatchMachine.ts` (both inert on web via `isNativePlatform()`), accepted as the minimum surface that makes "on screen ⇒ awake, off screen ⇒ may sleep" true for the rehydrated case.

---

## References

- Spike: [SPECIFICATIONS/07a-spikes.md](../../SPECIFICATIONS/07a-spikes.md)
- Deliverable that implements this: [SPECIFICATIONS/07e-wake-lock-native.md](../../SPECIFICATIONS/07e-wake-lock-native.md)
- Related: [2026-08-02-timer-mode-provider-scoped-state.md](./2026-08-02-timer-mode-provider-scoped-state.md) — the "self-limiting on web, not on native" note that this ADR's stale-lock deferral picks up.
