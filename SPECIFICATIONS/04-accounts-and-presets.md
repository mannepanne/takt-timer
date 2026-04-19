# Phase 4: Accounts and presets

## Phase overview

**Phase number:** 4
**Phase name:** Accounts and presets — passkey auth, preset management, history sync
**Estimated timeframe:** 7–10 days
**Dependencies:** Phase 3 (Voice) complete.

**Brief description:**
Introduce pseudonymous accounts via passkeys, enable saving and managing presets, and sync session history to D1 for registered users. Wire voice "save as preset" into the existing voice pipeline. Add an authenticated rate-limit tier so registered users rarely hit caps.

---

## Scope and deliverables

### In scope

- [ ] Passkey registration flow (WebAuthn) using `@simplewebauthn/server` on the Worker and `@simplewebauthn/browser` in the SPA.
- [ ] Passkey sign-in flow.
- [ ] D1 schema: `users`, `presets`, `sessions` tables (see below).
- [ ] Session management: signed, HTTP-only, `SameSite=Lax` cookie containing a server-issued session ID. Server stores `sessionId → userHandle` in KV with a rolling 30-day TTL.
- [ ] Registration offers the one-shot local-history import: *"Bring your N sessions with you?"*. Accept writes rows to `sessions`; either choice clears the local history after the flow.
- [ ] Presets drawer (ported from `presets-settings.jsx`): list, create, edit, delete, pin, reorder (long-press drag), duplicate, run.
- [ ] Save preset sheet reachable from Complete ("Save as preset") and from Presets drawer ("Create").
- [ ] Complete screen regains the "Save as preset" action for authenticated users. Anonymous users still see only "Run it again" / "Done" with a "Sign in to save" hint.
- [ ] Home's "last session" card: for authenticated users, populated from the server; for anon, from localStorage (unchanged).
- [ ] Voice "save as preset" command wired into `/api/voice/parse`: if the transcript matches a save-intent pattern, the Llama prompt returns `{ intent: "save_preset", name: string, ...sessionFields? }`. Client routes save-intent responses to the save-preset flow.
- [ ] Authenticated rate-limit tier for `/api/voice/parse`: default 30/day (configurable). Anonymous remains 3/day. Admin exempt (flag is set but the admin backend itself is phase 6 — for now, `isAdmin` can be toggled via a manual D1 update).
- [ ] Sign-out: clears cookie and session in KV.
- [ ] Account deletion action (also surfaced in phase 5's Settings): hard-deletes the user, presets, and sessions.
- [ ] Service worker updated: cached user presets and recent history for offline read; mutations while offline queue and flush on reconnection.

### Out of scope

- Internationalisation (phase 5).
- Full Settings screen (phase 5).
- Onboarding screen (phase 5).
- Admin backend (phase 6).
- Retention purge cron (phase 6).

### Acceptance criteria

- [ ] Magnus can create an account on his phone using Face ID, then sign in on his laptop via iCloud Keychain passkey sync.
- [ ] His 7 local sessions from phase 2/3 use are offered for import and appear in D1 after accepting.
- [ ] He can say *"Save this as basic rehab pattern"* after configuring a session, and the preset appears in his drawer.
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

**Voice "save as preset" reuses `/api/voice/parse`**
- Choice: one endpoint, discriminated by an `intent` field on the response. The Llama prompt classifies the transcript as either `configure_session` or `save_preset` (with name).
- Rationale: single code path, single rate-limit counter, simpler client.

**Passkey `userHandle` is a random 16-byte value (not a database id)**
- Stored as primary key of `users`. No link to anything that identifies the user.

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
│   ├── history-sync.ts         # import-on-register, push completed sessions
│   └── offline-queue.ts        # queues mutations while offline
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
│       └── parse.ts            # extended with intent=save_preset handling
├── db/
│   ├── schema.ts
│   └── queries.ts
└── lib/
    ├── sessionStore.ts         # KV-backed
    └── rateLimit.ts            # extended to read userHandle
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

---

## Testing strategy

### Unit tests

- `auth/registration.test.ts` — WebAuthn registration happy path, duplicate handle, invalid attestation.
- `auth/signin.test.ts` — counter advance, signature verify, sign-in from a second device.
- `presets/*.test.ts` — CRUD happy paths, authorisation (user A cannot touch user B's presets).
- `history-sync.test.ts` — import batches local entries, clears local on completion.
- `offline-queue.test.ts` — queues while offline, flushes in order on reconnect.
- `voice/parse.test.ts` — extended: `save_preset` intent path returns the right shape.

### Integration tests

- [ ] Register → sign out → sign in (same device) → presets still there.
- [ ] Register on device A → sign in on device B (simulated via shared passkey store in tests) → presets and history visible.
- [ ] Import-on-register: 7 local entries become 7 rows in `sessions`.
- [ ] Delete account: rows gone.

### Manual testing checklist

- [ ] Real iPhone: Face ID registration, sign-out, sign-in.
- [ ] Same account on iPad via iCloud Keychain: presets appear.
- [ ] Same account on desktop Chrome via Google Password Manager passkey: presets appear.
- [ ] Voice "save this as basic rehab pattern" creates the preset.
- [ ] Delete account on one device: account gone on all devices after refresh.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] WebAuthn flows tested on at least two real devices.
- [ ] D1 migrations run cleanly against a fresh database.
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
- **Mutation ordering in the offline queue.** If the user edits a preset offline, then deletes it offline, replay order matters. Solve with a single queue in submission order.

### Performance considerations

- Preset list is small per user; no pagination needed.
- `sessions` grows over time; phase 5+ UI only reads last ~30 entries.

### Security considerations

- WebAuthn signature counter validated on every sign-in; regressions signal cloned credentials.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.
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
- [Phase 3](./03-voice.md)
- [Phase 5 — i18n & polish](./05-i18n-settings-onboarding.md)
- [Phase 6 — admin & launch](./06-admin-and-launch.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
