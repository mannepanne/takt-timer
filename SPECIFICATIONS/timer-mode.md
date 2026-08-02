# Timer mode — count-up timer for rep-based exercises

## Problem

Takt's interval timer assumes every phase has a known duration set in advance. That fits "three sets of one minute, thirty seconds rest" perfectly, but a lot of rehab work is rep-based instead — "ten reps of this" — where the work itself takes however long it takes and isn't a fixed duration at all. There's currently no way to time that kind of work without misusing the interval timer. This spec covers only that: a simple manual stopwatch for the untimed part. It does not attempt to chain into a rest countdown or otherwise replace the interval timer for the rest portion of a rep-based session — that stays a separate, manual step, by design.

## Solution

A second, independent mode: **Timer** — a simple count-up stopwatch, reachable from Home and back. Large digits (readable from across a room — phone face-up on the floor), a circular ring showing progress towards a full hour (wrapping every 3600s), and three controls: Start, Pause/Resume, Reset.

It deliberately does not track, save, or sync anything — no history entry, no preset, no accounts tie-in, no voice. It's the simplest possible implementation of a basic timer, on purpose.

### Out of scope

- Any chaining into a rest countdown, set counting, or anything resembling the interval timer's session model — see Problem, above.
- Voice-driven start ("start a stopwatch") — manual controls only.
- Any persistence beyond `localStorage` for the stopwatch's own phase/elapsed state (see Behaviour and Architecture, below) — no D1, no history list entry, no accounts tie-in.
- Sound or haptic feedback — this screen is silent, unlike Run's beeps/haptics.
- Platform-specific packaging concerns (e.g. a future native wrapper). This feature makes no network calls and needs no special-casing for any platform it might run on — nothing here depends on how the app happens to be packaged.

## Behaviour

- **Start:** begins counting up from 0:00.
- **Pause:** freezes the displayed time.
- **Resume:** continues from exactly where it paused (not from 0).
- **Reset:** stops and zeroes, from any state (running, paused, or idle) — always available, always means "start over." Uses `Icon.Refresh`, not `Icon.Stop`, so it doesn't read as a record/stop button.
- **Ring:** one full revolution = 3600 seconds. Past 60:00 the ring wraps and starts a new revolution while the digit display keeps counting up normally (61:15, 62:00, …). At typical rehab set lengths (well under a minute) the ring will barely move on any single set — that's accepted as-is; it's meant to give a sense of accumulated time across a longer session, not per-set progress, and matches the reference design this was based on.
- **Navigating away and back:** the timer keeps running (or stays paused, exactly as left) while you're on another screen, and picks up correctly when you return to `/timer`. Confirmed as an intentional requirement, not an assumption: navigating away mid-count (or mid-pause) and having it still be correct on return is the point of lifting this above the route — see Architecture, below.
- **Home indicator:** the Home screen's "Timer" link shows the running elapsed time once the stopwatch is non-idle (e.g. "Timer · 4:32"), so there's a visible reason the screen is staying awake even while you're not on `/timer`. Reverts to plain "Timer" once reset back to idle.
- **Reload / app restart:** the stopwatch resumes exactly where it was left — running, paused, or idle — with elapsed computed from real wall-clock time, the same way it already handles the app being backgrounded and foregrounded. This is persisted to `localStorage` (see Architecture, below), added after production use showed a silent reset on reload was a real, felt gap rather than a theoretical one. No staleness cutoff: a stopwatch left running or paused for hours resumes correctly, consistent with how it already behaves across a background/foreground cycle.
- **Concurrency with the interval timer:** the two are fully independent. Starting or running an interval session on `/run` while the stopwatch is running (or vice versa) has no effect on the other — both may be active at once, and each holds/releases the shared wake lock correctly regardless of what the other is doing (see Architecture).

## Architecture

### A new state machine, following the existing pattern — with one deliberate omission

[ADR 2026-04-19](../REFERENCE/decisions/2026-04-19-reducer-plus-effects-pattern.md) locks in reducer-plus-effects as the shape for every timer-like state machine in the app (`src/lib/timer/machine.ts` is the existing example). This feature is simple enough that it doesn't strictly need it, but staying consistent is worth more here than the few lines it would save to hand-roll a one-off component — anyone touching timer logic in this codebase should find one pattern, not two.

New module, `src/lib/stopwatch/` (named distinctly from `src/lib/timer/`, which stays the interval machine — the UI label "Timer" and the internal module name don't need to match):

- `types.ts` — `MachineState = { phase: 'idle' | 'running' | 'paused'; accumulatedMs: number; startedAtMs: number | null }`, events `start | pause | resume | reset` (no `tick` — see below), effects `acquireWakeLock | releaseWakeLock`.
- `machine.ts` — pure reducer. Elapsed time is always derived from timestamps (`accumulatedMs + (now - startedAtMs)` while running), never from counting ticks — the same technique `src/lib/timer/types.ts` already uses (`phaseStartMs` / `pausedAccumulatedMs`). **Clamp at zero** (`Math.max(0, …)`): `Date.now()` can step backwards (NTP correction is the realistic case on a phone, more so than the DST edge this was originally scoped against), and an unclamped negative delta would render as garbage.
  - **Clock source: `Date.now()`, not `performance.now()`.** `useTimerMachine` uses `performance.now()`, which is fine for a machine scoped to one screen's lifetime, but isn't guaranteed to keep advancing across an app being backgrounded/suspended — exactly the case this feature needs to survive (phone locked, Android app-switched away). `Date.now()` always advances in wall-clock time. Trade-off accepted, now clamped rather than merely noted: an NTP or manual clock correction can still visibly jump the display, but never negative.
  - **No `tick` event.** Because elapsed is always derived from timestamps rather than accumulated, a `tick` event would be a no-op branch that exists only to satisfy a rAF loop — dead weight against the branch-coverage floor, and removed. Whatever re-renders the display (see "Render cadence lives in the route," below) does so by re-reading the current timestamp locally; it never dispatches anything to the machine.
  - **Full event × state matrix** (all four events are safe to fire in any phase; unhandled combinations are no-ops returning the identical state, not errors):
    | Event | idle | running | paused |
    | --- | --- | --- | --- |
    | `start` | → running, `startedAtMs = now`, `accumulatedMs = 0` | no-op | no-op |
    | `pause` | no-op | → paused, `accumulatedMs += now - startedAtMs` | no-op |
    | `resume` | no-op | no-op | → running, `startedAtMs = now` |
    | `reset` | no-op (already idle) | → idle, zeroed | → idle, zeroed |

    `start` while paused is deliberately a no-op rather than "reset then start" — the UI never offers a Start button while paused (it shows Resume instead, per the UI section below), so this cell is unreachable in practice; it's specified as a no-op rather than left undefined so an implementer doesn't have to guess if a test exercises it directly.

  - **Does not mirror `useTimerMachine`'s `visibilitychange`/bfcache handling as _state_ transitions.** That hook dispatches `visibilityHidden` (pausing the machine) and hard-stops on bfcache restore — both correct for a session you're expected to stay on-screen for, both wrong here, since this machine is explicitly meant to keep running while backgrounded. It has no visibility-driven _state_ logic at all. It does, however, need a visibility-driven **wake-lock** reacquire — see "Wake lock: shared and owner-keyed," below; that listener calls `reacquireIfNeeded()` only and dispatches nothing to the reducer.

- `persistence.ts` — `readPersistedState()` / `persistState(state)`, a `localStorage`-backed pair matching `src/lib/history.ts`'s defensive-parsing shape (missing key, malformed JSON, or a shape that doesn't type-check as `MachineState` all fall back to `null`, never a thrown error). Key: `takt.stopwatch.v1`. See "Persistence: survives a reload, not just navigation," below.
- `useStopwatchMachine.ts` — internal hook (not exported outside this module) wrapping the reducer: runs the effect runner (wake-lock acquire/release, owner-keyed — see below) and owns the visibility-reacquire listener. No rAF loop here; nothing at this tier needs to force a render on a timer, because reducer-driven phase transitions already trigger React's own re-render. Initialises state from `readPersistedState() ?? initial()`, and calls `persistState()` after every transition.
- `context.tsx` — `StopwatchProvider` mounts `useStopwatchMachine` once; exports two public hooks:
  - `useStopwatch()` — `{ phase, start, pause, resume, reset, getElapsedMs }`. `getElapsedMs()` is a plain function, not a reactive value — it computes the current elapsed on demand from the machine's internal timestamps. The provider itself never re-renders on a clock tick (see "Render cadence lives in the route," below).
  - `useElapsedMs(intervalMs: number)` — a small polling hook built on top of `getElapsedMs()`: holds a local `useState<number>`, re-reads and updates it every `intervalMs` while `phase === 'running'`, and returns the current value reactively. Both `Timer.tsx` (at ~200ms, since the ring needs smoother motion) and the Home indicator (at ~1000ms, since it only displays whole seconds) use this rather than each hand-rolling their own polling loop — one written-once implementation instead of two, so neither consumer can forget to poll and ship a label frozen at mount time.

### State lives above the route, not inside it

`useTimerMachine` (interval) is only ever called from `Run.tsx` — its state dies when you navigate away, which is fine because the product has always assumed you stay on that screen for the whole session. This feature needs the opposite behaviour, confirmed as an explicit requirement (see Behaviour, above), so the machine can't live inside `Timer.tsx`; it lives at the same level as `SessionProvider` / `SettingsProvider` / `I18nProvider` in `src/App.tsx`, so it survives route changes and only resets on a real reload.

`StopwatchProvider` is mounted in `App.tsx` alongside the existing providers.

**This is a new pattern for this codebase** — every existing state machine here is route-scoped; this is the first one lifted above the router specifically so it outlives navigation. Documented in [ADR 2026-08-02](../REFERENCE/decisions/2026-08-02-timer-mode-provider-scoped-state.md).

### Persistence: survives a reload, not just navigation

Provider-scoped state alone only survives navigation — an actual page reload creates a fresh React tree, so `StopwatchProvider` would otherwise always mount `idle`. `persistState()` writes `{ phase, accumulatedMs, startedAtMs }` to `localStorage` after every reducer transition; `useStopwatchMachine` reads it back on mount instead of always calling `initial()`.

This needs no new derivation logic and carries no drift risk: `accumulatedMs`/`startedAtMs` are the same wall-clock values the reducer already treats elapsed as being derived from (see `elapsedMs()` above), so reading them back after a reload computes elapsed exactly the same way it already does after the app being backgrounded and foregrounded.

**Wake lock on rehydrate.** A reload is a fresh JS context — no platform wake lock is held even if the rehydrated phase is `running`. `useStopwatchMachine` re-acquires it explicitly on mount when the rehydrated phase is `running`, rather than waiting for a phase transition that won't happen until the user next interacts with the controls.

Full reasoning and alternatives: [ADR 2026-08-02, Addendum](../REFERENCE/decisions/2026-08-02-timer-mode-provider-scoped-state.md#addendum-localstorage-persistence-for-reloadrestart-survival).

### Render cadence lives in the route, not the provider

A 60fps rAF loop inside the provider-level hook, matching `useTimerMachine`'s shape, would be wrong here: it would force a render tick ~60 times a second for as long as the stopwatch runs, even while the user is sitting on Home with `/timer` unmounted — for a ring that moves 0.1°/second and digits that only need to update once a second. Since elapsed is always derived from a timestamp rather than accumulated, the render pump has no correctness role, only a "please redraw" role, and only whichever screen is actually displaying the value needs to ask for that. `Timer.tsx` and the Home indicator each use the shared `useElapsedMs(intervalMs)` hook (see above) at their own cadence, while the provider's machine itself never ticks.

### Wake lock: shared and owner-keyed

`src/lib/wakeLock.ts` is currently a module-level singleton (`sentinel` / `wantsLock`), written when only one caller (`useTimerMachine`) ever held it. This feature is a second, independent caller that can be active at the same time as the first (see "Concurrency with the interval timer," above), and the singleton can't represent that:

- `useTimerMachine.ts`'s unmount effect calls `release()` unconditionally. Sequence: start Timer → navigate to Home → start and finish (or leave) an interval session on `/run` → Run unmounts → `release()` fires → the stopwatch's lock is gone, and nothing in the stopwatch machine ever re-acquires it, since it only dispatches `acquireWakeLock` on its own phase transitions, which haven't happened.
- (The reverse — pausing the stopwatch killing a live Run session — isn't reachable: you can only be on `/timer` while `Run` isn't mounted, since routes are exclusive.)

**Fix:** `wakeLock.ts`'s `acquire`/`release` become owner-keyed over a `Set<string>` of current owners, releasing the real platform sentinel only when the set is empty:

```ts
export async function acquire(owner: string): Promise<void> { ... }
export async function release(owner: string): Promise<void> { ... }
export async function reacquireIfNeeded(): Promise<void> { ... } // unchanged signature; reacquires if the owner set is non-empty
```

`useTimerMachine.ts`'s two call sites pass `'interval'`; the new stopwatch hook passes `'stopwatch'`. This is a real change to a shared module and to `useTimerMachine.ts`'s call sites — not "the interval timer is untouched" in the file sense, but its _behaviour_ is: an interval session run on its own, with the stopwatch never started, behaves identically to today. Bonus: this also fixes a pre-existing bug where a second `acquire()` today silently overwrites `sentinel` without releasing the first lock, leaking a real platform lock until page unload.

**`reacquireIfNeeded()` must be idempotent against concurrent callers.** Both the interval timer and the stopwatch can be mounted (well, the interval timer via `Run.tsx`, the stopwatch via its provider) and each has its own `visibilitychange` listener calling `reacquireIfNeeded()`. If both fire on the same visibility event with an empty `sentinel`, two concurrent calls to `nav.wakeLock.request()` can race. `reacquireIfNeeded()` needs an in-flight guard (e.g. a module-level "request pending" flag, checked before calling `request()` and cleared in a `finally`) so the second caller sees the first's in-progress request and no-ops rather than double-requesting.

The lock is held for as long as the stopwatch's `phase === 'running'`, including while the user has navigated back to Home mid-count — that's the intended behaviour (mid-set, screen should stay awake), which is exactly why the Home indicator (see Behaviour, above) exists: so there's a visible reason the screen isn't sleeping.

### A new visual component: circular progress ring

Run's progress indicator is a horizontal fill bar (`src/routes/Run.tsx`, `scaleX` transform) — there's no circular ring anywhere in Takt today. This introduces one: a self-contained, presentational SVG component (`progress: number` prop, 0–1, stroke-dasharray on a circle), styled through the existing CSS custom properties (accent colour) rather than hardcoded colours, living in `src/components/` next to the other shared components. Decorative only — `aria-hidden` (see Accessibility, below).

## UI

- **Home entry point:** a second ghost link in the existing `home-cta-row`, next to "Can't use voice?". Shows `t('home.timer')` = "Timer" while idle, or `t('home.timerRunning', { time })` = "Timer · {time}" once non-idle (both en/sv), routing to `/timer`. `{time}` interpolation follows the existing precedent in `strings.ts` (`home.sessions.many` already interpolates `{count}` the same way — no new interpolation shape needed). Uses the shared `useElapsedMs(1000)` hook (see Architecture) so the label actually advances while running, not just appears once. Add a small gap to `.home-cta-row` (`src/styles.css`) — it currently has none, and a second link would otherwise butt up against the first.
- **New route** `/timer` → `src/routes/Timer.tsx`. `TopBar` with a back chevron only (reusing the existing `nav.backToHome` label — no new key needed), navigating via `<Link to="/">`, matching `Configure.tsx`'s pattern rather than `Settings.tsx`'s `navigate(-1)` (this screen is only ever reached from Home, so there's no ambiguous back-stack to preserve). No title text — `TopBar` doesn't have a centred-title slot in this app (it shows the wordmark), so none is added here. Centred: the ring with big digits inside it, reusing `src/lib/format.ts`'s existing `fmtTime()` (unpadded `M:SS`, unbounded above 60 minutes — already exactly what's needed, no new formatter). Below: Start/Pause toggle (becomes Pause once running, Resume once paused, primary/filled button) + Reset (ghost button, per the existing Run.tsx precedent of a secondary control alongside the primary one).
- New i18n keys under a `timer.*` namespace (English + Swedish, per `src/i18n/strings.ts` convention): `timer.start`, `timer.pause`, `timer.resume`, `timer.reset`, plus `home.timer` and `home.timerRunning` for the Home CTA.

## Accessibility

- Elapsed digits are **not** `aria-live` — a region announcing every second is hostile to screen readers, and `Run.tsx` deliberately avoids this on its own digits for the same reason.
- Start/Pause/Resume/Reset all get `aria-label`s following the existing `Run.tsx` convention (e.g. `t('run.stop')`-style labels already do this for that screen).
- The progress ring is `aria-hidden` — decorative, not informational (the digits are the actual information).

## Analytics

No new code needed — verified, not assumed. Cloudflare Web Analytics [documents automatic SPA tracking](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/): it overrides `history.pushState`/listens to `popstate` and beacons each route change, provided the app uses real History API routing (not hash-based) and the script tag doesn't set `spa: false`. Takt's router is `BrowserRouter` (`src/main.tsx`) and the beacon tag in `index.html` has no such override, so `/timer` will be tracked automatically the same way `/run` and `/settings` already are — no bespoke per-route event needed. This doesn't depend on any platform-specific packaging: the feature makes no network calls at all, on any platform, so there's nothing beyond the standard web SPA case above to consider.

## Files affected

| File                                                | Change                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/stopwatch/types.ts`                        | New — state/event/effect types                                                                                                                                                                                                                    |
| `src/lib/stopwatch/machine.ts`                      | New — pure reducer (clamped, no `tick`)                                                                                                                                                                                                           |
| `src/lib/stopwatch/machine.test.ts`                 | New — full event×state matrix, wrap-at-3600s, clamp-at-zero on a simulated backwards clock step                                                                                                                                                   |
| `src/lib/stopwatch/persistence.ts`                  | New — `readPersistedState()`/`persistState()`, `localStorage`-backed, `takt.stopwatch.v1`                                                                                                                                                         |
| `src/lib/stopwatch/persistence.test.ts`             | New — round-trips each phase, missing key, malformed JSON, and a shape that fails validation all fall back to `null`                                                                                                                              |
| `src/lib/stopwatch/useStopwatchMachine.ts`          | New — internal hook (effect runner, visibility-reacquire listener, rehydrate on mount, persist on transition, wake-lock re-acquire when rehydrated `running`)                                                                                     |
| `src/lib/stopwatch/useStopwatchMachine.test.tsx`    | New — incl. simulated backgrounding gap via `vi.useFakeTimers()`/`vi.setSystemTime()`, and rehydrating each phase from `localStorage`                                                                                                             |
| `src/lib/stopwatch/context.tsx`                     | New — `StopwatchProvider` / `useStopwatch()` / `useElapsedMs(intervalMs)`                                                                                                                                                                         |
| `src/lib/wakeLock.ts`                               | Owner-keyed `acquire`/`release` (`Set<string>` of owners) instead of a single `wantsLock` boolean; `reacquireIfNeeded()` gains an in-flight guard; `__resetWakeLockForTest()` updated to clear the owner set too, not just `sentinel`/`wantsLock` |
| `src/lib/wakeLock.test.ts`                          | Update — cover multiple concurrent owners, one releasing while another still holds, and concurrent `reacquireIfNeeded()` calls not double-requesting                                                                                              |
| `src/lib/timer/useTimerMachine.ts`                  | Update two call sites to pass `'interval'` as the wake-lock owner                                                                                                                                                                                 |
| `src/components/ProgressRing.tsx`                   | New — circular SVG progress component                                                                                                                                                                                                             |
| `src/components/ProgressRing.test.tsx`              | New                                                                                                                                                                                                                                               |
| `src/routes/Timer.tsx`                              | New — the screen itself, incl. its own local render-cadence loop                                                                                                                                                                                  |
| `src/routes/Timer.test.tsx`                         | New                                                                                                                                                                                                                                               |
| `src/routes/Home.tsx`                               | Add "Timer" ghost link (with running-elapsed label) to `home-cta-row`                                                                                                                                                                             |
| `src/routes/Home.test.tsx`                          | Update — cover new link, both idle and running label states                                                                                                                                                                                       |
| `src/App.tsx`                                       | Mount `StopwatchProvider`, add `/timer` route                                                                                                                                                                                                     |
| `src/App.test.tsx` / `src/App.integration.test.tsx` | Update as needed — both mount `<App/>`, now with an additional provider and route                                                                                                                                                                 |
| `src/i18n/strings.ts`                               | Add `timer.*`, `home.timer`, `home.timerRunning` keys (en + sv)                                                                                                                                                                                   |
| `src/test-utils/setup.ts`                           | Add a global `beforeEach(() => __resetWakeLockForTest())` — `wakeLock.ts`'s module state otherwise leaks across tests within the same test file                                                                                                   |
| `src/styles.css`                                    | Styles for the ring, the new screen, and a gap on `.home-cta-row`                                                                                                                                                                                 |

## Acceptance criteria

- [ ] "Timer" link on Home navigates to `/timer`.
- [ ] `/timer` shows 0:00, an empty ring, and a Start button.
- [ ] Start begins counting up; digits update roughly once a second; ring fills proportionally, one revolution per hour.
- [ ] Pause freezes the display exactly where it was.
- [ ] Resume continues from the paused value, not from 0.
- [ ] Reset (from any state) returns to 0:00 idle.
- [ ] Navigating Home → Timer while running, then back to Timer, shows correct continued elapsed time.
- [ ] While the stopwatch is non-idle, the Home "Timer" link shows the current elapsed time **and it visibly advances** while sitting on Home (not just present once at mount) — reverts to plain "Timer" after Reset.
- [ ] Real device check: start the timer, lock the phone for ~2 minutes, unlock, return to `/timer` — elapsed matches wall-clock time.
- [ ] Real device check, same scenario: the screen is still held awake after unlocking (wake lock was correctly reacquired on visibility-visible).
- [ ] Starting and completing (or leaving) an interval session on `/run` while the stopwatch is running does not release the stopwatch's wake lock, and the stopwatch keeps running correctly throughout.
- [ ] Past 60:00 the ring wraps to a new revolution; digits keep counting normally past 60:00.
- [ ] A full page reload while running resumes counting from the correct elapsed time (not reset to 0:00), and the wake lock is held again after reload.
- [ ] A full page reload while paused resumes frozen at the correct paused elapsed time.
- [ ] A full page reload while idle stays idle at 0:00.
- [ ] Resetting, then reloading, stays idle at 0:00 (a stale running/paused state doesn't resurrect after an explicit reset).
- [ ] All new UI strings exist in English and Swedish.
- [ ] The existing interval timer's behaviour is unchanged (an interval session run on its own, without ever starting the stopwatch, is indistinguishable from today).
- [ ] New modules (`src/lib/stopwatch/`, `ProgressRing`, `Timer.tsx`) are covered by tests exercising more than the happy path — the full event×state matrix, the wrap boundary, and the clock-goes-backwards clamp are not optional given the project's coverage floors.
