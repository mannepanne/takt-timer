# ADR: Llama-primary voice pipeline with NDJSON-streaming response

**Date:** 2026-04-20
**Status:** Active

---

## Decision

The Phase 3 voice pipeline parses speech to a structured session using a single call to a Workers AI Llama model (`@cf/meta/llama-3.2-3b-instruct`) after Whisper transcription. There is no deterministic parser layer. The Worker streams its response to the client as NDJSON: the Whisper transcript + detected language is emitted as soon as Whisper returns, and the Llama-parsed session (or a structured error) follows on a second line.

Supporting decisions captured by this ADR:

- The language gate on the transcript accepts `{ en, sv, is, no, nn, nb, da }` — Whisper routinely mislabels Swedish speech as Icelandic under iOS Safari audio encoding, and the other Nordic tags cost nothing to include.
- When Whisper returns `language: undefined`, the transcript passes through to Llama (not rejected), with a structured-logging tripwire on hashed IPs to detect abuse.
- Once the NDJSON stream has opened, any inference-level failure appears as a `{"kind":"error",...}` event in the body — the HTTP status stays 200. Pre-stream rejections (upload-empty, upload-too-large, origin-not-allowed, method-not-allowed, rate-limited) use 4xx status codes.
- Client-facing error events carry fixed reason codes only. Raw exception text, model identifiers, Workers AI request IDs, and retry-attempt detail are logged server-side and never surfaced to the client.

## Context

The Phase 3 spec originally shaped the pipeline as **Llama-only**: Whisper transcribes, Llama returns JSON, the client displays it. A pre-implementation `/review-spec` pass flipped this to **parser-first with Llama fallback**, on the reasoning that a deterministic parser handling the closed grammar (integers + a small fixed vocabulary of units and separators) would be fast, free, privacy-preserving, and debuggable — with Llama only catching the long tail.

A half-day spike in April 2026 built both the parser and the Llama fallback, tested against a pinned 20-phrase corpus, and validated them on real Android + iOS hardware with real voice input.

What the spike found:

- **Whisper's transcripts vary in ways the parser couldn't tolerate.** "Five sets" became "Fem sätt" (variant spelling), "tio" became "tíu" (Icelandic-phonology misdetection on iOS), "fyrtiofem" became "fyrtífem". Each required either a hand-crafted normalisation rule in the parser or a fallback to Llama. In practice the fallback rate on Swedish was close to 50%.
- **Llama handled the variance natively.** The same phrases that broke the parser parsed correctly through Llama, including Icelandic-flavoured Swedish on iOS. Llama's latency was 176–495 ms median — well inside the 2 s total budget.
- **The product vision rejects per-phrase rule-chasing.** Takt is positioned as "voice-first, touch-always" specifically so that modern speech models can handle natural phrasing without a custom grammar. Shipping a deterministic parser with a hand-maintained spelling lookup recreates the problem the vision rejects.

The pivot from parser-first to Llama-primary was made mid-spike and validated with a second device-level bake-off. A second finding from the bake-off drove the Nordic-cousins language-gate widening: iOS Safari's Whisper path consistently mislabels Swedish speech as Icelandic (`language: 'is'`). The original gate (`{en, sv}`) was rejecting legitimate Swedish input.

The streaming response shape was added at the same time, motivated by perceived-latency measurements: single-blob responses forced a 1.5–1.7 s silent wait before the user saw anything. Streaming the transcript first collapses that to 1.1–1.3 s of "I can read what I just said" followed by the session a beat later — a large UX win at zero architectural cost.

This ADR exists because phase specs are archived when a phase ships. Without this record, the reasoning behind killing the parser, widening the language gate, and choosing streaming lives only in `SPECIFICATIONS/03-voice.md` — which becomes invisible to future `grep REFERENCE/decisions/` searches once Phase 3 closes. Cost of relitigation: roughly a week of re-spike. Cost of writing this now: 30 minutes while the reasoning is fresh.

## Alternatives considered

### For the parse layer

- **Deterministic parser only (no Llama).** The original prototype shipped with a hand-written `voice.js` parser covering canonical phrasings.
  - Why not: the spike confirmed Whisper variance makes this a running maintenance cost. Each transcription artefact ("sätt", "tíu", "fyrtífem", "ninety second" vs "ninety seconds") is a new rule. The rule-maintenance burden compounds across two languages.

- **Parser-first with Llama fallback.** The immediately prior spec revision. Parser handles canonical grammar; Llama catches what the parser misses.
  - Why not: the spike showed ~50% of Swedish phrases fall through to Llama in practice. The parser adds complexity and latency variance without eliminating the Llama dependency — worst of both worlds.

- **Chosen: Llama-primary, single call, no parser.** One system prompt with English + Swedish few-shot examples, strict JSON output, zod-validated, retry with repair-example on schema failure.
  - Why this won: handles the full distribution of phrasings natively. Zero per-phrase maintenance. Costs one Llama call per successful parse (~200–500 ms). zod bounds clip hallucinations. Retry with bumped temperature + one-shot repair example handles the occasional prose-before-JSON.

### For the response shape

- **Single-blob JSON response.** Worker returns `{ session, transcript, language, ... }` when both inference calls complete.
  - Why not: forces ~1.5–1.7 s of silent wait. Client can't show anything until both calls finish. Wastes the perceived-latency opportunity.

- **Server-Sent Events (SSE).** EventSource-compatible stream with `event:` + `data:` framing.
  - Why not: heavier framing for two events. `EventSource` browser API doesn't support custom headers, complicating origin checks. NDJSON is simpler to produce (Worker `TransformStream`), simpler to consume (line-by-line reader), and carries exactly what we need.

- **Chosen: NDJSON (newline-delimited JSON).** One JSON object per line, `Content-Type: application/x-ndjson`. First line is always `{kind: 'whisper', ...}` (or an early `{kind: 'error', ...}` for pre-Whisper failures). Second line is `{kind: 'parsed', ...}` or `{kind: 'error', ...}`.
  - Why this won: minimal framing, trivial to produce and consume, extensible (future events like `rate-limit-warning` slot in additively). Matches the two-stage nature of the pipeline without inventing bespoke event types.

### For the language gate

- **Strict `{en, sv}` gate.** Reject anything Whisper doesn't label as English or Swedish.
  - Why not: Whisper mislabels Swedish as Icelandic on iOS audio encoding in a significant fraction of real-world recordings. Strict gate causes false rejects on legitimate Swedish input.

- **Accept whatever Whisper returns, let Llama handle it.** No gate at all.
  - Why not: genuine French/German/Mandarin speech is common enough that burning a Llama call on every recording is a meaningful cost. The gate exists specifically to cap quota spend on out-of-scope inputs.

- **Chosen: widened gate accepting Nordic cousins `{en, sv, is, no, nn, nb, da}`.** Llama handles the spelling variance inside the Nordic set; genuine non-Nordic still gets gated.
  - Why this won: closes the iOS Safari false-reject hole at the cost of ~1 Llama call per Nordic-mislabelled recording. Keeps the economic gate on genuine non-Nordic speech.

### For language=undefined handling

- **Reject on undefined** (fail closed, conservative security default).
  - Why not: the population most likely to produce undefined-language detections — non-native English speakers, users in noisy environments, older users — is exactly the user base Takt is built for. Rejecting them is a self-inflicted UX wall.

- **Chosen: pass-through with structured-logging tripwire.** Treat undefined as "don't know, try Llama anyway." Log `language=undefined + not-a-session` events with hashed IPs. Revisit if the rate exceeds 1–2% baseline.
  - Why this won: the abuse-surface argument for rejecting collapses once the rate limiter is in place. The only remaining concern is cost, which Llama's 200–500 ms and the rate limiter together bound. The log-sample catches both genuine abuse and Workers AI response-shape drift.

## Reasoning

The spike was the deciding input. Three separate attempts (Llama-only spec, parser-first spec, parser-first spike) converged on the same observation: the closed-grammar assumption behind the parser doesn't hold in the presence of Whisper transcription variance. The variance isn't random — it's systematic (Swedish→Icelandic on iOS, compound numerals, conjugation drift) — but it's large enough that the parser would need to keep growing indefinitely.

The streaming shape is a separate decision that happens to sit in the same PR. It's motivated purely by measured perceived latency: `/spike` showed users visibly happier when they saw their transcript 400–500 ms before the final session. That's the streaming UX earning its keep, nothing more.

The error-content-safety contract (client sees fixed reason codes only, server logs details) is documented in this ADR rather than a separate one because it's the practical consequence of making the streaming shape work safely: once the NDJSON stream is open, status codes can't flip — so the body has to carry error information, and that body is visible to any caller, including curl probes. The contract exists to prevent the echo pattern from leaking infra fingerprints.

## Trade-offs accepted

**Dependency on Workers AI Llama availability and pricing.**
If Cloudflare retires the Llama model or raises Workers AI pricing sharply, the pipeline needs a substitute. Mitigation: `llama.ts` isolates the model behind `parseWithLlama(ai, transcript)`; switching to a different Workers AI model (or a different provider) touches one file. zod bounds clip output regardless of model.

**No offline voice.**
A deterministic parser could theoretically run client-side for offline use. Llama-primary can't. Mitigation: offline voice isn't in scope for v1 (Phase 2 PWA covers offline _running_ a configured session, not offline voice configuration). Revisit if the requirement emerges.

**Cold-start latency spike.**
Workers AI first calls to a cold endpoint add ~3 s to the baseline ~1.5 s warm latency. Mitigation: the streaming UX surfaces the transcript first, so users see _something_ within 1 s even on cold Llama. Acceptance criterion names a 30 s client-side AbortController timeout as the hard ceiling.

**iOS Swedish accuracy is limited until Phase 5.**
Without a `language: 'sv'` hint to Whisper, iOS Safari routes Swedish through Icelandic phonology, and Llama's Swedish numeral table doesn't cover the Icelandic spellings (`fyrtífem` vs `fyrtiofem`, `tíu` vs `tio`). Parsed numbers are sometimes wrong. Mitigation: the Interpretation screen shows the parsed session before the timer runs — user sees wrong numbers, edits them, continues. Phase 3 proper adds a conditional prompt-enrichment (append an Icelandic-numeral table to the Llama system prompt when `language === 'is'` + transcript contains Icelandic numeral tokens). Phase 5 Settings resolves the root cause by passing a Whisper language hint. Tracked as TD-016.

**No per-phrase debuggability.**
When a parse is wrong, there's no "we didn't match pattern X" log line. All we have is the transcript + Llama's raw output. Mitigation: `parse.ts` emits `rawOutput` in parsed events during the spike phase (stripped for production per the Phase 3 proper exit checklist). Structured logs + failure sampling cover the production tail.

**Nordic-cousins gate is pragmatic, not principled.**
`{is, no, nn, nb, da}` in the accept set isn't a design statement that Takt supports those languages — it's a workaround for Whisper mislabelling. A future Whisper version that stops mislabelling Swedish would let us narrow the gate back. Documented here so future maintainers don't assume broader language support than actually exists.

## Implications

**Enables:**

- Phase 3 proper builds on this architecture — Voice overlay, rate limiter, Configure handoff all assume the NDJSON contract and the Llama-primary shape.
- Phase 4 "save as preset" can ride the same pipeline: preset name extraction becomes another field in the Llama prompt + zod schema.
- Phase 5 language toggle is a single one-line change: pass `language: env.userLanguage` to Whisper instead of auto-detect.
- Future multi-language expansion follows the same pattern: add few-shot examples in the new language to the Llama prompt, add the language tag to `SUPPORTED_LANGUAGES`. No parser work.

**Prevents / complicates:**

- No low-level recovery when Llama is down. The pipeline fails gracefully (error event, tap-through to manual Configure), but can't "partially work" the way a parser + Llama-fallback could.
- No per-phrase accuracy guarantees. Llama output is probabilistic. zod + retry + bounds bound the damage but can't eliminate it.
- No offline-capable voice parsing, as above.

**Client contract implications:**

- Clients must read the HTTP status first, then if 200, consume the NDJSON stream line-by-line and dispatch on `kind`. Clients that treat the response body as a single JSON object will break. The Phase 3 proper client wraps this in `voice-client.ts` + `stream.ts` so callers don't see the raw contract.
- The "error event in a 200 body" contract requires explicit client-side handling for cases where a server error lands _after_ a successful `whisper` event. The Voice overlay state machine handles this via the `transcribing → parsing → parse-error` path.

**Error-content-safety contract (normative):**

Safe to include in a client-facing `{kind: 'error', ...}` event:

- Fixed reason codes: `upload-empty`, `upload-too-large`, `origin-not-allowed`, `method-not-allowed`, `rate-limited`, `whisper-error`, `llama-error`, `schema-failed`, `not-a-session`, `empty-transcript`, `language-unsupported`.
- Non-identifying latency fields: `whisperMs`, `llamaMs`, `totalMs`.
- For `rate-limited`: `retryAfterSec`.
- For `language-unsupported`: the detected-language tag itself (public information on the stream).

Not safe — log server-side only:

- Raw exception messages or stack fragments (`err.name: err.message`).
- Model identifiers and version strings.
- Workers AI request IDs.
- Retry-attempt details (which attempt failed, what the bad output was).
- Prompt content or prompt fragments.
- Raw Llama output (`rawOutput` field is removed when `/spike` ships).

The `worker/lib/toSafeErrorMessage.ts` helper enforces this contract at the 5 call sites in `parse.ts` and `llama.ts`.

---

## References

- [Phase 3 spec](../../SPECIFICATIONS/03-voice.md) — scope, testing strategy, the Spike outcome section
- [ADR — Reducer-plus-effects pattern](./2026-04-19-reducer-plus-effects-pattern.md) — shape of the Voice overlay state machine
- [Technical debt](../technical-debt.md) — TD-016 (iOS Whisper Icelandic misclassification), TD-017 (minimum-viable rate limiter)
- [Prototype voice parser](../../SPECIFICATIONS/prototype-design-files/voice.js) — the parser this ADR rejects
- `worker/api/voice/parse.ts`, `worker/api/voice/llama.ts`, `worker/api/voice/whisper.ts` — the shipped implementation
