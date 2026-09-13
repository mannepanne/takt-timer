# At-a-distance readability — bigger cues on the running screens

Tester feedback, issue [#153](https://github.com/mannepanne/takt-timer/issues/153): "I would like my work/rest cues to be bigger. Chances are I've got my phone propped up somewhere else as I'm exercising so need to be able to read at distance."

Design canvas with today-versus-proposed mockups: https://claude.ai/code/artifact/c815d58f-2803-4a78-93a4-dfab534c1552. The middle row is the agreed direction, the third row is the same screens in dark mode, and the bottom row is the rejected accent-bar-on-work variant. Every measurement below is also written into this document, so the canvas is a convenience, not the record.

Reviewed with `/review-spec` on 13 Sep 2026; this revision folds in its findings. An accent-tinted rest background was prototyped on the canvas in response to the review and rejected on aesthetics; see Decisions recorded.

## Problem

The clock digits on the running screens are already enormous (120px, 200px on count-in). Everything that gives those digits meaning is not: "Work · Set 2 / 3", "Rest · Set 2 / 3" and "Get ready" are all the 11px muted-grey `.eyebrow` style, and the Done screen's totals are 34px. Across a room the user sees a big number and cannot tell which set they are on, or whether it is work or rest.

The work and rest backgrounds barely help: `--paper` against `--paper-2` is a 1.08:1 contrast ratio in light mode and 1.07:1 in dark, a deliberate dampening rather than a signal. Today the only real work/rest cue at range is the 3px bar's colour.

The Timer page is worse still: its digits are 44px, sized to fit inside a 240px decorative ring whose one-lap-per-hour progress barely moves.

The phone is propped up in portrait. Landscape is explicitly not a use case.

## Solution

Two things, working together.

**Colour carries the phase.** The 6px bar keeps its ink-to-accent flip, and the phase word turns accent during rest. Together with the existing paper-2 dampening those are the work/rest cues; they are recognisable well before the word itself is readable.

**Type carries the detail.** Every screen that is on-screen while exercising gets a three-tier hierarchy: a phase word, a set fraction, and the clock, each visibly smaller than the next. The word confirms the phase up close; the fraction and the clock are what you read from across the room. On the Timer page the ring goes, the digits match the run screens, and the run screens' top bar is reused as a per-minute progress indicator.

This is a firm default, not a setting. No "large display" toggle — the defaults are the opinion.

### Out of scope

- The Configure screen (issue screenshot 1). It is a hands-on screen; it does not need to read at distance and its pills stay as they are.
- Landscape layouts. Portrait only, as decided.
- Any change to the controls' sizes or positions. The issue says the buttons are right; they stay.
- Any change to `Home`, Settings, presets, onboarding, privacy or the voice overlay.
- A user-facing size setting (rejected, see Solution).
- Sound, haptics, timing or state-machine behaviour. This is presentation only.
- Fixing the run screens' bar animating backwards for one second at each phase change. It exists today, and at 6px it may be slightly more visible; tracked as a follow-up if reported, not folded in here.

## Behaviour

### Run screen: count-in

- "Get ready" (`run.getReady`) renders at 22px, uppercase with the eyebrow tracking and weight, in `--ink-2` rather than `--mute`. The 200px count-in digit is unchanged.
- No set fraction is shown during count-in. Count-in runs once, before set 1, on the work background; it never recurs mid-session, so the fraction would always read "1 / n" and adds nothing.
- Pausing during count-in keeps "Get ready" on screen, exactly as today, at the new size.

### Run screen: work and rest

The single translated label "Work · Set 2 / 3" becomes two stacked elements above the clock:

| Tier | Element                                         | Size                                         | Font                     | Colour (work) | Colour (rest)   |
| ---- | ----------------------------------------------- | -------------------------------------------- | ------------------------ | ------------- | --------------- |
| 1    | Phase word: "Work" / "Rest" ("Arbete" / "Vila") | 20px, uppercase, 0.14em tracking, weight 600 | Figtree                  | `--ink-2`     | `--accent-deep` |
| 2    | Set fraction: "2 / 3"                           | 56px, weight 300                             | JetBrains Mono (`.mono`) | `--ink`       | `--ink`         |
| 3    | Clock                                           | 120px (unchanged)                            | JetBrains Mono           | `--ink`       | `--ink`         |

Spacing: 12px between the phase word and the fraction, 22px between the fraction and the clock. The block stays vertically centred in `.run-body` as today. The clock therefore sits slightly lower during work and rest than during count-in, because the fraction is present; today the same jump exists between the 200px and 120px digits. Accepted.

**Single-set sessions hide the fraction.** When `session.sets === 1` the fraction element is not rendered. A 56px "1 / 1" would be the largest thing on screen while saying nothing.

The beep-countdown pip chip (`.run-pip-chip`, shown in the last seconds of a phase) stays inline beside the phase word, at its current size. It is a momentary secondary cue, not something to read at distance.

### Backgrounds

- Unchanged: `--paper` during work and count-in, `--paper-2` during rest. The subtle dampening is the intended look. An accent tint was tried on the canvas and rejected.
- Dark mode needs nothing new. The same tokens resolve to the dark palette, the bar's ink fill reads as a light mark on dark (the rule already recorded in `REFERENCE/theming.md` for thin indicators), and the rest word uses the resolver's dark-derived `--accent-deep`. The canvas's third row shows all five screens on the dark tokens.

### Progress bar (run screens)

- Height goes from 3px to 6px.
- Colours unchanged: `--ink` fill during work and count-in, `--accent` fill during rest. The ink-to-accent flip is deliberate and is kept (the all-accent variant on the canvas was rejected for exactly that reason).

### Done screen

- The "Complete" eyebrow becomes 20px, uppercase, eyebrow tracking and weight, in `--accent-deep`, with the check icon scaled to 26px beside it — the same visual weight as the phase word on the preceding screens.
- The two totals ("Total time", "Work time") grow from 34px to **44px**, weight 300. Not 56px: at 56px a five-character total such as "12:00" is about 160px wide against a 145px column on a 375px phone, so any session of ten minutes or more would overflow the two-column grid. At 44px the same string is about 125px and fits on a 360px phone. Their 11px labels are unchanged.
- Heading, subtitle, divider and all three buttons are unchanged.

### Timer page

- The `ProgressRing` is removed from the page.
- The digits render at 120px, weight 300, centred in the body — the same `.run-timer-big` size as the run screens.
- **Past 99:59 the digits step down to 96px.** The stopwatch has no hour rollover (`fmtTime` is `M:SS`), so "100:00" is six characters, about 403px at 120px, which does not fit the roughly 400px body. Six characters at 96px is about 322px. A stopwatch left running that long is a forgotten one, but it must not render clipped.
- A top progress bar, identical in construction to the run screens' bar (6px, `--rule` track), sits at the top of the screen and fills from left to right once per minute in `--accent`, then resets to empty and fills again. The colour is accent, not ink: ink now means "work phase" on the run screens, and the Timer page has no phases; accent is also what the ring already was.
- The reset at the minute boundary is instant. The Timer page's bar fill has no CSS transition at all, so there is nothing to animate backwards. See Architecture.
- While paused the bar holds its position; on reset it returns to empty.
- The Home "Timer · 4:32" indicator is unchanged.

### Accessibility

- The phase word and set fraction share one `aria-live="polite"` container, so a screen reader announces "Work, 2 / 3" as one update at each phase change. **The clock and the pip chip are outside that container.** Putting the clock inside would announce every second; the chip inside would re-announce the phase during the last three seconds of every phase. The fraction's separator is the literal text "/".
- The Timer page's bar is `aria-hidden`, exactly as the ring was; the digits remain the only informational element.
- Reduced motion: the bar fill on the run screens is added to the existing `@media (prefers-reduced-motion: reduce)` block with `transition: none`. Today that block covers the ring's fill; deleting the ring must not silently leave the run screens' bar as the one animated element without an escape hatch. The Timer page's bar has no transition to begin with.
- Contrast: every pair this spec uses is already in `scripts/check-contrast.mjs`. `--ink-2` on `--paper` (the work word and count-in label) is listed; `--accent-deep` on `--paper-2` (the rest word) is a per-accent pair. No additions; the script runs unchanged and must pass for every accent in both appearances. The 4.5:1 text threshold applies even though the 20px word would qualify as large text.

## Architecture

### i18n: split the phase string

`run.phase.work` / `run.phase.rest` currently carry the whole "Work · Set {idx} / {total}" sentence. They become the phase word only:

```ts
'run.phase.work': { en: 'Work', sv: 'Arbete' },
'run.phase.rest': { en: 'Rest', sv: 'Vila' },
'run.setCount':   { en: '{idx} / {total}', sv: '{idx} / {total}' },
```

The fraction is a separate key rather than a hard-coded template in JSX so the separator stays translatable. Both languages use the same value today.

`src/i18n/context.test.tsx` has two assertions on `run.phase.work`: the interpolation test and the unknown-placeholder test. Both are repointed at `run.setCount`, the only key that still carries placeholders. `REFERENCE/i18n.md` uses the old combined string as its interpolation example and is updated to `run.setCount`.

### Run screen DOM

The current `.run-phase-label` does five jobs at once: layout row, eyebrow colour, rest colour, live region and pip-chip host. It is replaced by an explicit structure:

```
.run-phase-block            flex column, centred, position: relative
  .run-phase-live           flex column, aria-live="polite" — word and fraction only
    .run-phase-word         the word (.rest modifier for colour; .run-countin-label during count-in)
    .run-set-count          the fraction (absent during count-in and for single-set sessions)
  .run-pip-chip             sibling of the live region, position: absolute beside the word
  .run-timer-big            the clock, sibling of the live region
```

The live region's DOM is word plus fraction and nothing else. The pip chip sits visually beside the word but is a sibling in the DOM, positioned absolutely against the block, so its per-second updates never re-announce the phase.

### CSS: new run classes, one generalised bar modifier

All sizes are plain px, matching every other size on these screens (no `clamp()`, no viewport units). The app viewport is capped at 440px wide and portrait-only is the use case. The two overflow cases found in review were solved by choosing sizes that fit, not by fluid scaling.

- `.run-phase-word` — 20px, uppercase, 0.14em, 600, `--ink-2`; `.run-phase-word.rest` sets `--accent-deep`. `.run-countin-label` — 22px, otherwise identical.
- `.run-set-count` — 56px, 300, `--ink`, `.mono`.
- `.run-bar` — `height: 6px`. The existing `.run-bar.rest` modifier is renamed `.run-bar.accent` (two references: the stylesheet and `Run.tsx`) so the Timer page can use it without borrowing the word "rest". `.run-bar.static .fill` — `transition: none`, used by the Timer page.
- `.run-bar .fill` — added to the reduced-motion block.
- `.complete-eyebrow-label` (exists, colour only) gains 20px, uppercase, tracking and weight. `.complete-totals-value` — 44px.
- `.timer-digits` — no longer absolutely positioned inside a ring wrap; 120px, 300. `.timer-digits.compact` — 96px. `.timer-ring-wrap`, `.progress-ring-track` and `.progress-ring-fill` (including its reduced-motion entry) are deleted.

Every colour stays a token.

### Timer page: minute progress replaces the ring

- `ringProgress()` in `src/lib/stopwatch/types.ts` (one lap per hour) is replaced by `minuteProgress(ms)` = `(ms % 60_000) / 60_000`, re-exported from `machine.ts` as before. The `MS_PER_HOUR` constant goes with it. Its tests move with it.
- `src/components/ProgressRing.tsx` and its test are deleted. Nothing else imports it.
- **Poll cadence stays at 200ms** (`RING_POLL_MS` renamed `BAR_POLL_MS`). The same `elapsed` value drives both the bar and the digits; a slower poll would make the digits stutter, and the run screen's digits are driven by `requestAnimationFrame`, so there is no once-a-second precedent to lean on. At 200ms a 6px bar advances a third of a percent per tick, which is visually continuous with no transition. That is why the Timer bar uses the `static` modifier: no transition means no backwards animation at the minute wrap and no snap logic of any kind.
- `Timer.tsx` adds the `compact` class to the digits when the formatted string is longer than five characters.

### No state, storage or API change

The stopwatch reducer, its persistence key, the interval machine, the Worker and D1 are untouched. The Android app ships the same web bundle and picks the change up on its next build; no native code changes. **No Play Console upload is part of this work.** The closed test's 14-day clock is running; device verification uses a local debug APK from the existing `android/` project.

## UI

Reference: canvas linked at the top. Middle row, left to right: Get ready, Work, Rest, Done, Timer, on the light tokens. Third row: the same five on the dark tokens. Bottom row: the rejected accent-bar variant.

Width sanity, using JetBrains Mono's 0.6em advance and the existing negative tracking:

| String                            | Size  | Approx. width | Available                     |
| --------------------------------- | ----- | ------------- | ----------------------------- |
| "99 / 99" (sets are capped at 99) | 56px  | 235px         | ~350px run body               |
| "60:00" (longest run clock)       | 120px | 336px         | ~350px run body               |
| "100:00" (Timer past 99:59)       | 96px  | 322px         | ~400px timer body             |
| "12:00" (Done total)              | 44px  | 125px         | 138px column on a 360px phone |

"Arbete" and "Vila" at 20px uppercase with 0.14em tracking are under 120px wide, so `nowrap` on the row is safe in both languages.

Vertical sanity: the run body has roughly 650px available on an 844px viewport and the new block is about 230px tall; on a 640px-tall phone the body still has roughly 450px.

## Files affected

- `src/i18n/strings.ts` — split `run.phase.*`, add `run.setCount`.
- `src/i18n/context.test.tsx` — repoint both `run.phase.work` assertions at `run.setCount`.
- `REFERENCE/i18n.md` — interpolation example now uses `run.setCount`.
- `src/routes/Run.tsx`, `src/routes/Run.test.tsx` — phase block DOM, `accent` bar modifier, single-set hiding, tests.
- `src/routes/Complete.tsx` — check icon size only (sizes are CSS).
- `src/routes/Timer.tsx`, `src/routes/Timer.test.tsx` — ring out, static bar in, `compact` digits, `aria-hidden` bar test replacing the ring test.
- `src/lib/stopwatch/types.ts`, `machine.ts`, `machine.test.ts` — `ringProgress` and `MS_PER_HOUR` become `minuteProgress`.
- `src/components/ProgressRing.tsx`, `ProgressRing.test.tsx` — deleted.
- `src/styles.css` — classes and sizes listed under Architecture; reduced-motion block.
- `SPECIFICATIONS/ARCHIVE/timer-mode.md` — a superseded note on the ring paragraph, in the style of the existing #131 note.
- `SPECIFICATIONS/CLAUDE.md`, root `CLAUDE.md` — this spec listed as active, then archived on ship.

## Acceptance criteria

- [ ] Work and rest screens show the phase word (20px), set fraction (56px mono) and clock (120px) stacked and centred, in both English and Swedish.
- [ ] A single-set session shows the phase word and clock with no fraction.
- [ ] Count-in shows "Get ready" at 22px and no fraction, including while paused.
- [ ] Rest renders on `--paper-2` with the phase word in `--accent-deep` and the bar in `--accent`; work renders on `--paper` with `--ink-2` and `--ink`. Both hold in dark mode with no new token values.
- [ ] Progress bar is 6px on run screens and on the Timer page.
- [ ] Done screen: "Complete" eyebrow at 20px with a 26px check; totals at 44px and not overflowing at "12:00" on a 360px-wide viewport; buttons unchanged.
- [ ] Timer page: no ring; digits at 120px, dropping to 96px at "100:00"; accent top bar fills once per minute with no transition, resets instantly at the boundary, holds while paused, empties on reset.
- [ ] Screen-reader announcement at a phase change is a single polite update containing the phase word and the fraction, and nothing is announced on clock ticks or pip-chip updates.
- [ ] `prefers-reduced-motion` disables the run screens' bar transition.
- [ ] `pnpm contrast:check` passes unchanged, every accent, light and dark.
- [ ] `src/styles.test.ts` passes (no colour literals introduced).
- [ ] `pnpm test`, `pnpm typecheck` pass; coverage floors hold. Deleting a fully-covered file lowers the numerator, so check coverage locally before pushing.
- [ ] Verified on a real Android device via a local debug APK, and on the live web app, in light and dark, from roughly three metres in portrait: phase recognisable by bar and word colour, set fraction and clock legible. If the fraction is not legible at three metres, the fallback is 64px with the fraction on its own line, which still fits "99 / 99" at about 269px.

## Testing strategy

- **Run.test.tsx:** renders work and rest phases and asserts the phase word text, the fraction text, the `rest` class on the screen and the `accent` class on the bar; asserts the count-in renders "Get ready" and no fraction; asserts a one-set session renders no fraction; asserts the live region's text content is word plus fraction and does not contain the clock.
- **Timer.test.tsx:** asserts no `svg.progress-ring` exists, the bar is present, `aria-hidden` and carries `static`; the fill's `transform` reflects `minuteProgress` at a faked elapsed time; the digits gain `compact` at 100 minutes and not at 99:59.
- **machine.test.ts:** `minuteProgress` at 0, 30s, 60s (wraps to 0), 61s and 2m15s.
- **styles.test.ts** and `contrast:check`: unchanged mechanism, run as part of the PR.
- Manual device check per the last acceptance criterion; result recorded in the PR.

## PR plan

One PR, `feature/at-a-distance-readability`. With the Timer bar reduced to a static fill and the ring deletion, the Timer change is a markup simplification rather than a new subsystem, so the argument for splitting it out no longer holds. Run `/review-pr` on it.

## Risks

- **Fraction reads as a ratio, not a set count.** Mitigated by the phase word directly above it. If testers misread it, the fallback is not "Set 2 / 3" at 56px, which at "Set 10 / 12" would be about 370px and overflow; it is a smaller "Set" prefix in the 20px word style on the same line, "SET 2 / 3", with the numerals staying large.
- **Work versus rest is still not obvious at three metres.** The review's arithmetic says the word will not be readable at that range, so the cue rests on the bar's colour flip and the word's colour. If the device check finds that insufficient, the option on the table is a stronger rest background; it was prototyped and is a one-token change, but it was rejected on looks and would need re-approval.
- **Coverage floors.** Noted in acceptance criteria; not a design risk.

## Decisions recorded

- Colour, not type, is the primary phase cue at distance: the bar's ink-to-accent flip and the word's accent colour. A 20px word is about 2mm tall on a phone and is not expected to be readable at three metres. The review proposed an accent-tinted rest background as a stronger cue; it was prototyped at 14% and 24% and rejected by the product owner because it breaks the quiet, dampened look of the rest screen. The paper-2 background stays.
- The Timer page keeps a progress indicator, as a static-fill minute bar in accent. "No indicator at all" was considered and rejected by the product owner; the chosen form costs no more than the deletion alone.
- No user-facing size setting. The defaults are the opinion.
