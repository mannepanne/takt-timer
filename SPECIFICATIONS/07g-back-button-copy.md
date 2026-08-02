# Phase 7g: Back button, app lifecycle, and copy forks

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first. **Living spec — the back-button/lifecycle detail firms up after [07a](./07a-spikes.md) Spike 2.** This deliverable makes the app feel native at its edges (hardware back button, background/foreground) and tells the truth in its copy (privacy, onboarding, settings).

**Depends on:** 07a Spike 2 (which lifecycle signal fires), 07e (timers behave correctly under keep-awake first).
**Gates:** nothing downstream.
**Shippable?** Yes — after this, hardware back and backgrounding behave correctly, and all native-facing copy is accurate.

---

## Goal

Wire Android's hardware back button and app-lifecycle events to the router and timer machines, and fork the user-facing copy (`Privacy`, `Onboarding`, `Settings`) so nothing on native describes accounts, passkeys, or cloud storage that don't exist here.

## Scope — back button & lifecycle (firms up post-spike)

- [ ] **Hardware back button** via `@capacitor/app`'s `backButton` listener, wired to the router, with a **per-timer** mid-session rule:
  - **Confirm before exiting a running _interval_ session** — you're mid-workout with the phone in front of you; losing it is bad.
  - **Exit silently while only the stopwatch is running** — it keeps running via its persisted state and resumes to the correct elapsed on relaunch.
  - The asymmetry is intentional (interval = actively watched; stopwatch = start-then-walk-away).
  - **Concurrent case:** stopwatch running _and_ an interval session active → the interval-confirm rule wins while on `/run`.
  - Honest limits to document, not fix: the confirm guards only the literal back gesture — HOME/app-switch already pauses an interval session silently, and the interval session is **not persisted**, so OS process-eviction while backgrounded loses it regardless.
- [ ] **Background-pause driven off `@capacitor/app`'s `appStateChange`**, mapped onto the existing `visibilityHidden`/`visibilityVisible` machine events — no new machine states, no reducer change. (Spike 2 confirms the signal; there is **no completion guard to build** — see umbrella/07a for why the "phantom session" fear was a reducer misread.)

## Scope — copy forks

- [ ] **`Privacy.tsx`** forked by platform — current copy describes a passkey public key, D1-stored presets, and voice-call timestamps, none of which exist on native. Native copy: local-only storage, no account, and voice input transcribed by the phone's speech recogniser (which may involve Google). **Must be consistent with the Play Data Safety declaration (07h).**
- [ ] **`Settings.tsx` account block** hidden on native (signed-in state, sign out, delete account, passkey prompt). _(The network call in this block was already killed in 07c; here we hide the UI.)_
- [ ] **`Onboarding.tsx`** first-run copy — remove any account/cloud references on native.

## Acceptance criteria

- [ ] Back button during a running interval session prompts a confirm before exiting; while only the stopwatch runs it exits silently, and the stopwatch is still running (correct elapsed) on reopen.
- [ ] Backgrounding / screen-lock pauses a running interval session and shows the existing "you were paused" dialog on return (driven by `appStateChange`).
- [ ] No native screen (`Privacy`, `Onboarding`, `Settings`) references accounts, passkeys, or cloud sync; `Privacy` copy matches the Data Safety declaration.
- [ ] Web unchanged: browser back, web pause behaviour, and all three screens' web copy are exactly as today; existing Vitest suite passes.

## Testing

- Assert `appStateChange` handling dispatches the existing `visibilityHidden`/`visibilityVisible` events (no new states).
- Back-button unit/interaction tests for the three cases (interval → confirm, stopwatch-only → silent exit, concurrent → interval rule wins).
- Manual (real device): all of the above, plus the copy forks render correctly on native vs web.

## Risks specific to this deliverable

- **Background-pause signal mis-wired** — worst case a missed "you were paused" dialog (not a phantom session). Spike 2 de-risks; this deliverable just consumes the confirmed signal.
- **Copy/Data-Safety inconsistency** — `Privacy` native copy and the 07h Data Safety form must say the same thing about voice audio; a mismatch is a compliance problem, not a wording nit.

## PR workflow

Branch `feature/phase-7g-back-button-copy`. Platform wiring + copy — `/review-pr`, likely standard tier.
