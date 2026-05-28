# Phase 6: Admin backend and launch

## Phase overview

**Phase number:** 6
**Phase name:** Admin backend + hardening + launch
**Estimated timeframe:** 3–4 days
**Dependencies:** Phase 5 (i18n, Settings, Onboarding) complete.

**Brief description:**
Build the admin surface Magnus needs to operate the service, wire the retention purge, harden for production traffic, and launch. After this phase, Takt is a public, operated service.

---

## Scope and deliverables

### In scope

- [ ] Admin route hosted at `takt.hultberg.org/admin` (path), gated by Cloudflare Access with Magnus's existing Google IdP policy. No app-level auth on this route — Access handles it.
- [ ] Admin UI (small, functional — does not need to match the app's aesthetic precisely; a clean, clear interface is enough):
  - Dashboard: total users, active users (rolling 7d / 30d), sessions completed (rolling 7d / 30d), voice calls (rolling 7d / 30d), rate-limit hits (rolling 7d). All windows are rolling UTC (7d = last 168 hours, 30d = last 720 hours).
  - User lookup: search by `userHandle`; shows `createdAt`, last session timestamp, preset count, session count.
  - Delete user action: hard-deletes the user, cascades to presets and sessions, and invalidates all active KV sessions. Confirmation step required.
  - All state-mutating admin endpoints validate the `Origin` header using `isAllowedOrigin` (same pattern as the main API) — the Cloudflare Access cookie is `SameSite=None` and is not CSRF-safe on its own.
- [ ] `isAdmin` flag set via a one-off D1 seed command run by Magnus after he registers. The Access-authenticated email header (`CF-Access-Authenticated-User-Email`) is available on admin requests and used to authorise access, but it is not used to auto-set `isAdmin` during passkey registration — that endpoint is public and the header is not present there. The seed step is documented as a manual operator step in `REFERENCE/environment-setup.md`.
- [ ] Rate-limit exemption for `isAdmin: true` users on `/api/voice/parse`.
- [ ] `/api/voice/parse` inserts a row into the `voice_calls` D1 table on each successful call (used for dashboard metrics). Insert is fire-and-forget via `ctx.waitUntil` — not on the critical path.
- [ ] Retention purge: a `scheduled(controller, env, ctx)` export on the existing Worker (not a separate Worker) that runs daily. Purge criterion: users registered more than 90 days ago with **no sessions and no presets**. Cascades deletes. Inserts a row into `purge_runs(id, ran_at, users_deleted)` for audit and dashboard display. Supports a `?dryRun=true` flag on the admin trigger endpoint to preview purge targets without deleting.
- [ ] Security headers baseline:
  - `Content-Security-Policy`: tighten where possible. Note: `style-src 'unsafe-inline'` cannot be removed without a React inline-style refactor (tracked as TD-010 GitHub issue). That refactor is out of scope for Phase 6; the criterion is A-grade on securityheaders.com, not A+.
  - `Strict-Transport-Security` with `max-age=31536000; includeSubDomains`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` disabling features Takt doesn't use.
- [x] Observability:
  - Structured logs on every API route (method, path, latency, status, rate-limit state, inference latency for voice).
  - Simple uptime check (Cloudflare Healthcheck or external) against `/api/health` — documented in REFERENCE/environment-setup.md; manual configuration step.
- [ ] Pre-launch checklist completed (see below).
- [ ] **Soft launch:** remove any Coming Soon gate, verify nothing breaks under real traffic, no promotion yet. Phase 6 scope ends here.
- [ ] **Hard launch (post-Phase 6):** announce publicly, drive traffic. Explicitly out of scope for this phase — deferred until after the dogfood week.

### Out of scope

- Any new user-facing feature.
- Multi-language admin UI (English only — only Magnus uses it).
- Fine-grained permissions on admin (only Magnus, no tiers).
- Users list / user detail view (cut — marginal admin value, XSS surface with user-controlled data).
- Hard launch / public announcement (deferred post-Phase 6, after the dogfood week).

### Acceptance criteria

- [ ] Magnus visits `takt.hultberg.org/admin` and is challenged by Cloudflare Access; after Google sign-in, the admin UI loads.
- [ ] A non-Magnus Google account visiting `/admin` is rejected by Access (verified with a test account).
- [ ] Magnus's user row has `isAdmin = 1` after running the one-off D1 seed command post-registration.
- [ ] Magnus can call the voice API without hitting the rate limit.
- [ ] The cron `scheduled` export runs against a seeded test database and correctly purges users with no sessions and no presets older than the threshold; users with sessions or presets are kept.
- [ ] Security headers verified via securityheaders.com showing **A-grade** (A+ deferred — TD-010 blocks it).
- [ ] `/api/health` green; uptime check passing.
- [ ] Tests pass with coverage targets met.
- [ ] Soft launch: site is publicly accessible with no Coming Soon gate.

---

## Technical approach

### Architecture decisions

**Admin UI is a small server-rendered page inside the main Worker, not a separate SPA**

- Choice: a few endpoints under `/admin/*` that return server-rendered HTML with minimal client-side JS (e.g. `htmx` or just `<form>` posts).
- Rationale: simple, cheap, single deploy. No need for the main SPA's complexity for an audience of one.
- Alternatives considered: a second SPA (overkill); embedding admin into the main SPA (mixes concerns and bundles).

**Admin identification: Cloudflare Access at the edge, `isAdmin` flag in D1**

- Access passes the authenticated email as `CF-Access-Authenticated-User-Email`. The admin Worker reads it on every request solely to authorise access. It is never stored.
- `isAdmin = 1` is set via a one-off D1 seed command run by Magnus after he registers via passkey. Auto-set at registration time is not possible: the passkey registration endpoint (`/api/auth/registration/verify`) is public and the Access header is not present there. The seed step is documented in `REFERENCE/environment-setup.md`.

**Retention purge as a `scheduled` export on the existing Worker**

- Choice: add a `scheduled(controller, env, ctx)` export to the existing Worker — not a separate Worker. Cron Trigger runs once per day.
- Rationale: shares D1/KV bindings with zero extra `wrangler.toml` config. Dry-run first week via `?dryRun=true` (logs targets without deleting); real deletes after verification.
- Purge criterion: users registered >90 days ago with **no sessions and no presets**. Users with only presets (never ran a session) are intentionally kept — this reduces the risk of accidentally purging engaged users who simply haven't run the app recently.

### Technology choices

No new user-facing dependencies. Admin page can use vanilla server-rendered HTML; keep it boring.

### Key files and components

```
worker/
├── admin/
│   ├── router.ts                     # handles /admin/* inside the main Worker
│   ├── dashboard.ts                  # metrics queries
│   ├── user-lookup.ts                # lookup by userHandle
│   ├── delete-user.ts                # delete + KV session invalidation
│   ├── views/                        # tiny HTML templates
│   │   ├── layout.html.ts
│   │   └── dashboard.html.ts
│   └── auth.ts                       # reads CF-Access headers, enforces presence + CSRF Origin check
├── db/
│   └── migrations/
│       └── 0003_admin_tables.sql     # voice_calls, purge_runs, admin_log
├── cron/
│   └── purge.ts                      # inactive-user purge (scheduled export on main Worker)
└── lib/
    └── security-headers.ts           # applied to all responses
```

### Database schema changes

Three new D1 tables:

```sql
-- Tracks every voice API call; used for dashboard metrics
CREATE TABLE voice_calls (
  id         INTEGER PRIMARY KEY,
  user_handle TEXT,   -- null for anonymous
  called_at  INTEGER NOT NULL  -- Unix timestamp
);
CREATE INDEX idx_voice_calls_called_at ON voice_calls(called_at);

-- Audit log for retention purge runs
CREATE TABLE purge_runs (
  id            INTEGER PRIMARY KEY,
  ran_at        INTEGER NOT NULL,  -- Unix timestamp
  users_deleted INTEGER NOT NULL
);

-- admin_log for delete-user actions (non-PII: handle + actor email + timestamp)
CREATE TABLE admin_log (
  id         INTEGER PRIMARY KEY,
  action     TEXT    NOT NULL,
  actor      TEXT    NOT NULL,  -- CF-Access-Authenticated-User-Email
  target     TEXT,              -- userHandle when applicable
  logged_at  INTEGER NOT NULL
);
```

KV: add a per-session reverse index `user-session:{handle}:{sessionId}` → `'1'`, maintained by `sessionStore.ts`. Used to invalidate all sessions when a user is deleted from the admin UI. One key per session avoids the read-modify-write race inherent in a shared set.

`isAdmin` column from Phase 4 is already present (`worker/db/migrations/0001_initial_schema.sql:11`).

---

## Testing strategy

### Unit tests

- `cron/purge.test.ts` — correctly identifies users with no sessions AND no presets older than threshold; users with sessions kept; users with only presets kept; cascades deletes; inserts `purge_runs` row.
- `admin/auth.test.ts` — rejects requests without Access header; rejects mismatched Origin; accepts valid Access + allowed Origin.
- `admin/user-lookup.test.ts` — lookup by handle returns expected fields; unknown handle returns 404.
- `admin/delete-user.test.ts` — confirmation required; cascades D1 deletes; invalidates KV sessions; inserts `admin_log` row.
- `lib/security-headers.test.ts` — every response includes the expected headers.
- `worker/voice.test.ts` — `voice_calls` row inserted on successful parse call.

### Integration tests

- [ ] End-to-end with mocked Access headers: dashboard renders stats, user lookup works, delete-user flow completes.
- [ ] Purge on a seeded test database: old users with no sessions and no presets removed; users with sessions kept; users with only presets kept.

### Manual testing checklist

- [ ] Visit `/admin` from Magnus's Google — access granted.
- [ ] Visit from a non-allowed Google account — Access denies.
- [ ] Dashboard numbers match a direct D1 query.
- [ ] Lookup a test user by handle — correct data returned.
- [ ] Delete a test user from the admin UI; verify D1 no longer has their rows and KV session is gone.
- [ ] Headers verified with securityheaders.com against production — A-grade.
- [ ] Attempt a cross-origin form POST to a delete endpoint without the correct Origin — rejected 403.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] Security headers verified in staging.
- [ ] Uptime check configured and alerting to Magnus.
- [ ] D1 backup strategy documented in `REFERENCE/environment-setup.md` (even if the strategy is "rely on Cloudflare's built-in export").
- [ ] Privacy policy re-checked against actual behaviour — no drift from phase 5.
- [ ] Open GitHub issues with the `technical-debt` label triaged; any phase-2 through phase-5 debt either resolved (issue closed) or explicitly deferred with a plan recorded on the issue.

---

## PR workflow

**Branch:** `feature/phase-6-admin-and-launch`
**PR title:** `Phase 6: Admin backend and launch`

Use `/review-pr-team` — admin access control, retention policy, and production hardening all warrant multi-perspective review.

---

## Pre-launch checklist

Separate from pre-commit. Run after Phase 6 merges, before announcing publicly.

- [ ] Real-user smoke test: register fresh account on a phone, run a session, sign in on another device.
- [ ] Privacy policy reviewed by Magnus end to end.
- [ ] Analytics recording real users.
- [ ] First cron purge has run (as dry-run via `?dryRun=true`) with reasonable output; `purge_runs` row inserted.
- [ ] Rate limit verified: fourth anon voice call from one IP gets 429.
- [ ] Admin UI: delete a test user end-to-end, confirm no residue in D1 or KV.
- [ ] isAdmin seed: Magnus's user row confirmed `isAdmin = 1` in D1.
- [ ] Rollback plan documented: how to disable voice API if Workers AI becomes expensive or buggy.
- [ ] **Soft launch gate:** site publicly accessible, no Coming Soon. Smoke tests pass.
- [ ] **Dogfood week:** Magnus uses Takt for real rehab sessions for seven days (hard launch follows this, not Phase 6).

---

## Edge cases and considerations

### Known risks

- **Cloudflare Access misconfiguration could expose admin.** Mitigation: verify with a non-Magnus Google account as part of acceptance; keep a simple "fail closed" behaviour in the admin Worker so a missing Access header always returns `403`, never `200`.
- **Purge bug deletes live users.** Mitigation: dry-run period of at least a week; purge function covered by tests with realistic fixtures; confirmation log retained.
- **Workers AI cost spike under load.** Mitigation: anon rate limit is the primary control; admin dashboard surfaces daily voice-call totals so spikes are visible.

### Performance considerations

- Admin dashboard queries aggregate over `sessions` and `users`. Indexed on timestamps; even at scale, these are cheap queries.
- Cron purge batches deletes in chunks to avoid hitting D1 query limits at scale.

### Security considerations

- Admin Worker defensively checks the Access header on _every_ request — not just the entry point.
- Deleting a user is logged (non-PII) with timestamp and actor, kept for 90 days in structured logs for incident review.
- CSP tightened and verified; no inline scripts except those fingerprinted or nonced.

### Accessibility considerations

- Admin UI is Magnus-only and English-only; standard form semantics are sufficient. Still uses `<label>`, `<button>`, `<table>` properly.

---

## Technical debt introduced

- **TD-010:** `style-src 'unsafe-inline'` in CSP blocks A+ on securityheaders.com. Removing it requires refactoring all React inline styles to CSS classes. Deferred beyond Phase 6. Track as a GitHub issue with `technical-debt` label.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 5](./ARCHIVE/05-i18n-settings-onboarding.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Environment setup](../REFERENCE/environment-setup.md)
- Technical debt — GitHub Issues with `technical-debt` label
