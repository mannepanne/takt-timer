# Phase 4: Accounts and presets

## Phase overview

**Phase number:** 4
**Phase name:** Accounts and presets — passkey auth, preset management, history sync
**Estimated timeframe:** 7–10 days
**Dependencies:** Phase 3 (Voice) complete.

**Brief description:**
Introduce pseudonymous accounts via passkeys, enable saving and managing presets, and sync session history to D1 for registered users. Add an authenticated rate-limit tier so registered users rarely hit caps.

---

## Scope and deliverables

### In scope

- [ ] Passkey registration flow (WebAuthn) using `@simplewebauthn/server` on the Worker and `@simplewebauthn/browser` in the SPA.
- [ ] Passkey sign-in flow.
- [ ] D1 schema: `users`, `presets`, `sessions` tables (see below).
- [ ] Session management: signed, HTTP-only, `SameSite=Lax` cookie containing a server-issued session ID. Server stores `sessionId → userHandle` in KV with a rolling 30-day TTL.
- [ ] Registration offers the one-shot local-history import: _"Bring your N sessions with you?"_. Accept sends all N rows to the server in one batch; the server inserts them in a transaction and responds with `{imported: N}`; the client clears localStorage only after confirming the count matches. On network failure or count mismatch the batch is retried — session IDs are stable UUIDs so re-submission is idempotent. Decline leaves local history untouched on-device.
- [ ] Presets drawer (ported from `presets-settings.jsx`): list, create, edit, delete, pin, reorder (long-press drag), duplicate, run.
- [ ] Save preset sheet reachable from Complete ("Save as preset") and from Presets drawer ("Create").
- [ ] Complete screen regains the "Save as preset" action for authenticated users. Anonymous users still see only "Run it again" / "Done" with a "Sign in to save" hint.
- [ ] Home's "last session" card: for authenticated users, populated from the server; for anon, from localStorage (unchanged).
- [ ] Authenticated rate-limit tier for `/api/voice/parse`: default 30/day (configurable). Anonymous remains 3/day. Admin exempt (flag is set but the admin backend itself is phase 6 — for now, `isAdmin` can be toggled via a manual D1 update).
- [ ] Sign-out: clears cookie and session in KV.
- [ ] Account deletion action (also surfaced in phase 5's Settings): hard-deletes the user, presets, and sessions.
- [ ] Service worker updated: cached user presets and recent history for offline read. Mutations while offline show a "you're offline" error — no write queue (deferred to a future enhancement, see GitHub issue #30).

### Out of scope

- Voice "save as preset" command — deferred to Phase 5. Requires extending the Llama prompt with a second intent type and routing save-intent responses through a new client flow; cleaner to land alongside Phase 5's fuller settings and i18n work.
- Internationalisation (phase 5).
- Full Settings screen (phase 5).
- Onboarding screen (phase 5).
- Admin backend (phase 6).
- Retention purge cron (phase 6).

### Acceptance criteria

- [ ] Magnus can create an account on his phone using Face ID, then sign in on his laptop via iCloud Keychain passkey sync.
- [ ] His 7 local sessions from phase 2/3 use are offered for import and appear in D1 after accepting.
- [ ] He can create, rename, pin, reorder, duplicate, and delete presets.
- [ ] Signing out and back in restores his presets.
- [ ] Rate limit: an authenticated user doesn't hit the 3/day cap.
- [ ] Deleting his account removes all his rows from D1 (verified with a direct query).
- [ ] Tests pass with coverage targets met; integration tests cover registration, sign-in, preset CRUD, and the import-on-register flow.

---

## Technical approach

### Architecture decisions

**Session token: server-side session in KV, referenced by signed cookie**

- Choice: cookie contains only an opaque session ID (signed); the `{sessionId → userHandle, expiresAt}` lives in KV.
- Rationale: trivial revocation (delete the KV key = sign-out everywhere), no PII in the cookie, no JWT verification complexity.
- Alternatives considered: self-contained signed JWT in cookie (fast, but revocation is annoying); D1 session table (slower than KV for this read-heavy use).
- **Decide and record as an ADR at phase start** before coding, per CLAUDE.md guidance.

**Passkey `userHandle` is a random 16-byte value (not a database id)**

- Stored as primary key of `users`. No link to anything that identifies the user.

**WebAuthn RP ID and expected origin are fixed at `takt.hultberg.org`**

- `rpID = "takt.hultberg.org"`, `rpName = "Takt"`, `expectedOrigin = "https://takt.hultberg.org"`.
- These values are baked into every passkey at creation and cannot be changed without invalidating all existing passkeys.
- Exposed as env vars `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` (declared in `wrangler.toml`, overridable in `.dev.vars` for local testing).
- Real-device testing requires HTTPS — use Cloudflare Tunnel or a preview deployment; `localhost` does not satisfy the browser security requirement for passkeys.
- **Record in the ADR alongside the session-token decision.**

**Session cookie signing secret provisioned as a Wrangler secret**

- `SESSION_COOKIE_SECRET` is declared in `wrangler.toml` as a secret binding and in the `Env` interface.
- Provisioned on production via `wrangler secret put SESSION_COOKIE_SECRET`.
- Added to `.dev.vars.template` with a placeholder value.

**WebAuthn signature counter: skip check for synced (backed-up) passkeys**

- Passkeys synced via iCloud Keychain, Google Password Manager, and 1Password return `counter = 0` on every assertion by design — maintaining per-device counters would cause cross-device conflicts.
- Counter regression check is skipped when `credentialBackedUp = true` (SimpleWebAuthn surfaces this via `backupEligible`/`backupState` flags on the verification response).
- Monotonic counter check applies only to platform-bound authenticators where both stored and received counters are `> 0`.
- **Record in the ADR.** The acceptance criterion "sign in on laptop via iCloud Keychain" depends on this being correct.

### Technology choices

- **`@simplewebauthn/server`** and **`@simplewebauthn/browser`** — mature, well-maintained.
- **`zod`** — request validation across API routes.
- **KV** for session tokens and rate-limit counters.
- **D1** for `users`, `presets`, `sessions`.

### Key files and components

```
src/
├── routes/
│   ├── Presets.tsx
│   └── Account.tsx             # minimal account page, expanded in phase 5
├── components/
│   ├── PresetsDrawer.tsx
│   ├── SavePresetSheet.tsx
│   └── PasskeyPrompt.tsx
├── lib/
│   ├── auth/
│   │   ├── client.ts           # registration + sign-in orchestration
│   │   ├── session.ts          # cookie read on client
│   │   └── client.test.ts
│   ├── presets.ts              # API client for presets
│   └── history-sync.ts         # import-on-register, push completed sessions
worker/
├── api/
│   ├── auth/
│   │   ├── registration.ts
│   │   ├── signin.ts
│   │   ├── signout.ts
│   │   └── me.ts               # returns current user (or null)
│   ├── presets/
│   │   ├── list.ts
│   │   ├── create.ts
│   │   ├── update.ts
│   │   ├── delete.ts
│   │   └── reorder.ts
│   ├── sessions/
│   │   ├── append.ts
│   │   └── list.ts
│   └── voice/
│       ├── parse.ts            # extended with authenticated rate-limit tier
│       └── rate-limit.ts       # extended to resolve userHandle from session
├── db/
│   ├── schema.ts
│   ├── queries.ts
│   └── migrations/             # wrangler d1 migrations apply DB
└── lib/
    └── sessionStore.ts         # KV-backed
```

### Database schema changes

**New tables:**

```sql
CREATE TABLE users (
  user_handle TEXT PRIMARY KEY,            -- random 16-byte, hex-encoded
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,     -- 0/1, set manually in phase 4
  created_at INTEGER NOT NULL              -- unix ms
);

CREATE TABLE presets (
  id TEXT PRIMARY KEY,                     -- uuid
  user_handle TEXT NOT NULL REFERENCES users(user_handle) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  work_sec INTEGER NOT NULL,
  rest_sec INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_handle TEXT NOT NULL REFERENCES users(user_handle) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL,
  total_sec INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  work_sec INTEGER NOT NULL,
  rest_sec INTEGER NOT NULL
);

CREATE INDEX idx_presets_user ON presets(user_handle, order_index);
CREATE INDEX idx_sessions_user_completed ON sessions(user_handle, completed_at DESC);
```

> **D1 cascade note:** D1 does not reliably honour `ON DELETE CASCADE` without `PRAGMA foreign_keys = ON`, which cannot be set per-connection via the D1 HTTP API. The FK declarations above are advisory. Account deletion **must** be implemented as an explicit application-level transaction in the delete handler:
>
> ```sql
> DELETE FROM sessions WHERE user_handle = ?;
> DELETE FROM presets WHERE user_handle = ?;
> DELETE FROM users WHERE user_handle = ?;
> ```
>
> The acceptance criterion at line 49 depends on this.

---

## Testing strategy

### Unit tests

- `auth/registration.test.ts` — WebAuthn registration happy path, duplicate handle, invalid attestation.
- `auth/signin.test.ts` — counter advance for platform-bound credentials, counter-zero pass-through for synced credentials (`credentialBackedUp = true`), signature verify, sign-in from a second device.
- `presets/*.test.ts` — CRUD happy paths, authorisation (user A cannot touch user B's presets).
- `history-sync.test.ts` — import batches local entries, clears local on completion.
- `voice/parse.test.ts` — authenticated rate-limit tier (30/day for registered users).

### Integration tests

- [ ] Register → sign out → sign in (same device) → presets still there.
- [ ] Register on device A → sign in on device B (simulated via shared passkey store in tests) → presets and history visible.
- [ ] Import-on-register: 7 local entries become 7 rows in `sessions`.
- [ ] Delete account: rows gone.

### Manual testing checklist

- [ ] Real iPhone: Face ID registration, sign-out, sign-in.
- [ ] Same account on MacBook via iCloud Keychain passkey sync: presets appear.
- [ ] Delete account on one device: account gone on all devices after refresh.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] WebAuthn flows tested on at least two real devices.
- [ ] D1 migrations applied via `wrangler d1 migrations apply DB --remote` (production) and `--local` (CI). Migrations live in `worker/db/migrations/`.
- [ ] No PII in any table (enforce in code review).

---

## PR workflow

**Branch:** `feature/phase-4-accounts-and-presets`
**PR title:** `Phase 4: Accounts and presets`

Use `/review-pr-team` — authentication, data model, and security implications require multi-perspective review.

---

## Edge cases and considerations

### Known risks

- **Passkey loss without sync.** Already accepted in the project outline. Communicate at registration.
- **WebAuthn user-verification quirks across platforms.** Bake in platform testing at phase start.
- **Passkey cross-ecosystem limitations.** Users in mixed ecosystems (e.g. Android phone + MacBook without iCloud) cannot sync a passkey across devices — they must register a second passkey on the new device. Communicate this at registration: "If you use different platforms, you may need to add this device separately."

### Performance considerations

- Preset list is small per user; no pagination needed.
- `sessions` grows over time; phase 5+ UI only reads last ~30 entries.

### Security considerations

- WebAuthn signature counter validated on every sign-in for platform-bound authenticators (both stored and received `counter > 0`). Synced passkeys (`credentialBackedUp = true`) return `counter = 0` by design — counter check is skipped for these. See architecture decisions above.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.
- All `/api/*` endpoints (including all Phase 4 CRUD routes) run the existing `isAllowedOrigin` check. This is the CSRF defence — do not skip it on preset or session endpoints.
- All `/api/*` endpoints except `auth/*` and `voice/parse` require an authenticated session and authorise against `userHandle` from the session, never from the request body.
- Input validation with `zod` on every endpoint.

### Accessibility considerations

- Passkey prompt explains in accessible copy what's about to happen ("Your phone will ask you to use Face ID / Touch ID").
- Drawer reorder has a keyboard-accessible alternative (move-up / move-down buttons exposed via long-press menu).

---

## Technical debt introduced

- **TD-004: `isAdmin` set by hand in D1 until phase 6.** Acceptable; only Magnus ever needs this before phase 6. Risk: Low.
- **TD-005: No account-listing admin UI yet.** Phase 6. Risk: Low.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 3 (archived)](./ARCHIVE/03-voice.md)
- [Phase 5 — i18n & polish](./05-i18n-settings-onboarding.md)
- [Phase 6 — admin & launch](./06-admin-and-launch.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
