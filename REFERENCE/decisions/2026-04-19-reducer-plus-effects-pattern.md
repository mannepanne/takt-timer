# ADR: State machines as pure reducers returning effects-as-data

**Date:** 2026-04-19
**Status:** Active

---

## Decision

State machines in Takt are implemented as pure reducers of shape `(state, event) → { next: state, effects: Effect[] }`. Side effects are _data returned by the reducer_, not calls made from inside it. A small `runEffects(effects)` function in the calling layer (a React hook, a test harness, a Worker handler) interprets the effect list and performs the real work — playing a beep, writing to `localStorage`, acquiring a Wake Lock, navigating, and so on.

This ADR records the pattern so Phase 3 (voice), Phase 4 (auth + presets), and Phase 6 (admin) extend the existing timer machine — and build any new machines they need — on the same shape rather than inventing a different one.

## Context

Phase 2 shipped `src/lib/timer/machine.ts`, the reducer for the interval-timer state machine. During the `/review-spec` team review before Phase 2 began, and again in the Phase 2 `/review-pr-team` retrospective, reviewers explicitly called out that this pattern — reducer-plus-effects-list — is load-bearing for the rest of the project:

- **Phase 3** adds voice as a new event source. Whisper transcription + Llama parsing produces a parsed `Session` which must hand off to the same machine. That's a new event (or a pre-configured `start`), not a new machine.
- **Phase 4** adds passkey auth and preset CRUD. Preset-load is another event into the existing timer machine. The auth flow itself is a separate, smaller state machine (registering / signing-in / signed-out) that will benefit from the same shape.
- **Phase 6** adds the admin backend. Administrative actions (delete user, purge inactive accounts) are transactional rather than stateful, but any multi-step admin flows would use the pattern.

Without a recorded decision, each new area is likely to invent a different shape: a hook that owns the machine internally, a reducer that calls effects directly, a third-party state library pulled in for one flow. All three are defensible in isolation; mixing them turns the codebase into a scavenger hunt.

## Alternatives considered

- **Fat reducer that invokes effects directly.** The reducer plays beeps, acquires Wake Locks, writes to `localStorage`. Simpler to read at a glance.
  - **Why not:** destroys reducer purity. Can't unit-test without mocking every side-effect module. Can't inspect what _would_ happen without executing it. Can't easily swap the effect runner in tests (we have ~60 machine tests that call `step(state, event)` and assert on the returned effect list; under this alternative each test would need to set up a browser-adjacent environment).

- **`useReducer` + React effects inside the hook, no effect-list indirection.** The hook owns the reducer and runs effects inline as React effects or in callbacks.
  - **Why not:** couples the machine to React. Makes Worker-side use (e.g. a potential Phase 6 admin state machine that might live partly in a Worker) awkward. Also makes effect ordering implicit — React's effect system doesn't guarantee the order you'd want for audio → haptic → wake lock.

- **XState or similar FSM library.** Batteries-included state machines with visualisers, hierarchical states, built-in effect handling.
  - **Why not:** dependency weight (tens of KB minified for XState v5) with no corresponding benefit for the size of state machines in Takt. The timer machine is ~250 lines; auth will be smaller. XState's strengths (hierarchical states, parallel regions, deep history) don't apply to these flat machines. Introducing it for one machine would pull the rest along for consistency.

- **Redux-style middleware.** `next → action → dispatch(effect)` pipeline with thunks / sagas.
  - **Why not:** we're not using Redux. Adopting it just for the side-effect pipeline drags in store plumbing that adds zero value.

- **Chosen: Pure reducer returning `{ next, effects }`, effect runner in the caller.** Small code, fully testable without a browser, framework-agnostic core, effect ordering explicit, easy to extend.

## Reasoning

- **Testability by construction.** `step(state, event)` is a pure function. Every one of the 34 machine unit tests asserts on both the next state _and_ the exact effect list returned. No mocks, no timers, no jsdom required for the reducer layer itself. Coverage on `machine.ts` is 98% lines with minimal ceremony.

- **Effect ordering is explicit and inspectable.** The reducer returns effects in the order the caller should apply them. `acquireWakeLock` before `beep('count')`, `releaseWakeLock` + `appendHistory` on completion. The hook's `runEffects` walks the list in order. If we want to change the order, it's one line of the reducer. No hidden scheduler.

- **Framework-agnostic core.** `machine.ts` imports nothing from React, nothing from the DOM. The same module works in a test runner, a Worker, a CLI harness. Phase 6's retention-purge cron could reuse the `computeTotalSec` helper and the pure reducer for any admin-flow state machines without pulling React in.

- **Extensibility for Phase 3/4/6 is trivial.** Adding a voice-source event is two lines in the `MachineEvent` union and one transition-table row. Adding a preset-load event is the same. New effect types are one line in the `Effect` union and a new case in `runEffects`. The shape does not need to change.

- **Effect replay / time-travel is available if we want it later.** Because effects are data, we can record them per-tick, replay a session for debugging, or diff expected-vs-actual effect lists in snapshot tests. We don't need this today; the optionality costs nothing.

- **Matches the pattern the ecosystem has converged on.** Elm, Redux-Saga, Reactive State libraries, Erlang gen_server — all separate "what should happen" from "do the thing." The pattern is durable.

## Trade-offs accepted

- **Slightly more plumbing than calling side effects inline.** The reducer must build an effect list; the caller must walk it. This is about 20 lines of `runEffects` plus a `dispatch` wrapper per hook.

- **Effect ordering becomes the reducer's responsibility, not the caller's.** The reducer has to return effects in the right order. This is mostly a benefit (explicit is better than implicit), but it means a reducer author has to think about it. Enforced by unit tests that assert on the returned list.

- **Async effects are a little more involved.** `acquireWakeLock` and `release` return Promises. The `runEffects` function currently fires them with `void acquire()` — fire-and-forget. For Phase 2 this is fine (the machine doesn't care whether the lock actually landed; the re-acquire path handles failure). If future machines need to observe async completion, we'll add a return-channel pattern (effect → emit a `wakeLockAcquired` event back into the reducer). Not today's problem.

- **No free visualiser.** XState's editor is genuinely nice; we don't get it. We do get the transition table in `SPECIFICATIONS/02-core-timer.md` (now archived), which is the important artefact — it's the contract the tests enforce.

## Implications

**Enables:**

- Phase 3 voice integration slots on top of the existing timer machine. Parsed session → `start` event → same machine drives Run screen. Zero refactor.
- Phase 4 auth is a second, smaller reducer (registering / signed-in / signed-out) on the same shape. Preset-load becomes a new event into the timer machine.
- Phase 6 admin flows — if they grow beyond single transactions — use the same pattern.
- Test strategy stays consistent: pure reducer tests + hook-level integration tests + end-to-end integration tests. Same three layers for every machine.

**Prevents / makes harder:**

- Adopting a third-party FSM library mid-project. If we ever want XState or similar, this ADR would need to be superseded with a migration plan, not replaced silently.
- Reducer authors can't side-step the rule "no imports from audio/haptics/wakeLock/history in the reducer" without breaking unit tests. That's the point.

---

## References

- **Machine implementation:** [src/lib/timer/machine.ts](../../src/lib/timer/machine.ts) — the concrete instance this ADR generalises from.
- **Type definitions:** [src/lib/timer/types.ts](../../src/lib/timer/types.ts) — `MachineEvent`, `Effect`, `StepResult`.
- **Hook with runEffects:** [src/lib/timer/useTimerMachine.ts](../../src/lib/timer/useTimerMachine.ts) — the calling-layer pattern for React.
- **Archived spec:** [SPECIFICATIONS/ARCHIVE/02-core-timer.md](../../SPECIFICATIONS/ARCHIVE/02-core-timer.md) — transition table in context.
- **Reviewer consensus:** PR #4 `/review-pr-team` comment — architect explicitly recommended capturing the pattern as an ADR to "prevent Phase 3/4 from inventing a different shape."
