# Phase 3: Voice pipeline

## Phase overview

**Phase number:** 3
**Phase name:** Voice pipeline — mic in, session out
**Estimated timeframe:** 4–6 days
**Dependencies:** Phase 2 (Core timer) complete.

**Brief description:**
Enable the mic button on Home. Capture audio in the browser, send it to a Worker that runs Whisper-turbo and a Llama model on Cloudflare Workers AI, and feed the parsed session into the existing Interpretation screen. Add anonymous rate limiting. English only — Swedish lands in phase 5.

---

## Scope and deliverables

### In scope

- [ ] Mic button on Home enabled. Tap opens the Voice overlay (ported from `screens.jsx`).
- [ ] Voice overlay: "Listening" state with pulse animation, "Thinking" state with dots, live transcript display, cancel button.
- [ ] Mic capture: `getUserMedia({ audio: true })`, record a short clip (~8s max) to a blob, stop on silence detection or manual tap.
- [ ] `/api/voice/parse` endpoint on the Worker:
  - Accepts an audio blob.
  - Calls `@cf/openai/whisper-large-v3-turbo` for transcription (language hint: `en`).
  - Passes the transcript to a Workers AI Llama model with a system prompt that returns strict JSON: `{ sets: number, workSec: number, restSec: number, name?: string | null }`.
  - Returns the structured session plus the raw transcript to the client.
- [ ] Anonymous rate limit: 3 successful voice calls per IP per day. Stored in Cloudflare KV or D1 (decide at phase start — KV is likely cheaper). Friendly `429` response with a `retryAfter` field.
- [ ] Rate-limit UI state: a calm message ("You've used today's voice demos. Tap *Configure* to build a session manually.") with a tap-through to the manual flow.
- [ ] Interpretation screen receives the parsed session and displays it for editing, same as phase 2's manual path.
- [ ] Failure states, all calm and helpful:
  - Mic permission denied.
  - Mic permission revoked mid-session.
  - Offline (no network to reach `/api/voice/parse`).
  - Whisper fails or returns empty transcript.
  - Llama returns unparseable output (retry once, then fall back to "Couldn't understand — try again or configure manually").
- [ ] Observability: log (structured) parse latency, transcript length, parse success/failure, rate-limit hits. No raw transcripts logged beyond what's needed to debug a failure (and even then, consider redaction).

### Out of scope

- Swedish voice input (language hint is `en` this phase).
- Voice "save as preset" (needs presets, phase 4).
- Voice during a running session.
- Authenticated-user rate-limit tier (anon only this phase).
- Fallback to browser `SpeechRecognition` API.

### Acceptance criteria

- [ ] Saying *"Three sets of one minute each, thirty seconds rest in between"* from a real phone produces a correct session on Interpretation within ~2 seconds end-to-end on a decent connection.
- [ ] Saying something nonsensical ("banana kayak") lands a graceful failure UI, not a crash.
- [ ] Rate limit is enforced: the fourth call in a day from the same IP returns `429` and the UI shows the friendly limit-reached state.
- [ ] Mic permission denial shows a helpful message with a tap-through to manual configuration.
- [ ] The mic button is visibly disabled (or shows an offline hint) when the device reports offline.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**Two-step inference, both on Workers AI**
- Whisper-turbo handles transcription.
- A Llama model (exact model picked during the phase — target the smallest that parses reliably, e.g. `@cf/meta/llama-3.2-3b-instruct` or similar) handles intent extraction via a strict JSON system prompt.
- Rationale: keeps the whole pipeline on-platform, no external API keys, bounded cost, easy to trace.

**Llama system prompt returns strict JSON; we validate on the Worker**
- Choice: schema-validate the model response with `zod` on the Worker. If validation fails, retry once with a stricter prompt; on second failure, return a structured error to the client.
- Rationale: LLM output is unreliable without a validator; the client should never see malformed JSON.

**Rate limit keyed on IP, stored in KV**
- Choice: `rateLimit:anon:{ip}:{YYYY-MM-DD}` → counter in KV with 26-hour TTL.
- Rationale: cheap, TTL-driven cleanup is free.
- Considerations: IP boundaries are imperfect (NAT). The authenticated-user tier in phase 4 is the real fix. 3/day is low enough that NAT collisions will be occasional, not systemic.

### Technology choices

- **`@cf/openai/whisper-large-v3-turbo`** — transcription model.
- **Workers AI Llama model** — intent parser. Exact model confirmed at phase start after a small latency/quality bake-off on the canonical phrases.
- **`zod`** — runtime validation of the Llama response.
- **Web Audio `MediaRecorder`** — browser-side recording; output as `audio/webm;codecs=opus` or `audio/wav` (whichever Whisper accepts fastest).

### Key files and components

```
src/
├── components/
│   ├── VoiceOverlay.tsx
│   └── MicButton.tsx           # enabled this phase
├── lib/
│   ├── mic.ts                  # getUserMedia + MediaRecorder wrapper
│   ├── mic.test.ts
│   ├── voice-client.ts         # calls /api/voice/parse, handles errors
│   └── rate-limit-ui.ts
worker/
├── api/
│   ├── voice/
│   │   ├── parse.ts            # the endpoint
│   │   ├── whisper.ts          # wraps Workers AI Whisper call
│   │   ├── interpret.ts        # wraps Workers AI Llama call + zod schema
│   │   └── parse.test.ts
│   └── rate-limit.ts           # KV-backed limiter
└── prompts/
    └── interpret-session.md    # system prompt, version-controlled
```

### Database schema changes

None directly. Rate-limit counters in KV, not D1.

---

## Testing strategy

### Unit tests

- `mic.test.ts` — recorder start/stop, silence detection, permission denied path.
- `interpret.test.ts` — given a Llama response, zod validates it; malformed responses trigger retry then error.
- `rate-limit.test.ts` — counter increments, resets at day boundary, 429 after threshold.
- `voice-client.test.ts` — network errors, 429 handling, success path.

### Integration tests

- [ ] End-to-end with mocked Workers AI: mic blob → /api/voice/parse → Interpretation screen.
- [ ] Rate-limit exhaustion returns the UI state.

### Manual testing checklist

- [ ] Real device: say the canonical phrase — session parsed correctly.
- [ ] Real device: say a paraphrase ("Give me 5 rounds, 45 seconds on, 15 off") — parsed correctly.
- [ ] Real device: nonsense input — graceful failure.
- [ ] Deny mic permission in the browser — friendly UI, manual path works.
- [ ] Disable network after opening the overlay — error handled.
- [ ] Hit the rate limit (four calls in a day) — limit UI shown.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] Prompt tested against at least 10 canonical phrases (documented in PR).
- [ ] No raw transcripts persisted beyond a diagnostic log sampling window.

---

## PR workflow

**Branch:** `feature/phase-3-voice`
**PR title:** `Phase 3: Voice pipeline`

Use `/review-pr-team` — voice inference, prompt design, rate limiting, and privacy implications warrant multi-perspective review.

---

## Edge cases and considerations

### Known risks

- **Llama parsing quality.** Small models sometimes get creative. Mitigations: strict JSON schema, `zod` validation, one retry with stricter prompt, bake-off at phase start to pick the right model.
- **Latency variability.** Workers AI cold-start or model queueing can spike latency above 2s. Mitigation: friendly "Thinking" state, no spinner timeout in the client.
- **Audio format compatibility.** MediaRecorder defaults vary across browsers. Confirm Whisper's accepted formats at phase start; fall back to `audio/wav` if needed.
- **NAT shared-IP rate-limit collisions.** Acceptable at 3/day; phase 4 adds the authenticated-user tier.

### Performance considerations

- Compress audio before upload (MediaRecorder defaults usually suffice).
- Cap recording at 8 seconds to keep Whisper latency predictable.

### Security considerations

- CORS: `/api/voice/parse` restricted to the app origin.
- No audio stored on the server after parsing; blob lives only in the request scope.
- Rate limit before inference to prevent abuse of Workers AI neurons.

### Accessibility considerations

- Voice overlay has a visible cancel and a clearly labelled "Listening" / "Thinking" status with `aria-live="polite"`.
- Mic button is keyboard-focusable and has a clear `aria-label`.

---

## Technical debt introduced

- **TD-002: Hard-coded English language hint for Whisper.** Swedish arrives in phase 5. Risk: Low.
- **TD-003: IP-based rate limiter only.** Authenticated tier added in phase 4. Risk: Low.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 2](./02-core-timer.md)
- [Phase 4 — auth & presets](./04-accounts-and-presets.md)
- [Prototype: voice.js](./prototype-design-files/voice.js)
- [Prototype: screens.jsx — VoiceOverlay](./prototype-design-files/screens.jsx)
