# ADR: Timer mode's state machine lives above the router, not inside its route

**Date:** 2026-08-02
**Status:** Active

---

## Decision

The Timer feature's count-up state machine (`src/lib/stopwatch/`) is instantiated in a `StopwatchProvider` mounted in `src/App.tsx` alongside `SessionProvider` / `SettingsProvider` / `I18nProvider` — not inside `src/routes/Timer.tsx`. This means its state (running, paused, elapsed time) survives navigating away from `/timer` and back. It also survives a full page reload or browser restart, via a `localStorage` persistence layer added after production use — see "Addendum," below. Every other timer-like state machine in this codebase (`useTimerMachine`, backing the interval timer in `Run.tsx`) is instantiated inside its own route and dies when that route unmounts.

## Context

Rep-based exercises don't have a fixed work duration — you do reps until you're done, however long that takes. There's no chained rest-timer behaviour here (see the spec's Problem section) — this ADR is purely about the lifetime of the count-up state itself. Navigating away to Home or elsewhere mid-rep should leave the timer counting (or paused exactly where it was) rather than reset, and it should resume correctly on return. This is a confirmed product requirement, not a speculative one. The interval timer has never needed this: it assumes you stay on the Run screen for the session's duration, and nothing else in the product asks a timer to outlive its own screen.

## Alternatives considered

- **Keep it route-scoped, like the interval timer.** Instantiate the machine inside `Timer.tsx` with `useState`/a local reducer, same shape as `useTimerMachine` inside `Run.tsx`.
  - Why not: fails the actual requirement outright. The state is destroyed the moment `Timer.tsx` unmounts on navigation, so "keep running while I check something on Home" simply doesn't work.
- **Persist to `localStorage` / `sessionStorage` on every tick, rehydrate on mount.** Survives navigation and even a reload.
  - Why not, at the time: over-solves the problem and reintroduces exactly the kind of persistence this feature deliberately avoids everywhere else (no history entry, no saved state, nothing durable). It would also need explicit clearing logic to avoid a stale "still running" timer resurrecting itself after the user meant to be done with it. The product requirement as scoped was "survives navigation," not "survives closing the app."
  - **Revisited after production use — see "Addendum," below.** Reload silently resetting a running or paused stopwatch turned out to be a real, felt gap once someone actually used the feature, not merely a theoretical one. The provider-scoped decision below still stands; only this rejection is superseded.
  - **Chosen (at the time): Lift the machine into an app-level context provider**, same tier as the existing auth/settings/i18n providers, so it lives exactly as long as the page does — no more, no less.

## Reasoning

The requirement is specifically "outlives a route change, not a page reload." That's precisely what mounting a provider above `<Routes>` gives for free: React keeps the provider (and everything in its state) alive across any navigation handled by the router, and the browser discards it on an actual reload — same lifetime as `SessionProvider` already has today. No new persistence layer, no rehydration logic, no risk of a timer silently surviving longer than intended.

## Trade-offs accepted

**This is now the second state-lifetime pattern in the codebase, not one.** Anyone extending timer logic needs to know which tier a given piece of state should live at — route-scoped (interval timer, because it's tied to a single screen's session) versus provider-scoped (this timer, because it's explicitly meant to survive navigation). This ADR exists so that choice is a deliberate lookup, not a guess.

**Wake lock is now held above the route level too, and that has a real cost, not just a naming one.** Because the effect is dispatched by the reducer based on `running`/`paused` phase rather than by which screen is mounted, the screen stays awake while the count-up timer runs even if the user is looking at Home, not `/timer` — accepted as correct for this feature (mid-set, screen needs to stay on), and surfaced to the user via a running-elapsed-time label on the Home link so it doesn't read as an unexplained battery drain.

This turned out not to be free: `src/lib/wakeLock.ts` was a single-owner singleton, written when `useTimerMachine` was its only caller. A second, independently-lifetimed caller that can be active at the same time exposes a real bug — the interval timer's unmount effect releases the lock unconditionally, which could silently and permanently kill the stopwatch's lock if an interval session started and ended while the stopwatch was running in the background. The fix (owner-keyed acquire/release over a set of owners, released only when the set is empty) touches `useTimerMachine.ts`'s call sites — see "Prevents / complicates," below.

**Memory held for the whole app session, not just while `/timer` is open.** Negligible in practice (a phase enum, two numbers, one timestamp) but worth naming as a category: provider-scoped state costs a little more than route-scoped state for as long as the app is open, in exchange for surviving navigation.

## Implications

**Enables:**

- A "glance away and come back" experience for count-up timing that the route-scoped pattern structurally cannot provide.
- A precedent for any future feature that genuinely needs to survive navigation (e.g. a future background-friendly mode), without having to re-derive from scratch whether provider-level state is the right tool.

**Prevents / complicates:**

- Doesn't change how the interval timer _behaves_, but does require a small, real change to `useTimerMachine.ts`'s two wake-lock call sites (passing an owner key) as part of making `wakeLock.ts` support more than one concurrent caller — see the wake-lock trade-off above. `Run.tsx` itself is untouched.
- Two lifetime patterns now coexist (route-scoped and provider-scoped state), so precedent-searching (per this repo's ADR process) matters more than usual before adding a third state machine anywhere in the app.

---

## Addendum: localStorage persistence for reload/restart survival

**Decision:** `src/lib/stopwatch/persistence.ts` writes `{ phase, accumulatedMs, startedAtMs }` to `localStorage` (`takt.stopwatch.v1`) on every reducer transition (start/pause/resume/reset), and `StopwatchProvider` rehydrates from it on mount instead of always starting `idle`. This survives not just navigation but a full page reload and closing/reopening the browser entirely.

**Context:** the provider-scoped design above solved "survives navigation" as scoped. In production use, a full reload while the stopwatch was running or paused silently reset it to `0:00` — surprising and unwelcome in practice, not merely a theoretical gap.

**Why this doesn't conflict with the reducer's timestamp-derived design:** `accumulatedMs`/`startedAtMs` are the same values the reducer already holds and already treats as wall-clock timestamps (see `elapsedMs()` in `src/lib/stopwatch/types.ts`). Persisting and rehydrating them verbatim needs no new derivation logic and carries no drift risk — elapsed after a reload is computed exactly the same way elapsed after a background/foreground cycle already is.

**`localStorage` over `sessionStorage`:** chosen deliberately over the narrower option (survives reload, not closing the browser) — the product now wants the stopwatch to resume exactly where left even after fully restarting the browser, not just across a same-tab reload.

**No staleness cutoff.** A stopwatch left running or paused for hours or days resumes exactly as it was, with elapsed computed from real wall-clock time — consistent with how a background/foreground cycle already behaves, and simpler than adding an arbitrary cutoff with no product requirement behind it.

**On rehydrating a `running` state:** the wake lock isn't restored automatically — a reload is a fresh JS context, so no lock is held even though the rehydrated phase says `running`. `useStopwatchMachine` re-acquires it explicitly on mount when the rehydrated phase is `running`.

**This does put timer state in `localStorage`**, unlike everything else this feature deliberately keeps in-memory-only (no history entry, no preset, no accounts tie-in). It remains consistent with the project's "no personal data stored" rule — a phase, a duration, and a timestamp identify nothing about the user — but it is now genuinely persisted data, not merely provider-scoped React state, and a future reader should not assume otherwise.

---

## References

- Related ADRs: [2026-04-19-reducer-plus-effects-pattern.md](./2026-04-19-reducer-plus-effects-pattern.md) — the reducer/effects shape this new machine still follows, even though its lifetime tier differs.
- Phase spec: [SPECIFICATIONS/timer-mode.md](../../SPECIFICATIONS/timer-mode.md)
