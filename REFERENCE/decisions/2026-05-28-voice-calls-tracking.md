# ADR 2026-05-28 — Voice call tracking in D1

## Decision

Insert a row into the `voice_calls` table after each successful `/api/voice/parse` request. The row stores: `user_handle` (null for anonymous callers) and `called_at` (epoch-ms timestamp). The insert is fire-and-forget via `ctx.waitUntil` so it is not on the response critical path.

## Context

Phase 6c adds:

- Usage analytics: voice call counts (7d / 30d) on the admin dashboard.
- Rate-limit audit trail: confirms observed throughput matches KV rate-limit counters.

## Alternatives considered

**Keep only KV counters.** The rate-limit KV keys expire after 26 hours, giving no historical view. The admin dashboard would have no voice usage signal.

**Log only success events, skip failures.** The insert is placed after the `parsed` event is written, so failed transcriptions and parse errors are not counted. This is the chosen approach — voice_calls tracks successful intent parses, not all API attempts.

## Privacy implications

`voice_calls` rows are pseudonymous: the handle is a random identifier with no linkage to real-world identity. Anonymous callers store null. Rows are pruned when a user is deleted (cascade) or by the 90-day rolling purge of `voice_calls` rows for departed users. The privacy policy has been updated to disclose this tracking.

The `parse.test.ts` privacy contract test uses `ctx?.waitUntil(...)` with an undefined `ctx`, so the insert never fires during tests — the assertion `expect(probeD1.prepare).not.toHaveBeenCalled()` remains valid and is not relaxed.

## Trade-offs accepted

- Small additional D1 write per voice request (fire-and-forget, negligible latency impact).
- Slightly broader data footprint than strictly necessary for the timer's core use case.
