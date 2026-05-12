# ADR: KV-backed daily-cap rate limiter for /api/voice/parse

**Date:** 2026-05-12
**Status:** Active
**Supersedes:** N/A

---

## Decision

The voice endpoint enforces its daily cap with a KV-backed read-then-write counter, keyed per UTC day. Anonymous callers are capped at 3 calls per day per hashed IP; authenticated callers will be capped at a higher tier when Phase 4 plugs in session→userId resolution. A `wrangler dev` bypass flag short-circuits the check locally. The implementation accepts a small race window — two requests arriving within the same KV read-write round-trip can each see `current < cap` and both increment — in exchange for a single-store, no-extra-binding design.

## Context

Phase 3 ships a paid Workers AI inference path on a public endpoint. Without a cap, a single abusive caller can run up the neuron bill in minutes. The spike (PR #6) and B1 plumbing (PR #7) used a coarse minimum-viable 20/day limiter behind `TD-017` to unblock voice end-to-end testing without committing to a mechanism. B3b replaces that placeholder with the limiter Phase 3 actually ships.

Three concrete questions had to be answered:

1. **Mechanism.** KV read-then-write, Cloudflare's native Rate Limiting API binding, or a Durable Object counter?
2. **Anonymous cap.** Match the spec's 3/day, or stay closer to the spike's 20/day to leave headroom for legitimate retries?
3. **Auth tier.** Wire the user-keyed branch now, or stub the key shape and defer the lookup to Phase 4?

## Alternatives considered

- **Cloudflare native Rate Limiting API binding** (`[[unsafe.bindings]]` → `ratelimit`):
  - Why not: native rate limiting is a sliding-window throttle calibrated in requests-per-period, not a daily-cap counter that resets at midnight UTC. We need the UTC-boundary semantics for the "today's allowance" UX copy and for the `retryAfterSec` math the overlay uses to format "Try again in N hours." Bending the native binding into that shape (e.g. 3 per 86400s rolling) gives a different, worse user experience — the cap would not reset cleanly at midnight and "tomorrow" would be a moving target. Native rate limiting also lacks the user/anon key-shape split we want for Phase 4.

- **Durable Object counter** (one DO per `userId` / `ipHash`, transactional `increment-then-check`):
  - Why not: a DO would close the race window the KV solution accepts, but the cost is a new binding, new infra to provision, ~50ms of DO RPC latency per voice call, and an extra failure mode (DO cold-start, transient unavailability). For a 3/day cap where the worst-case race lets a single attacker get to 4–5 calls a day instead of 3, this is overkill. Worth revisiting later if abuse patterns prove KV's race window inadequate, but expensive insurance to buy on speculation.

- **Chosen: KV read-then-write counter with per-UTC-day keys:**
  - Reuses the `RATE_LIMITS` namespace already provisioned for the spike. Single store, single binding, no extra latency beyond the one KV round-trip we were already paying.
  - Increment-before-inference: cancelled uploads and failed parses still consume quota, which is the right cost-control posture for a paid inference path. (See the `parse.ts` comment on this — same logic as before the refactor, retained intentionally.)
  - Key shape is explicit and stable: `ratelimit:anon:${ipHash}:${utcDay}` for anonymous callers, `ratelimit:user:${userId}:${utcDay}` for authenticated ones once Phase 4 wires the lookup.

- **Anonymous cap: 3 vs 20:**
  - The spec asked for 3/day from the start; the spike's 20 was an explicit interim ceiling, not a re-thought design. The spec value won — at 3, "today's allowance" maps cleanly to the user's mental model, and the math on plausible solo-rehab usage gives plenty of headroom. (Magnus's own use during testing is covered by the `wrangler dev` bypass.)

- **Auth tier: wire now vs stub:**
  - Stubbed. The function accepts an optional `userId` and produces the user-keyed shape when one is supplied; the cap stays at `ANON_DAILY_CAP` for both tiers until Phase 4 picks an authenticated-tier number. `parse.ts` doesn't yet resolve a session to a userId — that's Phase 4's job. Wiring it now would require either a placeholder auth dependency or a no-op session cookie reader, both of which would have to be unwound when the real auth lands. The key-shape stub is zero risk, zero infra, and lets Phase 4 plug into a single call site.

## Reasoning

**Why KV over native rate limiting.** The user-facing copy is the test. We tell the user "you've used today's voice allowance" and "try again in N hours." That's a daily cap with a UTC-midnight reset, not a rolling-window throttle. KV gives us those semantics natively — the key encodes the day, expiration handles cleanup automatically — and the native binding doesn't.

**Why accept the race window.** Two simultaneous requests can both read `current = 2`, both write `current = 3`. The user gets 4 calls instead of 3. Caring about this would mean either a DO transaction or an atomic KV op (KV has none for counters). Neither is justified at 3/day. The cost-control floor that matters is the order-of-magnitude one: catching the abusive caller who would otherwise rip 1000 calls/day, not preventing the edge case of one extra free call on a colliding write.

**Why increment-before-inference.** Cancelled uploads and failed parses must consume quota. The Workers AI neuron spend is incurred regardless of whether the user sees a result — if quota only ticked on success, an attacker could trigger 1000 cancelled inferences/day at no quota cost. The user-facing impact of the conservative posture: a failed parse "wastes" one of three daily calls. That's acceptable for the rehab-training threat model; we can revisit if Phase 4's authenticated-tier UX wants a refund policy (see open spec item on `empty-transcript` refunds at `SPECIFICATIONS/03-voice.md` line 334).

**Why the bypass flag instead of e.g. detecting `wrangler dev`.** The bypass is an explicit env-var opt-in (`ALLOW_RATE_LIMIT_BYPASS=1` in a gitignored `.dev.vars`). Detecting `wrangler dev` from inside the Worker is unreliable, and the only thing worse than no bypass would be a bypass that silently leaks into production. The flag is opt-in, missing in deployed builds, and named explicitly so it shows up if someone greps for it.

## Trade-offs accepted

**Race window: ~1 KV read-write window per cap boundary.**
The cap is "approximately 3"; in adversarial conditions it might be 4 or 5. Accepted because: (a) the boundary case requires concurrent requests, which a single user does not produce; (b) a determined attacker with parallel requests gets a one-time bonus of 1–2 extra calls per day, not unlimited free inference; (c) closing it costs a new DO binding plus latency on every call.

**TTL slack: keys live for 26 hours, not 24.**
A counter set at 23:59 UTC writes a key with the date `2026-05-12` and a 26h TTL; that key sticks around until `2026-05-14 01:59 UTC` even though the day key changes at `2026-05-13 00:00`. This is intentional safety margin for the seconds-until-midnight math and any clock drift between Workers regions. Cost is negligible — the stale key isn't read after the day rolls over because the day component of the key changed.

**Hashed IP is not a perfect identity.**
A caller behind CGNAT shares an IP with hundreds of others; a caller on a residential connection that rotates IPs daily gets a fresh quota at every rotation. Both are accepted: the cost-control goal is order-of-magnitude protection, not airtight per-person enforcement, and Phase 4 moves authenticated users off the IP key entirely.

**Bypass flag lives in `.dev.vars`, not as a Worker secret or `wrangler.toml` `[vars]` entry.**
The flag carries no security value (it's a local-iteration knob, not a credential), so it doesn't need the secret-binding ceremony. It can't live under `[vars]` either — that would deploy the value to production, and a bypass flag that ships to prod is exactly the failure mode this design is avoiding. `.dev.vars` is loaded only by `wrangler dev` and is gitignored, so the binding is undefined in deployed builds and the limiter defaults to enforcement when the variable is missing or set to any value other than `1` / `true` (case-insensitive). If we ever need to enable bypass in a deployed environment we should reconsider — at that point the flag is doing security work and should be a proper secret.

## Implications

**Enables:**

- Phase 4 plugs `userId` resolution into a single call site in `parse.ts` — no limiter refactor needed.
- The same KV namespace can host other ephemeral counters (per-session quotas, retry caps) under different key prefixes.
- The `retryAfterSec` value is precise enough for human-readable UX copy without further server-side coordination.
- Local development is unblocked: a developer running `wrangler dev` against their own machine doesn't burn the daily cap with each iteration.

**Prevents/complicates:**

- We cannot guarantee an exact 3/day enforcement against an adversary issuing concurrent requests (see race window above). If this ever becomes a real abuse signal in logs, the migration path is to swap the read-then-write for a DO call — single function, single call site.
- Cap changes (e.g. "lift to 5/day" or "split anonymous vs free-tier") require a constant change + redeploy. That is the correct shape — these are policy decisions, not runtime knobs.
- Adding the authenticated-user higher tier in Phase 4 means deciding what the cap _is_ for authenticated callers, which is currently a placeholder branch returning the same `ANON_DAILY_CAP`. Phase 4 work picks a number with the auth ADR alongside.

**Forward-looking contracts for Phase 4 to honour:**

- _When Phase 4 wires `userId` resolution, the resolved value MUST be a validated opaque identifier (UUID/ULID), not a raw user-supplied string — the KV key is built by string interpolation (`` `ratelimit:user:${userId}:${day}` `` in `rate-limit.ts`) and assumes a constrained character set. An attacker passing `:` or other separator-like characters could collide with another user's bucket or inflate KV storage. Validation belongs at the auth layer (session→userId resolver), not in `resolveKey` — adding a runtime assert inside the limiter would push security work onto the wrong layer and create a logged-in-DoS surface. This aligns with the "validate at system boundaries" rule in `.claude/CLAUDE.md`._
- _If a future change ever needs bypass in a deployed environment, that is a re-design trigger, not a config change — the flag is doing security work at that point. Do not promote `ALLOW_RATE_LIMIT_BYPASS` to a `wrangler secret` or `wrangler.toml [vars]` entry. `.dev.vars`-only is load-bearing: a deployed bypass is exactly the failure mode this design is avoiding._

---

## References

- Related ADRs: [2026-04-20 — Llama-primary NDJSON-streaming](./2026-04-20-llama-primary-ndjson-streaming.md) for the broader Phase 3 architecture, error-content-safety contract, and where the limiter sits in the request flow.
- Relevant specs: `SPECIFICATIONS/03-voice.md` — "Rate limiter and ADR" section under the pre-commit checklist.
- Code: `worker/api/voice/rate-limit.ts`, `worker/api/voice/parse.ts` (call site), `worker/api/voice/rate-limit.test.ts` (cap, day rollover, bypass, user-tier key shape).
- External: [Cloudflare Workers KV — values and TTLs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/), [Cloudflare Rate Limiting API binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) (the alternative considered and rejected).
