# Phase 3: Voice pipeline

## Phase overview

**Phase number:** 3
**Phase name:** Voice pipeline — mic in, session out
**Estimated timeframe:** 4–6 days (architecture validated by the Phase 3 spike; what remains is the real UI surface, rate limiter, and Configure handoff).
**Dependencies:** Phase 1 (Foundation), Phase 1.5 (hygiene), Phase 2 (Core timer) complete. Spike complete (see [Spike outcome](#spike-outcome)).

**Brief description:**
Enable the mic button on Home. Capture audio in the browser, stream it to a Worker that runs Whisper-turbo on Cloudflare Workers AI, pass the transcript to a Llama model that returns a structured session as strict JSON, stream both events back to the client as NDJSON so the user sees their transcript the moment Whisper finishes — then the parsed session a beat later. Feed the session into the existing Interpretation screen. Both English and Swedish validated in Phase 3; the language _toggle_ UI lands with Phase 5 Settings.

**Revised 2026-04-19** (second pass) after the half-day spike. Material changes from the previous revision: the deterministic parser is **removed**; Llama is the single parse path (was fallback). The Worker response is **NDJSON-streamed** — first event is the Whisper transcript + detected language, second is the Llama-parsed session or a structured error (was single JSON blob). The language gate accepts Nordic cousins (`en`, `sv`, `is`, `no`, `nn`, `nb`, `da`) — Whisper routinely misclassifies Nordic speech as Icelandic and Llama handles the spelling variance fine. All other architecture (reducer-plus-effects overlay, Voice → Configure handoff, UTC-day rate limit, dev bypass, zod bounds) carries forward unchanged.

---

## Scope and deliverables

### In scope

- [ ] Mic button on Home enabled. Tap opens the Voice overlay (**tap-to-start + tap-to-stop**, overriding the prototype's hold-to-talk — hold-to-talk has motor-impairment a11y issues and conflicts with iOS gestures).
- [ ] Voice overlay ported from `screens.jsx`, implemented as a **reducer-plus-effects machine** (`src/lib/voice/machine.ts`) per [ADR 2026-04-19 — Reducer-plus-effects pattern](../REFERENCE/decisions/2026-04-19-reducer-plus-effects-pattern.md). States: `{ idle, requesting-permission, listening, uploading, transcribing, parsing, rate-limited, language-mismatch, parse-error, offline, permission-denied, browser-unsupported }`. The `transcribing` → `parsing` split reflects the NDJSON stream — the overlay shows the transcript on the first event and replaces it with the session chip-preview on the second. Events: `{ micTap, permissionGranted, permissionDenied, recordingStopped, uploadStarted, transcriptReceived, parseSuccess, parseFailed, rateLimitHit, cancel, retry }`. Full transition table in the [Voice overlay state machine](#voice-overlay-state-machine) section below.
- [ ] Mic capture via `getUserMedia({ audio: true })` + `MediaRecorder`. **Hard 8-second cap with manual stop.** No silence detection in this phase — VAD/energy-threshold stopping is deferred; 8s is generous headroom for canonical phrases (typically 2–4s) and silence detection is a tuning-ops burden we don't need yet.
- [ ] iOS: set `navigator.audioSession.type = 'play-and-record'` _before_ `getUserMedia`. Phase 2 sets `'ambient'` for music coexistence; that category blocks capture and throws `InvalidStateError`. Restore `'ambient'` when the overlay closes so Spotify etc. continues playing.
- [ ] Audio format: use whatever `MediaRecorder.isTypeSupported()` reports as supported in priority order `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg`. Whisper infers the container from the magic bytes; we don't declare the MIME server-side. No `audio/wav` fallback (cannot be produced from `MediaRecorder` on Safari). Pre-Safari-14.5 (no `MediaRecorder` at all) gets the `browser-unsupported` state.
- [ ] iOS Safari reality: the first `MediaRecorder.stop()` after a fresh permission grant can yield a zero-byte blob. Mitigation: detect zero-length blob, show a friendly "let's try that again" state that short-circuits to a second recording without counting against rate limit (the call never reached the Worker).
- [ ] `/api/voice/parse` endpoint on the Worker — **NDJSON streaming**:
  - Accepts an audio blob (raw bytes, no MIME declaration).
  - Base64-encodes the audio before calling `@cf/openai/whisper-large-v3-turbo` (Workers AI accepts `string` for the `audio` field; raw `Uint8Array` fails with type errors on some runtime paths — validated in the spike).
  - **No language hint** in Phase 3 — Whisper auto-detects so the language gate works. Phase 5 Settings will add a `language: 'en' | 'sv'` hint which stops the Icelandic misclassification on iOS (see [Known risks](#known-risks)).
  - First stream event: `{"kind":"whisper", transcript, language, whisperMs}` — emitted the moment Whisper returns.
  - Language gate runs after Whisper: if `language` is not in `{en, sv, is, no, nn, nb, da}`, emit `{"kind":"error","reason":"language-unsupported"}` and close the stream (no Llama call, no quota burn beyond the rate-limit check that already happened). Nordic cousins are included because Whisper frequently labels Swedish speech as Icelandic under iOS Safari audio encoding; Llama handles the spelling variance.
  - Otherwise, pass the transcript to `@cf/meta/llama-3.2-3b-instruct` with a system prompt that demands strict JSON: `{ sets: 1–99, workSec: 5–3600, restSec: 0–3600 }` or `{ error: "not-a-session" }`. Prompt includes a small set of English and Swedish few-shot examples (canonical phrases + "half a minute" / "fyrtiofem" compound numerals). No `name` field (stripped from Phase 3 schema; returns in Phase 4 with presets).
  - Second stream event: `{"kind":"parsed", session, llamaMs, totalMs, rawOutput}` on success, or `{"kind":"error", reason, message?, totalMs}` on failure (`not-a-session`, `schema-failed`, `llama-error`, `empty-transcript`).
  - Response `Content-Type: application/x-ndjson; charset=utf-8`. Status 200 for the happy path and language-gate rejections (error event in body); 400 for upload-empty; 405 for non-POST.
- [ ] **Voice → Configure handoff** wires into the existing `Configure` route. Voice navigates to `/configure` with `location.state.session` pre-populated; the user reviews and edits before tapping Start. Requires a targeted refactor of `src/routes/Configure.tsx` to accept `location.state.session` when present (mirrors the existing `/run` pattern in `Home.tsx`). This is in-scope Phase 3 work, not "free".
- [ ] Anonymous rate limit: 3 voice calls per IP per **UTC day**. Stored in Cloudflare KV. Increment happens **at the rate-limit check, before inference** — so cancelled uploads and failed parses consume quota (honest UX, caps Workers AI spend). 429 response includes `retryAfter` = seconds until next UTC midnight. Served as a single-event NDJSON stream: `{"kind":"error","reason":"rate-limited","retryAfterSec":N}`.
- [ ] Rate-limit UI copy avoids "tomorrow" (wrong under UTC + shared-IP scenarios). Uses "You've used today's voice allowance. Tap _Configure_ to build a session manually." The mic button's aria-label reflects the remaining count where possible.
- [ ] **Dev rate-limit bypass** lands with the limiter, not as a hotfix. When the Worker is running via `wrangler dev` OR an `ALLOW_RATE_LIMIT_BYPASS` env var is set, the limiter is skipped. Production never has this flag set.
- [ ] Llama output bounds: `sets` 1–99, `workSec` 5–3600, `restSec` 0–3600 (exactly matching `Interpretation.tsx` Stepper constraints). Enforced by a zod schema. On schema-failed output, retry once with **temperature 0.3 (bumped from 0) AND a one-shot repair example** showing the bad output and the correct shape. Not "stricter prompt" — at temp 0 that's a no-op. On second failure, emit `schema-failed` error and the client falls through to the Interpretation screen with defaults.
- [ ] Interpretation screen receives the parsed session via `location.state` and displays it for editing, same as the Phase 2 manual path. No new Interpretation UI.
- [ ] Failure states (all calm, all with a CTA to manual Configure):
  - Permission denied (first-time or cached — same copy, same CTA; no instructions to navigate browser settings).
  - Permission revoked mid-recording.
  - Offline — mic button disabled with a friendly hint.
  - Empty/zero-byte recording (iOS first-grab) — prompt to retry, don't charge quota.
  - Whisper returns empty transcript — prompt to retry, do charge quota (the call happened).
  - Language unsupported (detected language not in the Nordic-cousins set) — `language-mismatch` state.
  - Llama returns `not-a-session` (nonsense input) — `parse-error` state, CTA to Configure.
  - Llama schema-failed after retry — `parse-error` state.
  - Browser doesn't support MediaRecorder (pre-Safari-14.5 etc) — `browser-unsupported` state.
- [ ] Observability: structured logs per call — Whisper latency, Llama latency, total latency, transcript length, language detected, outcome (parsed / not-a-session / schema-failed / language-unsupported / rate-limited). **No raw transcripts in logs under normal operation.** On parse failure, sample (1 in 10) a redacted transcript (digits + top-50 common words; everything else hashed) into a failure log with a 14-day retention window. IP addresses are hashed before logging.
- [ ] ADR on **KV for daily-cap rate limiting vs Cloudflare's native Rate Limiting binding**. KV wins for Phase 3 (token-bucket semantics of the native binding don't cleanly express "3 per UTC day"). Race-condition acceptance (KV is eventually consistent; up to single-digit extra calls may slip on concurrent requests) documented in the ADR.

### Out of scope

- Voice "save as preset" — needs presets, Phase 4.
- Voice control during a running session (pause, skip, etc).
- Authenticated-user rate-limit tier — Phase 4.
- Browser `SpeechRecognition` API as an alternative transport — **explicitly rejected**: audio would route to Google/Apple, breaking Takt's privacy posture.
- Language _toggle_ UI in Settings — Phase 5. (Pipeline works for both languages in Phase 3; the user doesn't choose. Knock-on: iOS Swedish accuracy is limited until Phase 5 passes the hint to Whisper — see TD-016.)
- Silence detection / VAD — Phase 5 polish only if user complaints surface.
- Keeping `/spike` in production — removed when Phase 3 proper ships.

### Acceptance criteria

- [ ] Saying _"Three sets of one minute each, thirty seconds rest in between"_ from a real phone produces a correct session on Interpretation within ~2 seconds end-to-end on a decent connection (typical case; cold start up to 6s is acceptable and the UI doesn't time out).
- [ ] Saying the Swedish equivalent _"Tre set om en minut vardera, trettio sekunders vila mellan varje"_ from a real phone also produces a correct session. (iOS may wobble under Icelandic misclassification — see TD-016; Android is rock solid.)
- [ ] The overlay shows the transcript within ~1.2s on warm Whisper (spike median: Android 1.1s / iOS 1.3s) and the parsed session within ~1.6s total (spike median: Android 1.5s / iOS 1.7s). Cold-start Whisper raises these to ~3–6s once per idle worker.
- [ ] Saying something nonsensical ("banana kayak") lands a graceful failure UI, not a crash.
- [ ] Speaking in a non-Nordic language (French, German, Mandarin etc.) lands on the `language-mismatch` state with the documented copy. No Llama call is made.
- [ ] Rate limit enforced: the fourth call in a UTC day from the same IP returns 429 with the friendly limit-reached state; `retryAfter` reflects seconds until next UTC midnight.
- [ ] Mic permission denial shows a single uniform message (no telling users to navigate browser settings) with a tap-through to `/configure`.
- [ ] The mic button is disabled with a friendly hint when the device reports offline.
- [ ] Pre-Safari-14.5 (no MediaRecorder) shows the `browser-unsupported` overlay.
- [ ] iOS audio-session category switches from `'ambient'` → `'play-and-record'` → `'ambient'` across the overlay lifecycle; Spotify playback resumes after the overlay closes.
- [ ] Dev rate-limit bypass works under `wrangler dev`; does not work in production build.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**Llama-primary with NDJSON streaming**

- Choice: a single Llama call does all transcript → session parsing. The Worker streams the response as NDJSON — Whisper event first, Llama event second — so the client can show the transcript within ~1s of upload and update to the session within another ~300–500ms.
- Rationale: the spike validated that Whisper + Llama together handle the real phrasing distribution (paraphrases, word numerals, Swedish conjugations, Whisper transcription variance like `set` → `sätt` or `tio` → `tíu`) without custom per-phrase rules. A deterministic parser was rejected after the spike showed it required hand-crafting for each Whisper artefact — exactly the edge-case chasing the product vision is trying to avoid. Streaming the transcript first turns a 1.5s silent wait into a 1.1s "I can read what I said" — large perceived-latency win at zero cost.
- Alternatives considered:
  - _Parser-first with Llama fallback_ (previous revision): killed by the spike. Whisper transcription variance (spellings like "sätt", "sekundar", "fyrtífem") broke the deterministic parser and any fix reintroduced per-phrase rules.
  - _Single-blob response_ (pre-spike): rejected — adds ~400–800ms of perceived wait with no upside.
  - _Llama-only no streaming_ (original spec): architecturally identical but worse UX than streaming.
  - _Native `SpeechRecognition` API_: rejected — privacy posture.

**Language gate accepts Nordic cousins**

- Choice: accept `en`, `sv`, `is`, `no`, `nn`, `nb`, `da` through the gate. Genuine French / German / etc. still blocked.
- Rationale: Whisper routinely mislabels Swedish as Icelandic on iOS audio encoding (observed on the spike — "Åtta omgångar" → detected as `is`, spelled "Ótta omgångar"). The gate is a cost control, not a correctness filter; letting Nordic cousins through costs one Llama call per misclassified phrase and saves false rejections. Phase 5 fixes the root cause by passing a `language: 'sv'` hint to Whisper when the user has picked Swedish in Settings.

**KV for daily-cap rate limiting**

- Choice: Cloudflare KV namespace `RATE_LIMITS`, key shape `ratelimit:anon:{ipHash}:{YYYY-MM-DD-UTC}`, value a counter, TTL 26 hours.
- Alternatives: Cloudflare native Rate Limiting binding (token-bucket — awkward for daily cap), Durable Object per IP (overkill for 3/day), D1 (not wired until Phase 4).
- Trade-off accepted: KV read-then-write is racy; under concurrent requests up to ~2 extra calls may slip per IP. Bounded impact, documented in ADR.

**Voice overlay as a reducer-plus-effects machine**

- Choice: same shape as the Phase 2 timer machine — pure reducer, effects as data, React hook runs them.
- Rationale: ADR 2026-04-19 established this pattern project-wide. Overlay lifecycle is complex (permission × recording × network × stream × rate-limit states); a reducer gives us the same testability + explicit-ordering benefits the timer machine got.

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
  | { phase: 'transcribing' } // request sent, waiting for first NDJSON line
  | { phase: 'parsing'; transcript: string; language: string } // whisper event received, waiting for parsed
  | { phase: 'rate-limited'; retryAfterSec: number }
  | { phase: 'language-mismatch'; detected: string }
  | { phase: 'parse-error'; reason: string; transcript?: string }
  | { phase: 'offline' }
  | { phase: 'permission-denied' }
  | { phase: 'browser-unsupported' };
```

**Transition table (abbreviated — full table lives in implementation):**

| From                    | Event                         | To                                  | Side effects                                                                   |
| ----------------------- | ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `idle`                  | `micTap` (online, supported)  | `requesting-permission`             | `setAudioCategory('play-and-record')`, `requestMic()`                          |
| `idle`                  | `micTap` (offline)            | `offline`                           | —                                                                              |
| `idle`                  | `micTap` (!supported)         | `browser-unsupported`               | —                                                                              |
| `requesting-permission` | `permissionGranted`           | `listening`, startedAtMs=now        | `startRecording()`, `schedule8sCap`                                            |
| `requesting-permission` | `permissionDenied`            | `permission-denied`                 | `setAudioCategory('ambient')`                                                  |
| `listening`             | `stop` OR `cap`               | `uploading`, blob=result            | `stopRecording()`                                                              |
| `listening`             | `cancel`                      | `idle`                              | `stopRecording()`, `discardBlob()`, `setAudioCategory('ambient')`              |
| `uploading`             | `blobEmpty` (iOS first-grab)  | `idle`                              | `showRetryToast()`, `setAudioCategory('ambient')`                              |
| `uploading`             | `upload`                      | `transcribing`                      | `POST /api/voice/parse` (stream)                                               |
| `transcribing`          | `transcriptReceived(t, lang)` | `parsing`, transcript=t, lang       | — (UI shows transcript)                                                        |
| `transcribing`          | `parseError(reason)`          | `parse-error` / `language-mismatch` | error-specific                                                                 |
| `parsing`               | `parseSuccess(session)`       | `idle`                              | `navigate('/configure', { state: { session }})`, `setAudioCategory('ambient')` |
| `parsing`               | `parseError(reason)`          | `parse-error`                       | —                                                                              |
| any error state         | `cancel` or `retry`           | `idle`                              | `setAudioCategory('ambient')`                                                  |

**Effects:** `setAudioCategory`, `requestMic`, `startRecording`, `stopRecording`, `discardBlob`, `showRetryToast`, `POST` (stream-reading), `navigate`, `schedule8sCap`.

The reducer is pure and fully unit-testable without a browser. The hook in `useVoiceMachine.ts` translates browser events (including the per-NDJSON-line stream events) into reducer events and runs effects.

### Technology choices

- **`@cf/openai/whisper-large-v3-turbo`** — transcription model. Input is base64-encoded audio (validated in spike).
- **`@cf/meta/llama-3.2-3b-instruct`** — parse model. Temperature 0 for first call, 0.3 for retry with one-shot repair example. Max tokens 128. Spike median latency: 176–495ms.
- **`zod`** — runtime validation of the Llama response. Confirmed in spike (~12 KB gzipped in the Worker bundle; acceptable).
- **`MediaRecorder`** — browser-side recording; format auto-selected via `isTypeSupported()`.
- **`TransformStream` / `ReadableStream`** — Worker-side NDJSON streaming.
- **`navigator.audioSession`** — iOS Safari only; toggled between `'ambient'` and `'play-and-record'` across the overlay lifecycle.
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
│   │   ├── stream.ts                 # NDJSON line reader over Response.body
│   │   ├── stream.test.ts
│   │   └── types.ts
│   ├── mic.ts                        # getUserMedia + MediaRecorder wrapper
│   ├── mic.test.ts
│   └── voice-client.ts               # POST /api/voice/parse, error shapes, stream consumption
worker/
├── api/
│   ├── voice/
│   │   ├── parse.ts                  # NDJSON streaming endpoint
│   │   ├── parse.test.ts
│   │   ├── whisper.ts                # wraps env.AI.run(whisper), handles base64
│   │   ├── whisper.test.ts
│   │   ├── llama.ts                  # wraps env.AI.run(llama) + zod + retry
│   │   ├── llama.test.ts
│   │   └── rate-limit.ts             # KV-backed limiter + dev bypass
```

`Configure.tsx` gets a targeted edit to accept `location.state.session` as initial value. Home's `MicButton.tsx` loses its demo styling and wires up to the voice machine. `src/routes/Spike.tsx` is removed when Phase 3 proper ships.

### Database schema changes

None. Rate-limit counters in KV, not D1.

---

## Spike outcome

A half-day spike (merged on the Phase 3 branch, PR TBD) validated the architecture on real hardware:

- **Accuracy:** 12/12 canonical + paraphrase phrases parsed correctly on Android (Chrome). 9/9 gated-through phrases parsed correctly on iOS (Safari). Swedish paraphrase on iOS wobbles under Icelandic misclassification (2 of 4 phrases parsed wrong numerics because Llama got Icelandic-phonology word-numerals that weren't in its prompt's Swedish numeral table). English rock-solid on both platforms.
- **Latency (median, warm):** time-to-transcript ~1.1s (Android) / ~1.3s (iOS); time-to-session ~1.5s (Android) / ~1.7s (iOS). Cold-start Whisper spike: ~3s. Llama: 176–495ms.
- **Gates:** language-unsupported correctly blocks French/German etc. `not-a-session` correctly rejects nonsense. iOS AudioSession category toggle prevents getUserMedia from throwing under Phase 2's `'ambient'` default.
- **The pivot:** initial spike was parser-first per the previous spec revision. Real-world Whisper transcripts revealed per-phrase variance (`set` → `sätt`, `tio` → `tíu`, compound numerals) that required hand-crafted fixes to the parser. Killed the parser approach; switched to Llama-primary mid-spike. Llama handled every phrase the parser had choked on.

Artefacts: `/spike` route in the app (removed at Phase 3 proper merge), `worker/api/voice/parse.ts` (already NDJSON-streaming), `worker/api/voice/llama.ts` (zod + retry), `worker/api/voice/whisper.ts` (base64 + latency capture), `worker/api/voice/parse.test.ts` (13 unit tests).

---

## Canonical test corpus

A set of ~20 phrases documented in-repo for regression testing the Llama prompt. Split across:

- **English canonical (10):** "3 sets of 1 minute each, 30 seconds rest between each", "5 rounds of 45 seconds with 15 seconds rest", "8 rounds of 20 seconds, 10 seconds rest", "2 minutes work, 1 minute rest, 4 sets", etc.
- **Swedish canonical (5):** "Tre set om en minut vardera, trettio sekunders vila mellan varje", "Åtta omgångar om tjugo sekunder, tio sekunder vila", etc.
- **English paraphrase (3):** "give me three rounds at a minute with half a minute rest", "one minute on, thirty seconds off, three times", etc.
- **Swedish paraphrase (2):** "Ge mig tre omgångar på en minut med trettio sekunders paus", etc.

Gate: ≥90% exact match through the Llama prompt on the full corpus (mocked Whisper input). Failures documented per-phrase in the PR. Real-device accuracy is tracked via the manual checklist, not as an automated gate (Whisper variance makes it noisy).

---

## Testing strategy

### Unit tests

- `voice/machine.test.ts` — every transition in the table, including the `transcribing → parsing` split. Error-state recoverability. Cancel during listening / transcribing / parsing.
- `voice/stream.test.ts` — NDJSON line reader: single-line, multi-line-per-chunk, chunk-boundary-in-middle-of-line, trailing line with no newline, malformed JSON, empty body.
- `mic.test.ts` — recorder start/stop, format fallback, zero-byte detection, permission-denied path, iOS audioSession category toggling.
- `voice-client.test.ts` — stream consumption end-to-end, network errors, 429 handling, language-mismatch stream event, success path.
- `llama.test.ts` — zod validation, retry-with-repair-example at bumped temperature, schema-failed after two tries, not-a-session pass-through, model-error handling.
- `parse.test.ts` (extant, 13 tests) — streaming order, language gate (including Nordic-cousins acceptance), upload-empty, method-not-allowed, retry recovery, whisper-error, llama-error.
- `rate-limit.test.ts` — counter increments at check, resets at UTC day boundary, 429 after threshold, dev bypass honoured under the flag.

### Integration tests

- [ ] End-to-end with mocked Workers AI: mic blob → `/api/voice/parse` → Interpretation screen, reading the NDJSON stream.
- [ ] Rate-limit exhaustion returns the UI state, retryAfter is correct.
- [ ] Language-mismatch short-circuits before Llama.
- [ ] Configure route accepts `location.state.session` and renders pre-populated chips.

### Manual testing checklist

- [ ] iPhone (iOS Safari): say the English canonical phrase — parsed correctly, lands on Interpretation. Music from Spotify continues after the overlay closes (Phase 2 regression check).
- [ ] iPhone: say the Swedish canonical phrase — parsed correctly (or falls through to Interpretation where the user can fix the numbers; acceptable until Phase 5 language hint lands, TD-016).
- [ ] iPhone first-ever mic permission: first recording may be zero-byte; retry toast appears; second recording works.
- [ ] Android Chrome: English and Swedish canonical — both parse correctly.
- [ ] Desktop Chrome / Firefox: English canonical parses correctly.
- [ ] Speak in French (or any non-Nordic language): `language-mismatch` state appears, no Llama call made.
- [ ] Nonsense input ("banana kayak"): parse-error state appears with tap-through to Configure.
- [ ] Deny mic permission: single uniform `permission-denied` state + CTA to Configure.
- [ ] Airplane mode: mic button shows the `offline` state.
- [ ] Pre-Safari-14.5: `browser-unsupported` state.
- [ ] Hit the rate limit (4 calls): friendly limit message with retryAfter in hours, not "tomorrow".
- [ ] `wrangler dev`: bypass flag works; 10+ calls don't hit the limiter.
- [ ] Transcript is visibly rendered before the parsed session (streaming UX check) — watch for the two-step update.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets (≥95% lines/functions/statements, ≥90% branches).
- [ ] Llama prompt corpus ≥90% exact match on mocked-Whisper inputs; documented in PR.
- [ ] Manual checklist completed on at least one iPhone + one Android.
- [ ] Lighthouse mobile ≥90 Performance / 100 Accessibility / 100 Best Practices.
- [ ] CSP still passes — Workers AI endpoints don't need new origins (same-origin `/api/voice/parse`).
- [ ] ADR written: "KV over native Rate Limiting for daily-cap semantics".
- [ ] `/spike` route removed from production build.

---

## PR workflow

**Branch:** `feature/phase-3-voice` (reused from the spike).
**PR title:** `Phase 3: Voice pipeline`

Use `/review-pr-team` — voice inference, prompt design, rate limiting, language handling, and privacy all warrant multi-perspective review.

---

## Edge cases and considerations

### Known risks

- **Whisper hallucinates on silent or <2s clips** ("Thanks for watching", Japanese subtitle strings). Defence: zod bounds + Llama's `not-a-session` escape hatch mean the client rejects these naturally.
- **iOS Whisper routes Swedish speech through Icelandic phonology** (observed in spike — "åtta" → "ótta", "sekunder" → "sekundar", "tio" → "tíu"). Llama doesn't recognise the Icelandic spellings and hallucinates numbers. Mitigation: the Interpretation screen is the safety net — user sees wrong numbers, fixes them, moves on. Real fix is Phase 5's language hint to Whisper. Tracked as TD-016.
- **Llama small-model quality variance** on off-distribution phrasings. Mitigated by zod + retry-with-repair + the Interpretation safety net.
- **KV race condition** lets 1–2 extra calls slip per IP under concurrent requests. Documented, accepted, revisit with Phase 4 auth.
- **iOS Safari first-recording zero-byte clip** — detected + friendly retry, no quota burn.
- **iOS AudioSession category leak** — if the overlay closes mid-flight without restoring `'ambient'`, Spotify stops. Covered by the state machine's `setAudioCategory('ambient')` side-effect on every exit.
- **Dev iteration burning quota** — dev bypass flag; not deferred.
- **Latency variability** — Workers AI cold start can spike 2s target to 6s. UI doesn't time out.

### Performance considerations

- 8s recording cap keeps Whisper latency predictable (scales sub-linearly so 8s vs 4s is not 2× cost).
- Streaming the Whisper event first turns the ~300–500ms Llama window into perceived-responsive UX rather than a silent wait.
- Log sampling (1-in-10 failure redacted-transcript capture) avoids log-storage bloat.

### Security considerations

- CORS: `/api/voice/parse` restricted to the app origin (production + `wrangler dev` localhost).
- No audio stored server-side after parsing; blob lives only in the request scope.
- Rate limit increments _before_ inference to cap Workers AI spend under adversarial load.
- IP addresses hashed (SHA-256, truncated) before logging.
- No raw transcripts logged outside the 1-in-10 redacted failure sample.
- `zod` schema + bounds + retry provides defence-in-depth against Llama creativity.

### Accessibility considerations

- **Focus management** in the Voice overlay: focus moves to the overlay on open; Cancel button is autofocused on error states (matching Phase 2's pause-toast pattern); focus returns to the mic button on close.
- Overlay `role="dialog"` with `aria-labelledby` pointing to the current state's heading.
- `aria-live="polite"` on the transcript region — announced non-interruptively. The two-step update (transcript first, session second) reads naturally to screen-reader users.
- Reduced-motion: pulse animation respects `prefers-reduced-motion: reduce` (already in Phase 2's CSS rule).
- Screen-reader user with no mic: the `permission-denied` state copy is read out and the Configure CTA is the first focusable element.
- Mic button has `aria-label` reflecting current rate-limit remaining ("Start voice input — 2 attempts left today").

---

## Technical debt introduced

- **TD-013:** Language _toggle_ UI not shipped in Phase 3. Pipeline handles `en` / `sv` / Nordic cousins; UI toggle lands in Phase 5 Settings. Risk: Low. Resolution: Phase 5.
- **TD-003** (was anticipated, now active): IP-based rate limiter only. Authenticated-user tier arrives with Phase 4 auth. Risk: Low.
- **TD-014:** Silence detection / VAD deferred. Hard 8s cap + manual stop. Risk: Low. Resolution: Phase 5+ if user feedback warrants.
- **TD-015:** KV eventually-consistent race allows 1–2 extra calls per IP under concurrent requests. Accepted; revisit when Phase 4 authenticated tier changes the threat model. Risk: Low.
- **TD-016:** iOS Whisper misclassifies Swedish as Icelandic under iOS Safari audio encoding, degrading Swedish parse accuracy on iPhone. Root cause: no `language` hint passed to Whisper. Resolution: Phase 5 passes `language: 'sv'` when the user has selected Swedish in Settings. Interpretation screen is the interim safety net. Risk: Low.

**Partially resolves:** TD-002 (English-only Whisper hint) — Phase 3 validates Swedish through the pipeline. Only the user-facing language _choice_ (Settings toggle) remains deferred to Phase 5.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 2 (archived)](./ARCHIVE/02-core-timer.md)
- [ADR — Reducer-plus-effects pattern](../REFERENCE/decisions/2026-04-19-reducer-plus-effects-pattern.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Technical debt](../REFERENCE/technical-debt.md)
- [Prototype Voice overlay: screens.jsx](./prototype-design-files/screens.jsx)
