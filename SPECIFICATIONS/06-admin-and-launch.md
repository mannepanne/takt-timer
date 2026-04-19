# Phase 6: Admin backend and launch

## Phase overview

**Phase number:** 6
**Phase name:** Admin backend + hardening + launch
**Estimated timeframe:** 4–6 days
**Dependencies:** Phase 5 (i18n, Settings, Onboarding) complete.

**Brief description:**
Build the admin surface Magnus needs to operate the service, wire the retention purge, harden for production traffic, and launch. After this phase, Takt is a public, operated service.

---

## Scope and deliverables

### In scope

- [ ] Admin route hosted at `takt.hultberg.org/admin` (path), gated by Cloudflare Access with Magnus's existing Google IdP policy. No app-level auth on this route — Access handles it.
- [ ] Admin UI (small, functional — does not need to match the app's aesthetic precisely; a clean, clear interface is enough):
  - Dashboard: total users, active users this week / month, sessions completed this week / month, voice calls today / this week, rate-limit hits today.
  - Users list: paginated table keyed by `userHandle` (nothing else identifying), showing `createdAt`, last session timestamp, preset count, session count.
  - User detail: read-only view of a single user's presets and session history summary.
  - Delete user action: hard-deletes the user and cascades to presets and sessions. Confirmation step.
- [ ] `isAdmin` flag auto-set for the admin's user row the first time they register (matched by the Access-authenticated identity — determine the match mechanism during the phase: a header set by Access, or a one-off seed in D1).
- [ ] Rate-limit exemption for `isAdmin: true` users on `/api/voice/parse`.
- [ ] Retention purge: scheduled Cron Trigger worker that runs daily, deletes users with no sessions in the past 12 months (and cascades presets and sessions). Logs purge counts to structured output for the admin dashboard.
- [ ] Security headers baseline:
  - `Content-Security-Policy` tightened (no `unsafe-inline`, scoped script-src, connect-src limited to the app's own origins and Cloudflare Web Analytics).
  - `Strict-Transport-Security` with `max-age=31536000; includeSubDomains`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` disabling features Takt doesn't use.
- [ ] Observability:
  - Structured logs on every API route (method, path, latency, status, rate-limit state, inference latency for voice).
  - Simple uptime check (Cloudflare Healthcheck or external) against `/api/health`.
- [ ] Pre-launch checklist completed (see below).
- [ ] Launch: announcement, analytics verified in production, one dogfooding week before announcing publicly.

### Out of scope

- Any new user-facing feature.
- Multi-language admin UI (English only — only Magnus uses it).
- Fine-grained permissions on admin (only Magnus, no tiers).

### Acceptance criteria

- [ ] Magnus visits `takt.hultberg.org/admin` and is challenged by Cloudflare Access; after Google sign-in, the admin UI loads.
- [ ] A non-Magnus Google account visiting `/admin` is rejected by Access (verified with a test account).
- [ ] Magnus's user row has `isAdmin = 1` after his first sign-in post-launch.
- [ ] Magnus can call the voice API without hitting the rate limit.
- [ ] The cron trigger runs and, against a seeded test database, correctly purges rows older than the threshold.
- [ ] Security headers verified via a headers-check tool showing A-grade.
- [ ] `/api/health` green; uptime check passing.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**Admin UI is a small server-rendered page inside the main Worker, not a separate SPA**
- Choice: a few endpoints under `/admin/*` that return server-rendered HTML with minimal client-side JS (e.g. `htmx` or just `<form>` posts).
- Rationale: simple, cheap, single deploy. No need for the main SPA's complexity for an audience of one.
- Alternatives considered: a second SPA (overkill); embedding admin into the main SPA (mixes concerns and bundles).

**Admin identification: Cloudflare Access at the edge, `isAdmin` flag in D1**
- Access passes the authenticated email as a request header (`CF-Access-Authenticated-User-Email` or equivalent). The admin Worker reads it and uses it only to authorise requests and to set `isAdmin = 1` on Magnus's user row when he first registers in the main app.
- The app never stores the email; it's read for authorisation, not persistence.

**Retention purge as a scheduled Worker, not a one-off script**
- Choice: Cron Trigger running once per day. Dry-run first week (logs what it *would* delete); real deletes after verification.
- Rationale: runs reliably, no external infra, logs available.

### Technology choices

No new user-facing dependencies. Admin page can use vanilla server-rendered HTML; keep it boring.

### Key files and components

```
worker/
├── admin/
│   ├── router.ts                     # handles /admin/* inside the main Worker
│   ├── dashboard.ts
│   ├── users.ts
│   ├── user-detail.ts
│   ├── delete-user.ts
│   ├── views/                        # tiny HTML templates
│   │   ├── layout.html.ts
│   │   ├── dashboard.html.ts
│   │   └── user.html.ts
│   └── auth.ts                       # reads CF-Access headers, enforces presence
├── cron/
│   ├── purge.ts                      # inactive-user purge
│   └── purge.test.ts
└── lib/
    └── security-headers.ts           # applied to all responses
```

### Database schema changes

None new. `isAdmin` column from phase 4 is sufficient. The purge references existing timestamps.

---

## Testing strategy

### Unit tests

- `cron/purge.test.ts` — correctly identifies users with no sessions in 12 months, cascades deletes.
- `admin/auth.test.ts` — rejects requests without Access headers; accepts with valid ones.
- `admin/users.test.ts` — listing, pagination, detail.
- `admin/delete-user.test.ts` — confirmation required, cascades correctly.
- `lib/security-headers.test.ts` — every response includes the expected headers.

### Integration tests

- [ ] End-to-end with mocked Access headers: dashboard renders stats, users list loads, delete-user flow completes.
- [ ] Purge on a seeded test database: old users removed, recent users kept.

### Manual testing checklist

- [ ] Visit `/admin` from Magnus's Google — access granted.
- [ ] Visit from a non-allowed Google account — Access denies.
- [ ] Dashboard numbers match a direct D1 query.
- [ ] Delete a test user from the admin UI; verify D1 no longer has their rows.
- [ ] Headers verified with securityheaders.com against production.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] Security headers verified in staging.
- [ ] Uptime check configured and alerting to Magnus.
- [ ] D1 backup strategy documented in `REFERENCE/environment-setup.md` (even if the strategy is "rely on Cloudflare's built-in export").
- [ ] Privacy policy re-checked against actual behaviour — no drift from phase 5.
- [ ] Technical debt document (`REFERENCE/technical-debt.md`) cleaned; any phase-2 through phase-5 debt either resolved or explicitly deferred with a plan.

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
- [ ] First cron purge has run (as dry-run) with reasonable output.
- [ ] Rate limit verified: fourth anon voice call from one IP gets 429.
- [ ] Admin UI: delete a test user end-to-end, confirm no residue.
- [ ] Rollback plan documented: how to disable voice API if Workers AI becomes expensive or buggy.
- [ ] Dogfood week: Magnus uses Takt for real rehab sessions for seven days before public announcement.

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

- Admin Worker defensively checks the Access header on *every* request — not just the entry point.
- Deleting a user is logged (non-PII) with timestamp and actor, kept for 90 days in structured logs for incident review.
- CSP tightened and verified; no inline scripts except those fingerprinted or nonced.

### Accessibility considerations

- Admin UI is Magnus-only and English-only; standard form semantics are sufficient. Still uses `<label>`, `<button>`, `<table>` properly.

---

## Technical debt introduced

None anticipated. Resolve or document any lingering debt from earlier phases during this one.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 5](./05-i18n-settings-onboarding.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Environment setup](../REFERENCE/environment-setup.md)
- [Technical debt](../REFERENCE/technical-debt.md)
