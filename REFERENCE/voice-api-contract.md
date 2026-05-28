# Voice API contract — `/api/voice/parse`

How-it-works reference for the voice parse endpoint. Complements the implementation in
`worker/api/voice/parse.ts` and the ADR at `REFERENCE/decisions/2026-04-20-llama-primary-ndjson-streaming.md`.

---

## HTTP status-code contract

**Pre-stream rejections (no body or single-line NDJSON error body):**

| Status | Reason               | When                                                                                                                                              |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `upload-empty`       | Body is absent or smaller than `MIN_AUDIO_BYTES` (500 bytes).                                                                                     |
| `403`  | `origin-not-allowed` | `Origin` header is not in the allowed-origins set.                                                                                                |
| `405`  | `method-not-allowed` | Request method is not `POST`.                                                                                                                     |
| `413`  | `upload-too-large`   | Body exceeds the 3 MB upload cap.                                                                                                                 |
| `429`  | `rate-limited`       | Anonymous caller has exceeded 3 calls for the UTC day. Body is a single NDJSON line `{"kind":"error","reason":"rate-limited","retryAfterSec":N}`. |

**Once the stream opens, the status is always `200`.** Inference-level failures (empty transcript,
language gate rejection, Llama schema failure, etc.) are delivered as `{"kind":"error",...}` events
inside the NDJSON body — not as non-2xx HTTP codes. Clients must parse the stream events to
distinguish success from failure after the initial 200.

---

## NDJSON event shapes

`Content-Type: application/x-ndjson; charset=utf-8`

Each line is a complete JSON object followed by `\n`. Two events on the happy path; one on failure.

### Happy path (two events)

**Whisper event** — emitted the moment Whisper returns, before Llama is called:

```json
{ "kind": "whisper", "transcript": "three sets of one minute", "language": "en", "whisperMs": 1120 }
```

- `transcript` — the text Whisper produced (may be empty string if nothing was audible; the
  server then emits an `empty-transcript` error event instead of a Llama call).
- `language` — the BCP-47 language tag Whisper detected. May be absent if Whisper returned no
  language (ADR 2026-04-20 Option C: pass through to Llama, log the anomaly).
- `whisperMs` — Whisper inference latency in milliseconds.

**Parsed event** — emitted after Llama produces a valid session:

```json
{
  "kind": "parsed",
  "session": { "sets": 3, "workSec": 60, "restSec": 30 },
  "llamaMs": 420,
  "totalMs": 1540
}
```

- `session` — `{ sets: 1–99, workSec: 5–3600, restSec: 0–3600 }`. Validated by zod; values outside
  these ranges are rejected before this event is emitted.
- `llamaMs` — Llama inference latency in milliseconds.
- `totalMs` — wall-clock time from request receipt to this event.

### Error event (replaces or follows the whisper event)

```json
{ "kind": "error", "reason": "<ErrorReason>", "totalMs": 1200 }
```

Optional extra fields:

| Field           | Present when                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| `retryAfterSec` | `reason === "rate-limited"` — seconds until the next UTC midnight             |
| `message`       | `reason === "language-unsupported"` — the detected language tag (e.g. `"fr"`) |
| `totalMs`       | All error events emitted after inference begins                               |

**`reason` values delivered via the stream (HTTP 200):**

| Reason                 | When                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `whisper-error`        | Workers AI Whisper call threw an exception.                                                                                     |
| `empty-transcript`     | Whisper returned a blank transcript. Quota is charged.                                                                          |
| `language-unsupported` | Detected language is not in the Nordic-cousins set (`en`, `sv`, `is`, `no`, `nn`, `nb`, `da`). No Llama call; quota is charged. |
| `not-a-session`        | Llama returned `{ error: "not-a-session" }` — intelligible speech but not a timer description.                                  |
| `schema-failed`        | Llama output failed zod validation after one repair retry.                                                                      |
| `llama-error`          | Workers AI Llama call threw an exception.                                                                                       |

---

## Cold-start behaviour

The Worker uses a `TransformStream` and begins writing the HTTP response headers before Workers AI
is called. As a result, headers arrive at the client within milliseconds even when Whisper or Llama
are cold. **Headers arriving ≠ stream active.** The first NDJSON line is the true liveness signal.

The client (`voice-client.ts`) arms a 30-second `AbortController` that starts on `fetch()` and is
cleared only on receipt of the first NDJSON line. A timeout fires `errorArrived(reason: 'cold-start-timeout')`.

---

## Request headers

### `X-Takt-Lang` (optional)

A language hint sent by the client to help Whisper transcription. The value is the user's current UI language (e.g. `"en"` or `"sv"`).

```
X-Takt-Lang: sv
```

**Contract:**

- The server lower-cases the value and validates it against `SUPPORTED_LANGUAGES`.
- Unknown or absent values are silently ignored — the hint is advisory.
- Older clients that do not send the header continue to work without change.

---

## Rate-limit bypass

Two paths skip the rate-limit check:

**Dev bypass** — when the Worker runs under `wrangler dev` with `ALLOW_RATE_LIMIT_BYPASS=1` in `.dev.vars`. The bypass flag is not set in production.

**Admin bypass** — when the request arrives with a valid session cookie whose `isAdmin` flag is `true`. This flag is sourced from D1 at sign-in and stored server-side in KV; it cannot be forged by the client. Admin callers are exempt from the daily cap so that testing and monitoring do not consume voice quota.

---

## Side effects on a successful parse

After the `parsed` event is written to the NDJSON stream, a `voice_calls` row is inserted into D1 via `ctx.waitUntil` (fire-and-forget, not on the response critical path):

| Column        | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| `user_handle` | The authenticated user's handle, or `null` for anonymous callers. |
| `called_at`   | Unix epoch-ms timestamp.                                          |

This insert does not fire on error paths (`whisper-error`, `language-unsupported`, `schema-failed`, etc.) — `voice_calls` tracks successful intent parses only.

Rows are retained for up to 90 days (deleted when the user is purged or deleted; anonymous rows cleaned up by the daily cron). The privacy policy discloses this tracking.
