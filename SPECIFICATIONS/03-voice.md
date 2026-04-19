# Phase 3: Voice pipeline

## Phase overview

**Phase number:** 3
**Phase name:** Voice pipeline — mic in, session out
**Estimated timeframe:** 5–7 days (base 4–6 plus one day for the half-day spike, parser port, and extra surface from the review).
**Dependencies:** Phase 1 (Foundation), Phase 1.5 (hygiene), Phase 2 (Core timer) complete.

**Brief description:**
Enable the mic button on Home. Capture audio in the browser, send it to a Worker that runs Whisper-turbo on Cloudflare Workers AI, parse the transcript to a structured session with a deterministic parser (ported from the prototype's `voice.js`), fall back to a Llama model only for phrasings the parser can't resolve. Feed the parsed session into the existing Interpretation screen. Validate the pipeline on both English and Swedish at phase end — the language _toggle_ UI lands with Phase 5 Settings.

**Revised 2026-04-19** following spec-review team consensus. Material changes: parser-first architecture (Llama becomes fallback, not primary); Swedish validated in Phase 3 (toggle deferred to Phase 5); language-mismatch gate required; iOS Safari MediaRecorder reality written into spec; Configure route refactor acknowledged as in-scope; retry semantics specified; rate-limit edges pinned (UTC, increment-at-check, dev bypass); Voice overlay modelled as a reducer-plus-effects machine per the ADR; Llama output bounds = Phase 2 Stepper constraints. Explicitly rejected: browser `SpeechRecognition` as primary (privacy posture + iOS VoiceOver a11y).

---

## Scope and deliverables

### In scope

- [ ] Mic button on Home enabled. Tap opens the Voice overlay (**tap-to-start + tap-to-stop**, overriding the prototype's hold-to-talk — hold-to-talk has motor-impairment a11y issues and conflicts with iOS gestures).
- [ ] Voice overlay ported from `screens.jsx`, implemented as a **reducer-plus-effects machine** (`src/lib/voice/machine.ts`) per [ADR 2026-04-19 — Reducer-plus-effects pattern](../REFERENCE/decisions/2026-04-19-reducer-plus-effects-pattern.md). States: `{ idle, requesting-permission, listening, uploading, thinking, rate-limited, language-mismatch, parse-error, offline, permission-denied, browser-unsupported }`. Events: `{ micTap, permissionGranted, permissionDenied, recordingStopped, uploadStarted, parseSuccess, parseFailed, rateLimitHit, cancel, retry }`. Full transition table in the [Voice overlay state machine](#voice-overlay-state-machine) section below.
- [ ] Mic capture via `getUserMedia({ audio: true })` + `MediaRecorder`. **Hard 8-second cap with manual stop.** No silence detection in this phase — VAD/energy-threshold stopping is deferred; 8s is generous headroom for canonical phrases (typically 2–4s) and silence detection is a tuning-ops burden we don't need yet.
- [ ] Audio format: use whatever `MediaRecorder.isTypeSupported()` reports as supported in priority order `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg`. Whisper infers the container from the magic bytes; we don't declare the MIME server-side. No `audio/wav` fallback (cannot be produced from `MediaRecorder` on Safari). Pre-Safari-14.5 (no `MediaRecorder` at all) gets the `browser-unsupported` state.
- [ ] iOS Safari reality: the first `MediaRecorder.stop()` after a fresh permission grant can yield a zero-byte blob. Mitigation: detect zero-length blob, show a friendly "let's try that again" state that short-circuits to a second recording without counting against rate limit (the call never reached the Worker).
- [ ] `/api/voice/parse` endpoint on the Worker:
  - Accepts an audio blob (raw bytes, no MIME declaration).
  - Calls `@cf/openai/whisper-large-v3-turbo` for transcription. **No language hint** — let Whisper auto-detect so the language-mismatch gate works.
  - Inspects Whisper's returned `language` field. If `language !== 'en' && language !== 'sv'`, return a structured "language-unsupported" error (no Llama call, no quota burn beyond the rate-limit check that already happened).
  - Runs the transcript through the **deterministic parser** (`worker/api/voice/parse-session.ts`, ported from the prototype's `voice.js`) as the primary path. If the parser returns a confident session, return it.
  - **Llama fallback** only when the parser can't resolve the phrase: passes the transcript to a Workers AI Llama model with a system prompt that returns strict JSON `{ sets, workSec, restSec }` — no `name` field (stripped from Phase 3 schema; returns in Phase 4 with presets).
  - Returns `{ session, transcript, language, source: 'parser' | 'llama' }` to the client.
- [ ] **Voice → Configure handoff** wires into the existing `Configure` route. Voice navigates to `/configure` with `location.state.session` pre-populated; the user reviews and edits before tapping Start. Requires a targeted refactor of `src/routes/Configure.tsx` to accept `location.state.session` when present (mirrors the existing `/run` pattern in `Home.tsx`). This is in-scope Phase 3 work, not "free".
- [ ] Anonymous rate limit: 3 voice calls per IP per **UTC day**. Stored in Cloudflare KV. Increment happens **at the rate-limit check, before inference** — so cancelled uploads and failed parses consume quota (honest UX, caps Workers AI spend). 429 response includes `retryAfter` = seconds until next UTC midnight.
- [ ] Rate-limit UI copy avoids "tomorrow" (wrong under UTC + shared-IP scenarios). Uses "You've used today's voice allowance. Tap _Configure_ to build a session manually." The mic button's aria-label reflects the remaining count where possible.
- [ ] **Dev rate-limit bypass** lands with the limiter, not as a hotfix. When the Worker is running via `wrangler dev` OR an `ALLOW_RATE_LIMIT_BYPASS` env var is set, the limiter is skipped. Production never has this flag set.
- [ ] Llama output bounds: `sets` 1–99, `workSec` 5–3600, `restSec` 0–3600 (exactly matching `Interpretation.tsx` Stepper constraints). On out-of-bounds but plausibly-near values, **clamp and flag** (`confidence: 'low'` in the response, Interpretation screen can highlight the clamped chip). On clearly-nonsense values (e.g. `sets: 1000`), reject and retry Llama once with a repair-style prompt.
- [ ] Llama retry semantics (pinned): retry happens with **temperature 0.3 (bumped from 0) AND a one-shot repair example** showing the bad output and the correct shape. Not "stricter prompt" — at temp 0 that's a no-op. On second failure, structured error + client falls through to the Interpretation screen with defaults.
- [ ] Interpretation screen receives the parsed session via `location.state` and displays it for editing, same as the Phase 2 manual path. No new Interpretation UI — but the chip that was clamped shows a `confidence: 'low'` indicator the user can override.
- [ ] Language-mismatch gate: if Whisper detected neither `en` nor `sv`, the overlay lands on `language-mismatch` with copy _"Takt currently understands English and Swedish. Tap Configure to build a session manually."_ No Llama call.
- [ ] **Language validation across the pipeline in Phase 3**, even though the _Settings toggle_ ships in Phase 5. The parser handles word-numerals in both `en` (one, two, thirty) and `sv` (ett, två, trettio), common units (`minute/minut`, `second/sekund`, `rest/vila`, `sets/set`), and common separators. Llama fallback uses a language-aware prompt with examples in both languages. Canonical test corpus covers both.
- [ ] Failure states (all calm, all with a CTA to manual Configure):
  - Permission denied (first-time or cached — same copy, same CTA; no instructions to navigate browser settings).
  - Permission revoked mid-recording.
  - Offline — mic button disabled with a friendly hint.
  - Empty/zero-byte recording (iOS first-grab) — prompt to retry, don't charge quota.
  - Whisper returns empty transcript — prompt to retry, do charge quota (the call happened).
  - Language unsupported (neither `en` nor `sv`) — `language-mismatch` state.
  - Parser failed AND Llama retry exhausted — friendly "Couldn't understand" + tap-through to Configure with defaults.
  - Browser doesn't support MediaRecorder (pre-Safari-14.5 etc) — `browser-unsupported` state.
- [ ] Observability: structured logs per call — parse latency, transcript length, parse source (parser/llama), language detected, parser confidence, Whisper status, rate-limit state. **No raw transcripts in logs under normal operation.** On parse failure, sample (1 in 10) a redacted transcript (digits + top-50 common words; everything else hashed) into a failure log with a 14-day retention window. IP addresses are hashed before logging.
- [ ] ADR on **KV for daily-cap rate limiting vs Cloudflare's native Rate Limiting binding**. KV wins for Phase 3 (token-bucket semantics of the native binding don't cleanly express "3 per UTC day"). Race-condition acceptance (KV is eventually consistent; up to single-digit extra calls may slip on concurrent requests) documented in the ADR.

### Out of scope

- Voice "save as preset" — needs presets, Phase 4.
- Voice control during a running session (pause, skip, etc).
- Authenticated-user rate-limit tier — Phase 4.
- Browser `SpeechRecognition` API as an alternative transport — **explicitly rejected**: audio would route to Google/Apple, breaking Takt's privacy posture.
- Language _toggle_ UI in Settings — Phase 5. (Pipeline works for both languages in Phase 3; the user doesn't choose.)
- Silence detection / VAD — Phase 5 polish only if user complaints surface.
- Streaming responses — whole-transcript-then-parse is fine at Phase 3 scale.

### Acceptance criteria

- [ ] Saying _"Three sets of one minute each, thirty seconds rest in between"_ from a real phone produces a correct session on Interpretation within ~2 seconds end-to-end on a decent connection (typical case; cold start up to 6s is acceptable and the UI doesn't time out).
- [ ] Saying the Swedish equivalent _"Tre set om en minut vardera, trettio sekunders vila mellan varje"_ from a real phone also produces a correct session.
- [ ] The deterministic parser handles ≥70% of the pinned canonical test corpus; Llama fallback covers the rest.
- [ ] Saying something nonsensical ("banana kayak") lands a graceful failure UI, not a crash.
- [ ] Speaking in a language other than English or Swedish lands on the `language-mismatch` state with the documented copy. No Llama call is made.
- [ ] Rate limit enforced: the fourth call in a UTC day from the same IP returns 429 with the friendly limit-reached state; `retryAfter` reflects seconds until next UTC midnight.
- [ ] Mic permission denial shows a single uniform message (no telling users to navigate browser settings) with a tap-through to `/configure`.
- [ ] The mic button is disabled with a friendly hint when the device reports offline.
- [ ] Pre-Safari-14.5 (no MediaRecorder) shows the `browser-unsupported` overlay.
- [ ] Dev rate-limit bypass works under `wrangler dev`; does not work in production build.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**Parser-first, Llama-fallback**

- Choice: run the transcript through a deterministic parser first (ported from the prototype's `voice.js`, which already handles canonical phrases + common paraphrases). Llama is invoked only when the parser returns low confidence.
- Rationale: the problem domain is a closed grammar (integers + a small fixed vocabulary of units and separators). Deterministic parsing is fast (<1ms), free, privacy-preserving (no LLM pass), and debuggable ("we didn't match X"). Llama's value is the long tail of phrasings the parser misses.
- Validated by a **half-day spike** at phase start: measure Whisper-turbo warm/cold latency + parser coverage on a pinned 20-phrase corpus. Go / no-go:
  - If parser ≥70% on canonical AND Whisper warm ≤600ms: ship parser-first-with-Llama-fallback (this spec).
  - If parser <50%: revert to Llama-primary (previous spec shape, with all other revisions still in force).
- Alternatives considered: Llama-only (original spec), native `SpeechRecognition` API (rejected — privacy posture), XState-style machine library (rejected — ADR 2026-04-19 covers this).

**KV for daily-cap rate limiting**

- Choice: Cloudflare KV namespace `RATE_LIMITS`, key shape `ratelimit:anon:{ipHash}:{YYYY-MM-DD-UTC}`, value a counter, TTL 26 hours.
- Alternatives: Cloudflare native Rate Limiting binding (token-bucket — awkward for daily cap), Durable Object per IP (overkill for 3/day), D1 (not wired until Phase 4).
- Trade-off accepted: KV read-then-write is racy; under concurrent requests up to ~2 extra calls may slip per IP. Bounded impact, documented in ADR.

**Voice overlay as a reducer-plus-effects machine**

- Choice: same shape as the Phase 2 timer machine — pure reducer, effects as data, React hook runs them.
- Rationale: ADR 2026-04-19 established this pattern project-wide. Overlay lifecycle is complex (permission × recording × network × parse × rate-limit states); a reducer gives us the same testability + explicit-ordering benefits the timer machine got.

**Voice → Configure (not Voice → Run)**

- Choice: successful parse navigates to `/configure` with `location.state.session` pre-populated. User reviews and taps Start.
- Rationale: preserves "voice-first, touch-always" — voice is a proposal, confirmation is always a tap. Matches the prototype. Reuses existing Configure → Run flow.
- Requires: `Configure.tsx` refactor to accept `location.state.session` and use it as the initial value instead of `DEFAULT_SESSION`. Same pattern as `/run` already uses.

### Voice overlay state machine

**States:**

```ts
type VoiceState =
  | { phase: 'idle' }
  | { phase: 'requesting-permission' }
  | { phase: 'listening'; startedAtMs: number }
  | { phase: 'uploading'; blob: Blob }
  | { phase: 'thinking'; transcript?: string }
  | { phase: 'rate-limited'; retryAfterSec: number }
  | { phase: 'language-mismatch'; detected: string }
  | { phase: 'parse-error'; reason: string }
  | { phase: 'offline' }
  | { phase: 'permission-denied' }
  | { phase: 'browser-unsupported' };
```

**Transition table (abbreviated — full table lives in implementation):**

| From                    | Event                        | To                           | Side effects                                    |
| ----------------------- | ---------------------------- | ---------------------------- | ----------------------------------------------- |
| `idle`                  | `micTap` (online, supported) | `requesting-permission`      | `requestMic()`                                  |
| `idle`                  | `micTap` (offline)           | `offline`                    | —                                               |
| `idle`                  | `micTap` (!supported)        | `browser-unsupported`        | —                                               |
| `requesting-permission` | `permissionGranted`          | `listening`, startedAtMs=now | `startRecording()`, `schedule8sCap`             |
| `requesting-permission` | `permissionDenied`           | `permission-denied`          | —                                               |
| `listening`             | `stop` OR `cap`              | `uploading`, blob=result     | `stopRecording()`                               |
| `listening`             | `cancel`                     | `idle`                       | `stopRecording()`, `discardBlob()`              |
| `uploading`             | `blobEmpty` (iOS first-grab) | `idle`                       | `showRetryToast()`                              |
| `uploading`             | `upload`                     | `thinking`                   | `POST /api/voice/parse`                         |
| `thinking`              | `parseSuccess(session)`      | `idle`                       | `navigate('/configure', { state: { session }})` |
| `thinking`              | `parseError(reason)`         | `parse-error`                | —                                               |
| `thinking`              | `rateLimit(retryAfter)`      | `rate-limited`               | —                                               |
| `thinking`              | `languageMismatch(lang)`     | `language-mismatch`          | —                                               |
| any error state         | `cancel` or `retry`          | `idle`                       | —                                               |

**Effects:** `requestMic`, `startRecording`, `stopRecording`, `discardBlob`, `showRetryToast`, `POST`, `navigate`, `schedule8sCap`.

The reducer is pure and fully unit-testable without a browser. The hook in `useVoiceMachine.ts` translates events from browser APIs into reducer events and runs effects.

### Parser design

Ported from `SPECIFICATIONS/prototype-design-files/voice.js` to `worker/api/voice/parse-session.ts`, typed in TypeScript, extended with Swedish lexicon:

- **Numbers:** digits + word-numerals (EN: one–ninety, common compounds; SV: ett, två, tre, … tjugo, trettio, fyrtio, …).
- **Units:** minute/minuter/min, second/sekunder/sek, plus Swedish equivalents.
- **Separators:** `of`, `with`, `and`, `rest`, `vila`, `mellan`, comma, `—`.
- **Compound durations:** "1 min 30 s", "1:30", "90 seconds".
- **Rest phrasing:** "30 seconds rest in between", "with 30 seconds rest", "and 30 sec rest".

Returns `{ sets, workSec, restSec, confidence: 'high' | 'low' | 'none' }`. High + low confidence return to client; none triggers Llama fallback.

### Technology choices

- **`@cf/openai/whisper-large-v3-turbo`** — transcription model.
- **Workers AI Llama model** — picked during the spike from `@cf/meta/llama-3.2-3b-instruct` or `@cf/meta/llama-3.1-8b-instruct` based on parse-accuracy + latency.
- **`zod`** — runtime validation of the Llama response. First runtime dep in the Worker bundle (~12 KB gzipped). Noted in [../REFERENCE/technical-debt.md] if it becomes a bundle concern.
- **`MediaRecorder`** — browser-side recording; format auto-selected via `isTypeSupported()`.
- **No `@cloudflare/vitest-pool-workers` yet** — the Worker surface in this phase is small enough that hand-mocking `env.AI.run` and `env.RATE_LIMITS.{get,put}` gives better test isolation than a real workerd instance. Lands in Phase 4 when D1 arrives.

### Key files and components

```
src/
├── components/
│   └── VoiceOverlay.tsx
├── lib/
│   ├── voice/
│   │   ├── machine.ts                # reducer + effects (pure)
│   │   ├── machine.test.ts
│   │   ├── useVoiceMachine.ts        # React hook
│   │   └── types.ts
│   ├── mic.ts                        # getUserMedia + MediaRecorder wrapper
│   ├── mic.test.ts
│   └── voice-client.ts               # POST /api/voice/parse, error shapes
worker/
├── api/
│   ├── voice/
│   │   ├── parse.ts                  # the endpoint
│   │   ├── parse.test.ts
│   │   ├── parse-session.ts          # deterministic parser (TS port of voice.js)
│   │   ├── parse-session.test.ts
│   │   ├── whisper.ts                # wraps env.AI.run(whisper)
│   │   ├── llama.ts                  # wraps env.AI.run(llama) + zod schema
│   │   └── rate-limit.ts             # KV-backed limiter + dev bypass
└── prompts/
    ├── interpret-session-en.md
    └── interpret-session-sv.md
```

`Configure.tsx` gets a targeted edit to accept `location.state.session` as initial value. Home's `MicButton.tsx` loses its demo styling and wires up to the voice machine.

### Database schema changes

None. Rate-limit counters in KV, not D1.

---

## Canonical test corpus

Fixtures live at `src/test-utils/voice-corpus.ts`. ≥20 phrases, split across:

- **English canonical (10):** "3 sets of 1 minute each, 30 seconds rest between each", "5 rounds of 45 seconds with 15 seconds rest", "Tabata — 8 rounds of 20 seconds, 10 seconds rest", "2 minutes work, 1 minute rest, 4 sets", etc.
- **Swedish canonical (5):** "Tre set om en minut vardera, trettio sekunders vila mellan varje", etc.
- **English paraphrase (3):** "give me three rounds at a minute with half a minute rest", "one minute on, thirty seconds off, three times", etc.
- **Swedish paraphrase (2):** similar shape.

Gate: parser ≥70% exact match; parser+Llama ≥95% exact match. Failures documented per-phrase in the PR.

---

## Testing strategy

### Unit tests

- `parse-session.test.ts` — corpus coverage, ambiguity handling, low-confidence return for off-grammar inputs.
- `voice/machine.test.ts` — every transition in the table. Error-state recoverability. Cancel during listening / thinking.
- `mic.test.ts` — recorder start/stop, format fallback, zero-byte detection, permission-denied path.
- `voice-client.test.ts` — network errors, 429 handling, language-mismatch response, success path.
- `llama.test.ts` — zod validation, retry-with-repair-example, clamp-and-flag for out-of-bounds, reject-and-retry for nonsense.
- `rate-limit.test.ts` — counter increments at check, resets at UTC day boundary, 429 after threshold, dev bypass honoured under the flag.

### Integration tests

- [ ] End-to-end with mocked Workers AI: mic blob → `/api/voice/parse` → Interpretation screen. Covers parser-hit path and Llama-fallback path.
- [ ] Rate-limit exhaustion returns the UI state, retryAfter is correct.
- [ ] Language-mismatch short-circuits before Llama.
- [ ] Configure route accepts `location.state.session` and renders pre-populated chips.

### Manual testing checklist

- [ ] iPhone (iOS Safari): say the English canonical phrase — parsed correctly, lands on Interpretation. Music from Spotify continues (Phase 2 regression check).
- [ ] iPhone: say the Swedish canonical phrase — parsed correctly.
- [ ] iPhone first-ever mic permission: first recording may be zero-byte; retry toast appears; second recording works.
- [ ] Android Chrome: English and Swedish canonical — both parse correctly.
- [ ] Desktop Chrome / Firefox: English canonical parses correctly.
- [ ] Speak in French (or any non-en/sv language): `language-mismatch` state appears, no Llama call made.
- [ ] Nonsense input ("banana kayak"): parse-error state appears with tap-through to Configure.
- [ ] Deny mic permission: single uniform `permission-denied` state + CTA to Configure.
- [ ] Airplane mode: mic button shows the `offline` state.
- [ ] Pre-Safari-14.5: `browser-unsupported` state.
- [ ] Hit the rate limit (4 calls): friendly limit message with retryAfter in hours, not "tomorrow".
- [ ] `wrangler dev`: bypass flag works; 10+ calls don't hit the limiter.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets (≥95% lines/functions/statements, ≥90% branches).
- [ ] Parser corpus ≥70% exact match; parser+Llama ≥95% exact match; documented in PR.
- [ ] Manual checklist completed on at least one iPhone + one Android.
- [ ] Lighthouse mobile ≥90 Performance / 100 Accessibility / 100 Best Practices.
- [ ] CSP still passes — Workers AI endpoints don't need new origins (same-origin `/api/voice/parse`).
- [ ] ADR written: "KV over native Rate Limiting for daily-cap semantics".

---

## PR workflow

**Branch:** `feature/phase-3-voice`
**PR title:** `Phase 3: Voice pipeline`

Use `/review-pr-team` — voice inference, prompt design, rate limiting, language handling, and privacy all warrant multi-perspective review.

---

## Edge cases and considerations

### Known risks

- **Whisper hallucinates on silent or <2s clips** ("Thanks for watching", Japanese subtitle strings). Defence: zod bounds + the parser's explicit grammar mean the client rejects these naturally.
- **Llama small-model quality variance.** Spike confirms model choice; zod + clamp-and-flag catches the rest.
- **KV race condition** lets 1–2 extra calls slip per IP under concurrent requests. Documented, accepted, revisit with Phase 4 auth.
- **iOS Safari first-recording zero-byte clip** — detected + friendly retry, no quota burn.
- **Dev iteration burning quota** — dev bypass flag; not deferred.
- **Latency variability** — Workers AI cold start can spike 2s target to 6s. UI doesn't time out.

### Performance considerations

- 8s recording cap keeps Whisper latency predictable (scales sub-linearly so 8s vs 4s is not 2× cost).
- Parser runs in <1ms; Llama only when needed.
- Log sampling (1-in-10 failure redacted-transcript capture) avoids log-storage bloat.

### Security considerations

- CORS: `/api/voice/parse` restricted to the app origin (production + `wrangler dev` localhost).
- No audio stored server-side after parsing; blob lives only in the request scope.
- Rate limit increments _before_ inference to cap Workers AI spend under adversarial load.
- IP addresses hashed (SHA-256, truncated) before logging.
- No raw transcripts logged outside the 1-in-10 redacted failure sample.
- `zod` schema + bounds + clamp-and-flag provides defence-in-depth against both Whisper hallucinations and Llama creativity.

### Accessibility considerations

- **Focus management** in the Voice overlay: focus moves to the overlay on open; Cancel button is autofocused on error states (matching Phase 2's pause-toast pattern); focus returns to the mic button on close.
- Overlay `role="dialog"` with `aria-labelledby` pointing to the current state's heading.
- `aria-live="polite"` on the transcript region — announced non-interruptively.
- Reduced-motion: pulse animation respects `prefers-reduced-motion: reduce` (already in Phase 2's CSS rule).
- Screen-reader user with no mic: the `permission-denied` state copy is read out and the Configure CTA is the first focusable element.
- Mic button has `aria-label` reflecting current rate-limit remaining ("Start voice input — 2 attempts left today").

---

## Technical debt introduced

- **TD-013:** Language _toggle_ UI not shipped in Phase 3. Pipeline handles both `en` and `sv`; UI toggle lands in Phase 5 Settings. Risk: Low. Resolution: Phase 5.
- **TD-003** (was anticipated, now active): IP-based rate limiter only. Authenticated-user tier arrives with Phase 4 auth. Risk: Low.
- **TD-014:** Silence detection / VAD deferred. Hard 8s cap + manual stop. Risk: Low. Resolution: Phase 5+ if user feedback warrants.
- **TD-015:** KV eventually-consistent race allows 1–2 extra calls per IP under concurrent requests. Accepted; revisit when Phase 4 authenticated tier changes the threat model. Risk: Low.

**Partially resolves:** TD-002 (English-only Whisper hint) — Phase 3 validates Swedish through the pipeline. Only the user-facing language _choice_ (Settings toggle) remains deferred to Phase 5.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 2 (archived)](./ARCHIVE/02-core-timer.md)
- [ADR — Reducer-plus-effects pattern](../REFERENCE/decisions/2026-04-19-reducer-plus-effects-pattern.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Technical debt](../REFERENCE/technical-debt.md)
- [Prototype parser (to be ported): voice.js](./prototype-design-files/voice.js)
- [Prototype Voice overlay: screens.jsx](./prototype-design-files/screens.jsx)
