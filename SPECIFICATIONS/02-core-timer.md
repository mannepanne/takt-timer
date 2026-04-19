# Phase 2: Core timer

## Phase overview

**Phase number:** 2
**Phase name:** Core timer — the usable vertical slice
**Estimated timeframe:** 6–9 days (original 5–8 plus one day for the TD-010 inline-style port bundled into this phase).
**Dependencies:** Phase 1 (Foundation) and Phase 1.5 (hygiene bundle) complete.

**Brief description:**
Turn the empty shell into a usable interval timer. No voice and no accounts — a tap-only flow from Home to Complete, fully offline, with audible cues and a Screen Wake Lock. By the end of this phase, Magnus can actually use Takt for his rehab session.

**Revised 2026-04-19** following spec-review team consensus. Changes incorporated: state machine transition table; elapsed-from-timestamp pause/resume model; visibility-change treated as pause; iOS haptics scoped to Android only; Wake Lock lifecycle defined; music-vs-beeps coexistence via `navigator.audioSession`; `vite-plugin-pwa` locked as SW tooling; no trailing rest after final set; mic button retained as a demo affordance; TD-010 static-style port bundled into this phase.

---

## Scope and deliverables

### In scope

- [ ] Home screen: mic button rendered in a visibly non-interactive state (styled down, `aria-disabled`, small hint "Voice in Phase 3 — tap _Configure_ to build a session"). This is a deliberate demo affordance until Phase 3 wires the real mic.
- [ ] Manual configuration path: a "Configure" affordance on Home opens the Interpretation screen with sensible defaults (3 × 60s work, 30s rest).
- [ ] Interpretation screen: ported from prototype, with editable stepper chips for sets / work / rest and a Save/Start action.
- [ ] Stepper sheet: big-target editor for numeric values, with hold-to-accelerate, ported from `interpretation.jsx`.
- [ ] Running screen: ported from prototype, including count-in (fixed 3s, see TD-012), work/rest phases with different backgrounds, big mono numerals, set dots, progress bar, pause/resume, skip phase, repeat set, countdown pip for the final three seconds of each phase.
- [ ] **No trailing rest after the final set.** Session ends on the final work phase; skip on the final work → Complete.
- [ ] Repeat set is disabled while `progress < 0.05` of the current phase (matches prototype behaviour exactly); otherwise it restarts the current set's _work_ phase from 0. Rest can repeat-set too; it returns to work of the current set.
- [ ] Web Audio beep synth (from prototype's `beep()` helper), triggered at phase transitions and the final three-second pip.
- [ ] **Music coexistence with background audio.** `navigator.audioSession.type = 'ambient'` set at AudioContext creation/resume (Safari 16.4+). On older iOS this call is a no-op and beeps duck background audio — documented platform limitation, not a bug. Android Chrome mixes by default.
- [ ] **Haptic feedback via `navigator.vibrate`, Android only.** iOS Safari does not implement the Vibration API; feature-detect and silently degrade. Acceptance criteria scoped accordingly.
- [ ] Screen Wake Lock acquired when a session starts; released on stop/complete/navigation-away; re-acquired on visibility-visible (the platform releases the lock when the tab is hidden).
- [ ] Complete screen: totals, "Run it again", "Done". **No "Save as preset" button in this phase** (presets require auth, coming in phase 4).
- [ ] PWA via `vite-plugin-pwa` (Workbox under the hood): service worker precaches the SPA shell, CSS, fonts, icons; cross-origin Google Fonts cached `CacheFirst`.
- [ ] Offline behaviour: a session configured while online runs end-to-end with no network. Configuring while offline also works once the shell is cached.
- [ ] `localStorage` session history: each completed session is appended (capped at 30 entries). Sparkline on Home renders from this, matching the prototype. Schema pre-shaped to match the future D1 schema for Phase 4 import.
- [ ] Home's "last session" quick-start card: renders if local history has any entry. Tap re-runs _that specific_ configuration (same sets/work/rest values), going straight to `/run` from Home — no pass through Configure.
- [ ] A small "sound on/off" affordance on Running (moved to Settings in Phase 5 per TD-001). Default on; persisted to `localStorage` key `takt.sound.v1`; effective immediately mid-session.
- [ ] **TD-010 static-style port.** New components built in this phase use CSS classes in `src/styles.css` (or co-located CSS Modules if the size justifies it), NOT `style={{…}}` object literals. Dynamic values — `transform: scaleX(${progress})`, phase-background colour swap — stay inline; they're effectively governed by `style-src-elem` and fine under the baseline CSP. 90% of the prototype's inline styling is static and ports cleanly.
- [ ] Unit tests for the timer state machine, localStorage history helpers, Web Audio wrapper (mocked), Wake Lock wrapper (mocked), audio session (mocked).
- [ ] Integration test: programmatically run a 2-set, 1-second-work, 1-second-rest session through to Complete with mocked fake timers.

### Out of scope

- Voice anything.
- Accounts, passkeys, presets.
- Save-as-preset button.
- Internationalisation (English copy only).
- Full Settings screen (deferred to Phase 5).
- Onboarding (deferred to Phase 5).
- Cross-device sync of history.
- Pixel-perfect port of decorative animations — see "Visual fidelity" below.

### Visual fidelity policy

**Load-bearing visuals match prototype exactly** (they are information architecture, not decoration):

- Phase-background swap (work → rest colour change)
- Progress bar `transform: scaleX(progress)`
- Set dots (done / active / rest)
- Count-in digit (200px mono)
- Countdown pip for final three seconds
- Pause/resume control state

**Decorative animations are functional-parity, visual-approximation only** (polish is a Phase 5 criterion):

- `flashIn` cue chip
- Screen-enter/exit transitions
- Button hover states
- Mic pulse (not rendered in Phase 2 anyway)

### Acceptance criteria

- [ ] From a clean install, Magnus can: open Home → Configure → edit to 3 × 60s work / 30s rest → Start → see a 3-second count-in → run through all three sets with audible beeps and visible progress → land on Complete. Session ends on the final work phase (no trailing rest).
- [ ] Pause/resume preserves remaining seconds to the nearest second (derived from `phaseStartMs` + `pausedAccumulatedMs`; see state machine below).
- [ ] Skip phase advances correctly: work → rest → next set's work; final work → Complete; during count-in → straight to work.
- [ ] Repeat set restarts the current set's _work_ phase from 0; disabled while `progress < 0.05` to prevent accidental taps.
- [ ] Tab backgrounded mid-session: session pauses; on return, a "session was paused" toast appears and the user taps Resume. No retroactive beeps.
- [ ] Disabling network mid-session does not interrupt playback (beeps, timer, progress).
- [ ] Configuring a session while offline and running it also works (PWA shell + Google Fonts are cached).
- [ ] Wake Lock acquired on Start; released on Stop/Complete/navigation. On platforms where Wake Lock is unsupported, session runs but screen may auto-lock.
- [ ] On iOS Safari 16.4+ with Spotify playing: beeps audible, music continues (may duck). On older iOS: documented platform limitation.
- [ ] On Android Chrome: haptics fire at phase transitions. On iOS: no haptics, silently degraded.
- [ ] A completed session appears in the sparkline on Home.
- [ ] `prefers-reduced-motion: reduce` neutralises decorative animations (enter/exit transitions, flashIn, mic pulse) while preserving load-bearing ones (progress bar transform, phase background swap, timer numerals).
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Timer state machine

**States:** `idle | countIn | work | rest | paused | complete`.

**Session data model:**

```ts
type Session = { sets: number; workSec: number; restSec: number; name?: string };

type MachineState =
  | { phase: 'idle'; session: Session }
  | {
      phase: 'countIn' | 'work' | 'rest';
      session: Session;
      currentIdx: number; // 0-indexed set number
      phaseStartMs: number; // `performance.now()` at phase start
      pausedAccumulatedMs: number; // accumulated pause time within this phase
      lastPipSecond: number | null; // for final-3 countdown pip de-duplication
    }
  | {
      phase: 'paused';
      session: Session;
      resumePhase: 'countIn' | 'work' | 'rest';
      currentIdx: number;
      phaseStartMs: number;
      pausedAccumulatedMs: number;
      pausedAtMs: number; // `performance.now()` when pause began
      lastPipSecond: number | null;
    }
  | { phase: 'complete'; session: Session; totalSec: number; completedAt: number };
```

**Derived field:**

```ts
secondsLeft = Math.max(
  0,
  Math.ceil((phaseTotalSec * 1000 - (now - phaseStartMs - pausedAccumulatedMs)) / 1000),
);
```

Always _derived_. Never stored. This is the core discipline.

**Phase total:** `phaseTotalSec` is 3 for `countIn`, `session.workSec` for `work`, `session.restSec` for `rest`. If `restSec === 0` the `rest` phase is skipped entirely — machine jumps directly from `work` of set N to `work` of set N+1 with a single transition flash, no beep.

**Transition table:**

| From                    | Event                                    | To                                                   | Side effects                                                                     |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `idle`                  | `start`                                  | `countIn`, currentIdx=0                              | `prepareAudio()`, `acquireWakeLock()`, `haptic('start')`                         |
| `countIn`               | `tick` (secondsLeft > 0)                 | `countIn`                                            | emit `beep('count')` once per integer second                                     |
| `countIn`               | `tick` (secondsLeft === 0)               | `work`, currentIdx=0                                 | `beep('phase-work')`, `haptic('phase')`                                          |
| `countIn`               | `skip`                                   | `work`, currentIdx=0                                 | `beep('phase-work')`, `haptic('phase')`                                          |
| `work`                  | `tick` (secondsLeft > 0)                 | `work`                                               | emit `beep('pip')` for secondsLeft ∈ {3,2,1} once each                           |
| `work`                  | `tick` (secondsLeft === 0, not last set) | `rest`                                               | `beep('phase-rest')`, `haptic('phase')`                                          |
| `work`                  | `tick` (secondsLeft === 0, last set)     | `complete`                                           | `beep('complete')`, `haptic('complete')`, `releaseWakeLock()`, `appendHistory()` |
| `work`                  | `skip` (not last set)                    | `rest`                                               | `beep('phase-rest')`, `haptic('phase')`                                          |
| `work`                  | `skip` (last set)                        | `complete`                                           | `beep('complete')`, `haptic('complete')`, `releaseWakeLock()`, `appendHistory()` |
| `work`                  | `repeatSet` (progress ≥ 0.05)            | `work`, same currentIdx, fresh phaseStartMs          | `haptic('repeat')`                                                               |
| `rest`                  | `tick` (secondsLeft > 0)                 | `rest`                                               | pip for secondsLeft ∈ {3,2,1}                                                    |
| `rest`                  | `tick` (secondsLeft === 0)               | `work`, currentIdx + 1                               | `beep('phase-work')`, `haptic('phase')`                                          |
| `rest`                  | `skip`                                   | `work`, currentIdx + 1                               | `beep('phase-work')`, `haptic('phase')`                                          |
| `rest`                  | `repeatSet` (progress ≥ 0.05)            | `work`, same currentIdx, fresh phaseStartMs          | `haptic('repeat')`                                                               |
| `countIn`/`work`/`rest` | `pause`                                  | `paused` (captures pausedAtMs)                       | `releaseWakeLock()`                                                              |
| `paused`                | `resume`                                 | resumePhase, pausedAccumulatedMs += now - pausedAtMs | `prepareAudio()`, `acquireWakeLock()`, `haptic('resume')`                        |
| `countIn`/`work`/`rest` | `visibilityHidden`                       | treated as `pause`                                   | same as `pause`                                                                  |
| `paused`                | `visibilityVisible`                      | stay `paused`, surface "session was paused" toast    | `prepareAudio()` only (user still needs to tap Resume)                           |
| `countIn`/`work`/`rest` | `visibilityVisible`                      | no-op (already running)                              | `prepareAudio()`                                                                 |
| any                     | `stop`                                   | `idle`                                               | `releaseWakeLock()`                                                              |
| any                     | `repeatSet` (progress < 0.05)            | no-op                                                | —                                                                                |

**1-set session** is valid: one `work` phase then `complete`. No rest ever.

**Side-effect sequencing inside the reducer** is pure-describe: the reducer returns `{ nextState, effects: Effect[] }` and a small `runEffects(effects)` function in the hook applies them (audio, haptic, wake lock). The reducer itself stays deterministic and testable.

### Pause/resume math — elapsed from timestamp

Canonical formula:

```
elapsedMs = now - phaseStartMs - pausedAccumulatedMs
secondsLeft = Math.max(0, Math.ceil((phaseTotalSec*1000 - elapsedMs) / 1000))
```

On `pause`: record `pausedAtMs = now`.
On `resume`: `pausedAccumulatedMs += now - pausedAtMs`.

This makes `secondsLeft` deterministic from four numbers (`now`, `phaseStartMs`, `pausedAccumulatedMs`, `phaseTotalSec`) and removes all possibility of drift or tick-boundary rounding bugs. Final-3 pip re-fires correctly on resume because it's de-duplicated via `lastPipSecond` state, not scheduled in advance.

### Visibility-change behaviour

- Tab hidden: machine emits `visibilityHidden` event → treated identically to manual `pause`. Wake Lock is released automatically by the platform; our reducer records that it was released.
- Tab visible again: machine emits `visibilityVisible`. If machine was `paused` via visibilityHidden, it stays `paused` and surfaces a toast "session was paused" with a Resume affordance. AudioContext is resumed and audio session re-asserted so Resume tap fires correctly.
- This is identical to the manual-pause code path, so no separate tests are needed for visibility handling beyond "visibilityHidden from `work` produces `paused`".

### Audio handling — `lib/audio.ts`

Single entry point `prepareAudio()`:

1. Lazy-create the `AudioContext` if not already created.
2. If `ctx.state === 'suspended'`, call `ctx.resume()`.
3. If `navigator.audioSession` exists, set `navigator.audioSession.type = 'ambient'` (Safari 16.4+; silent no-op elsewhere).

`prepareAudio()` is idempotent and called on: Start tap, Resume tap, phase transition (defensive), Last-session quick-start tap, visibility-visible (even when not auto-resuming). The first user gesture after load always creates+resumes the context — whatever path brought them there.

`beep({freq, dur, type, vol})` remains shaped like the prototype.

### localStorage history

Key: `takt.history.v1`. Value: JSON array of `{ completedAt, totalSec, sets, workSec, restSec }`, capped at 30 entries (drop oldest on overflow). Schema matches the future D1 `sessions` table so Phase 4's import-on-register is straightforward.

**Quota handling:** catch `QuotaExceededError` on write → drop oldest entry, retry once → if still failing, log and proceed (don't block Complete). **Concurrent tabs:** last-writer-wins, documented, accepted — at 30 entries × ~100 bytes this won't approach quota anyway.

### Service worker — `vite-plugin-pwa`

**Choice:** `vite-plugin-pwa` (Workbox under the hood). It generates the precache manifest from Vite's hashed filenames automatically, handles cross-origin Google Fonts via a runtime `CacheFirst` strategy, and avoids multiple days of handwritten-SW work that would have to be redone for Phase 4 anyway.

**Config basics:**

- `registerType: 'autoUpdate'`.
- `workbox.globPatterns: ['**/*.{js,css,html,svg,webmanifest,png,ico}']`.
- Runtime caching rule for `https://fonts.googleapis.com` and `https://fonts.gstatic.com` with `CacheFirst` (1 year max-age).
- Manifest (`manifest.webmanifest`) declares `name: 'Takt'`, `short_name: 'Takt'`, `theme_color: '#F3F1EC'`, icons for 192px and 512px (placeholder now; real icons later).

### Wake Lock — `lib/wakeLock.ts`

Wrapper over `navigator.wakeLock.request('screen')`:

- `acquire()`: if supported, request the lock; store the sentinel. If not supported, no-op and set a flag `isSupported: false`.
- `release()`: release the stored sentinel; clear.
- **Re-acquire on visibility-visible**: the platform auto-releases the Wake Lock when the tab goes hidden. When the tab becomes visible again, the wrapper exposes a `reacquireIfNeeded()` the machine can call.
- Graceful degradation: if `isSupported: false`, the acceptance-criteria line about "no auto-lock" is scoped with "where supported". The Onboarding copy in Phase 5 will communicate the limitation.

### Haptics — `lib/haptics.ts`

```
function haptic(pattern) {
  if (typeof navigator.vibrate !== 'function') return; // iOS no-op
  navigator.vibrate(pattern);
}
```

iOS silently degrades. Documented.

### Client router

Existing React Router v7 from Phase 1 extended with:

- `/configure` — Interpretation screen.
- `/run` — Running screen. Refreshing this URL without machine state returns to Home (session is in-memory, not persisted across reloads).
- `/complete` — Complete screen. Same reload behaviour as `/run`.

### Key files (illustrative)

```
src/
├── routes/
│   ├── Home.tsx
│   ├── Configure.tsx
│   ├── Run.tsx
│   └── Complete.tsx
├── components/
│   ├── Interpretation.tsx
│   ├── StepperSheet.tsx
│   ├── SetDots.tsx
│   ├── MicButton.tsx              # demo-only this phase, styled-down
│   ├── Sparkline.tsx
│   └── LastSessionCard.tsx
├── lib/
│   ├── timer/
│   │   ├── machine.ts              # pure reducer + effects list
│   │   ├── machine.test.ts
│   │   ├── types.ts
│   │   └── useTimerMachine.ts      # React hook wrapping reducer + rAF + effects
│   ├── audio.ts
│   ├── audio.test.ts
│   ├── wakeLock.ts
│   ├── wakeLock.test.ts
│   ├── haptics.ts
│   └── history.ts
├── styles.css                      # extended with new screen classes
└── main.tsx
```

`src/service-worker.ts` is not needed — vite-plugin-pwa generates the SW.

---

## Testing strategy

### Unit tests

- `machine.test.ts` — transition table coverage. Pause/resume math across phase boundaries. Skip at every state. Repeat-set threshold. Count-in edge cases. 0s rest. 1-set session. visibilityHidden/Visible equivalent-to-manual-pause. Final work skip → complete.
- `history.test.ts` — append, cap at 30, read, corrupted-JSON recovery, QuotaExceededError retry-once-then-log.
- `audio.test.ts` — `prepareAudio()` is idempotent; resume-from-suspended; audioSession type set when available; beep scheduled with correct freq/dur/vol.
- `wakeLock.test.ts` — acquires on request; releases on release(); `isSupported: false` on unsupported environments; reacquire flow.
- `haptics.test.ts` — no-op when `navigator.vibrate` missing; calls with correct pattern otherwise.
- `useTimerMachine.test.ts` — hook integration with fake rAF / performance / setTimeout via Vitest fake timers.

### Integration tests

- Configure → Run → Complete with `vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance', 'setTimeout'] })`; drive clock through a 2 × 1s work / 1s rest session; assert final state, history appended, total seconds correct.
- Paused-and-resumed session produces correct total seconds (not including paused time).
- `visibilityHidden` during work → machine transitions to `paused`; `visibilityVisible` stays paused.

### Manual testing checklist

- [ ] Real device (iPhone): configure a 3 × 10s / 5s session, run it, hear beeps, confirm NO haptics (iOS platform limitation).
- [ ] Real device (Android): configure a 3 × 10s / 5s session, run it, hear beeps, feel haptics.
- [ ] iPhone iOS 16.4+: play Spotify, start a Takt session — music continues (may duck), beeps audible.
- [ ] iPhone iOS < 16.4: Spotify ducks out when beeps fire (documented platform limitation).
- [ ] Phone face-up, screen stays on for full session (Wake Lock).
- [ ] Tab away mid-session, come back: "session was paused" toast appears. Manual Resume works.
- [ ] Airplane mode after configuring: session runs fine.
- [ ] Force-quit the tab and reopen: Home shows the sparkline and last-session card; tap last-session → goes straight to `/run`.
- [ ] Reduced-motion OS setting: decorative animations (flashIn, enter/exit) neutralised; load-bearing visuals still render.
- [ ] `/run` URL refresh without machine state → navigate back to Home.
- [ ] Offline: install as PWA, go offline, reopen from home screen, configure and run a session.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets (≥95% lines/functions/statements, ≥90% branches).
- [ ] Lighthouse mobile ≥90 Performance, 100 Accessibility, 100 Best Practices, PWA installable.
- [ ] Real-device check on at least one iPhone and one Android.
- [ ] CSP still passes — no new cross-origin loads introduced; `'unsafe-inline'` on `style-src` stays until Phase 4 prep removes it (TD-010 partial progress acknowledged).

---

## PR workflow

**Branch:** `feature/phase-2-core-timer`
**PR title:** `Phase 2: Core timer`

Use `/review-pr-team` — the timer state machine, audio behaviour, and offline PWA have architectural impact.

---

## Edge cases and considerations

### Known risks

- **Drift on backgrounded tab** dissolved by the visibility-as-pause decision. The user is never surprised by fast-forward behaviour; they consciously resume.
- **iOS Safari Web Audio unlock** — `prepareAudio()` entry point handles create/resume uniformly.
- **Wake Lock on older iOS** — silently unsupported; session runs without it; Phase 5 Onboarding copy explains.
- **Music ducking on iOS < 16.4** — platform limitation, documented.

### Performance considerations

- Animation uses CSS transforms only; no layout thrash.
- Sparkline renders as DOM bars (as in prototype), not SVG — small and cheap.
- No rAF when `idle`, `paused`, or `complete` — loop only runs during active phases.

### Security considerations

- Service worker scope limited to `/`; no cross-origin fetches proxied beyond Google Fonts (CacheFirst).
- `localStorage` contains only non-sensitive pseudonymous session summaries.

### Accessibility considerations

- Phase label on Running has `aria-live="polite"` — announced on change only (not on each second tick).
- Count-in digit and final-3 pip are NOT announced to screen readers (too chatty — sighted users get the visual, blind users get the phase-start announcement).
- Pause/resume/skip/repeat-set buttons have descriptive `aria-label`s.
- `@media (prefers-reduced-motion: reduce)` in `styles.css` neutralises: mic pulse (not in this phase anyway), flashIn cue chip, screen enter/exit transitions. Preserves: progress-bar transform, phase-background colour change, count-in digit display.
- Touch targets ≥48×48 on all Running-screen controls.

### Future optimisation opportunities

- Self-host Google Fonts to eliminate the cross-origin CacheFirst rule (Phase 5 polish).
- Port remaining inline styles (dynamic ones) to CSS custom properties updated from JS to enable dropping `'unsafe-inline'` entirely in Phase 4 prep.

---

## Technical debt introduced

- **TD-001** (active after this phase): Sound toggle lives on the Running screen rather than in Settings. Moves to Settings in Phase 5. Risk: Low.
- **TD-012** (new, active after this phase): Count-in duration is fixed at 3s; move to Settings in Phase 5 as a user-adjustable preference. Risk: Low.

**Partially resolves TD-010** — new Phase 2 components use CSS classes for static styles. Remaining `'unsafe-inline'` removal from CSP `style-src` completes in Phase 4 prep when the last dynamic-style patterns are refactored to CSS custom properties.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 1 (archived)](./ARCHIVE/01-foundation.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Technical debt](../REFERENCE/technical-debt.md)
- [Prototype: running.jsx](./prototype-design-files/running.jsx)
- [Prototype: interpretation.jsx](./prototype-design-files/interpretation.jsx)
