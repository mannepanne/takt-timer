# Phase 2: Core timer

## Phase overview

**Phase number:** 2
**Phase name:** Core timer — the usable vertical slice
**Estimated timeframe:** 5–8 days
**Dependencies:** Phase 1 (Foundation) complete.

**Brief description:**
Turn the empty shell into a usable interval timer. No voice and no accounts — a tap-only flow from Home to Complete, fully offline, with audible cues and a Screen Wake Lock. By the end of this phase, Magnus can actually use Takt for his rehab session.

---

## Scope and deliverables

### In scope

- [ ] Home screen: mic button rendered but disabled with a hint ("Voice coming soon — tap *Configure* to build a session").
- [ ] Manual configuration path: a "Configure" affordance on Home opens the Interpretation screen with sensible defaults (e.g. 3 × 60s work, 30s rest).
- [ ] Interpretation screen: ported from prototype, with editable stepper chips for sets / work / rest and a Save/Start action.
- [ ] Stepper sheet: big-target editor for numeric values, with hold-to-accelerate, ported from `interpretation.jsx`.
- [ ] Running screen: ported from prototype, including count-in, work/rest phases with different backgrounds, big mono numerals, set dots, progress bar, pause/resume, skip phase, repeat set, countdown pip for final three seconds.
- [ ] Web Audio beep synth (from prototype's `beep()` helper), triggered at phase transitions and the final three-second pip.
- [ ] Haptic feedback via `navigator.vibrate` where supported.
- [ ] Screen Wake Lock acquired when a session starts, released on stop/complete.
- [ ] Complete screen: totals, "Run it again", "Done". **No "Save as preset" button in this phase** (presets require auth, coming in phase 4).
- [ ] Service worker that caches the app shell, CSS, fonts, and icons for offline operation.
- [ ] Offline behaviour: a session configured while online runs end-to-end with no network.
- [ ] `localStorage` session history: each completed session is appended (capped at ~30 entries). Sparkline on Home renders from this, matching the prototype.
- [ ] Home's "last session" quick-start card: renders if local history has any entry, tap re-runs that configuration.
- [ ] A small "sound on/off" affordance (Settings does not exist yet; a minimal toggle on Home or Running is fine, moved to Settings in phase 5).
- [ ] Unit tests for the timer state machine, localStorage history helpers, Web Audio wrapper (mocked), Wake Lock wrapper (mocked).
- [ ] Integration test: programmatically run a 2-set, 1-second-work, 1-second-rest session through to Complete.

### Out of scope

- Voice anything.
- Accounts, passkeys, presets.
- Save-as-preset button.
- Internationalisation (English copy only).
- Full Settings screen (deferred to phase 5).
- Onboarding (deferred to phase 5).
- Cross-device sync of history.

### Acceptance criteria

- [ ] From a clean install, Magnus can: open Home → Configure → edit to 3 × 60s work / 30s rest → Start → see a 3-second count-in → run through all three sets with audible beeps and visible progress → land on Complete.
- [ ] Pause/resume preserves remaining seconds to the nearest tick.
- [ ] Skip phase advances correctly (work → rest → next set's work; last rest → Complete).
- [ ] Repeat set restarts the current set's work phase from 0.
- [ ] Disabling network mid-session does not interrupt playback (beeps, timer).
- [ ] Configuring a session while offline and running it also works (PWA shell is cached).
- [ ] Screen does not auto-lock during a running session.
- [ ] A completed session appears in the sparkline on Home.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**Timer state machine**
- Choice: model the session as a finite state machine with states `idle | countIn | work | rest | paused | complete`, driven by a single high-resolution tick using `requestAnimationFrame` and `performance.now()` (not `setInterval` — it drifts).
- Rationale: deterministic, testable, tolerant of tab throttling when visible.
- Alternatives considered: `setInterval` (drift), `setTimeout` chain (drift + harder to test), third-party timer lib (overkill). A plain reducer + `requestAnimationFrame` loop is small and testable.

**`localStorage` schema for anon history**
- Choice: single key `takt.history.v1` storing a JSON array of `{ completedAt, totalSec, sets, workSec, restSec }`, capped at 30 entries.
- Rationale: matches the future D1 schema for authenticated users (phase 4) so the import flow is trivial.

**Wake Lock — graceful degradation**
- Not all browsers support `navigator.wakeLock`. When unavailable, we proceed without it and show a small hint in Settings (phase 5) explaining the constraint.

### Technology choices

- **Web Audio API** via a thin wrapper around the prototype's `beep()` function. Single `AudioContext` created lazily on first user gesture (iOS Safari requirement).
- **`react-router-dom`** (or the Phase 1 choice) for routing between `/`, `/configure`, `/run`, `/complete`.
- **Workbox** (or handwritten service worker) for the PWA shell cache — decide at phase start; handwritten is fine for this scope.

### Key files and components

**New files (illustrative):**
```
src/
├── routes/
│   ├── Home.tsx
│   ├── Configure.tsx           # Interpretation screen
│   ├── Run.tsx                 # Running screen
│   └── Complete.tsx
├── components/
│   ├── Interpretation.tsx
│   ├── StepperSheet.tsx
│   ├── SetDots.tsx
│   ├── MicButton.tsx           # disabled state this phase
│   └── Sparkline.tsx
├── lib/
│   ├── timer/
│   │   ├── machine.ts          # reducer + tick
│   │   ├── machine.test.ts
│   │   └── types.ts
│   ├── audio.ts                # beep() wrapper
│   ├── wakeLock.ts
│   ├── haptics.ts
│   └── history.ts              # localStorage helpers
├── service-worker.ts
└── manifest.webmanifest
```

### Database schema changes

None. D1 is untouched this phase.

---

## Testing strategy

### Unit tests

- `machine.test.ts` — phase transitions, pause/resume math, skip, repeat, count-in, completion detection, edge cases (0s rest, 1-set session).
- `history.test.ts` — append, cap at 30, read, corrupted-JSON recovery.
- `audio.test.ts` — mock `AudioContext`, verify beeps scheduled at expected times.
- `wakeLock.test.ts` — acquires on start, releases on stop, handles unsupported environments.

### Integration tests

- [ ] Configure → Run → Complete, with mocked clock driven at 10× speed.
- [ ] Paused-and-resumed session produces correct total seconds.
- [ ] Completed session appears in `localStorage` and drives the sparkline on Home.

### Manual testing checklist

- [ ] Real device (iPhone and Android): configure a 3 × 10s / 5s session, run it, hear beeps, feel haptics.
- [ ] Phone face-up, screen stays on for full session.
- [ ] Airplane mode after configuring: session runs fine.
- [ ] Force-quit and reopen: Home shows history sparkline.
- [ ] Reduced-motion OS setting: animations respect the preference (no mic pulse, no flash-in).

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] Lighthouse mobile Performance ≥90, Accessibility ≥95, Best Practices ≥95, PWA installable.
- [ ] Real-device check on at least one iPhone and one Android.

---

## PR workflow

**Branch:** `feature/phase-2-core-timer`
**PR title:** `Phase 2: Core timer`

Use `/review-pr-team` — the timer state machine and audio behaviour have architectural impact.

---

## Edge cases and considerations

### Known risks

- **Drift on backgrounded tab.** When the tab is visible and `requestAnimationFrame` runs, timing is accurate. If the user backgrounds the tab, `rAF` pauses and audio stops — this is the documented operating mode. Make sure the timer catches up on the first tick when the tab becomes visible again, or snaps to `complete` if the user switched away past the session's end.
- **iOS Safari Web Audio unlock.** `AudioContext` starts suspended on iOS until a user gesture. The first `beep()` must be gated behind an explicit tap (the Configure or Start button) to unlock audio.
- **Wake Lock on older iOS.** Not universally supported; degrade silently, rely on the user having auto-lock set to a long interval.

### Performance considerations

- Animation uses CSS transforms only; no layout thrash.
- Sparkline renders as DOM bars (as in prototype), not SVG — small and cheap.

### Security considerations

- Service worker scope limited to `/`, no cross-origin fetches proxied.
- `localStorage` contains only non-sensitive pseudonymous session summaries.

### Accessibility considerations

- Running screen: timer numerals use `aria-live="polite"` for phase transitions, not for every tick (too chatty for screen readers).
- Pause/resume/skip buttons have descriptive `aria-label`s (ported from prototype).
- Respect `prefers-reduced-motion`.

---

## Technical debt introduced

- **TD-001: Sound toggle lives on a transient UI location, not in Settings.** Moves to the proper Settings screen in phase 5. Risk: Low.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 1](./01-foundation.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Prototype: running.jsx](./prototype-design-files/running.jsx)
- [Prototype: interpretation.jsx](./prototype-design-files/interpretation.jsx)
