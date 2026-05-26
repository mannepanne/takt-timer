# ADR: Phase 4 authentication architecture — passkeys, sessions, and counter-zero

**Date:** 2026-05-26
**Status:** Active
**Supersedes:** N/A

---

## Decision

Authenticate users with WebAuthn passkeys (`@simplewebauthn/server` + `@simplewebauthn/browser`). Store sessions server-side in Cloudflare KV, referenced by a signed HTTP-only cookie. Skip the signature-counter regression check for synced (backed-up) passkeys.

---

## Context

Phase 4 introduces optional pseudonymous accounts so users can save presets and sync session history across devices. The product's privacy posture — no PII stored, passkey loss = account loss, no recovery path — constrains the auth design heavily. Three decisions needed locking before code:

1. **What auth mechanism?** Passkeys vs. magic-link email vs. OAuth vs. username+password.
2. **How to represent server state after sign-in?** Self-contained JWT in cookie vs. KV-backed session vs. D1 session table.
3. **How to handle WebAuthn's signature counter for synced passkeys?** Strict monotonic enforcement vs. conditional skip.

---

## Alternatives considered

### Auth mechanism

- **Username + password:** Requires storing password hashes. Introduces PII (email/username). Conflicts with the privacy posture. Rejected.
- **Magic-link email:** Requires storing an email address. PII. Rejected on the same grounds.
- **OAuth (Google/GitHub):** User identity is held by the IdP; our pseudonymous `userHandle` would need to reference an OAuth subject — PII by association. Rejected.
- **Passkeys (WebAuthn):** No identifier stored except a random `userHandle` opaque to us. No PII. Meets the privacy posture. Device-local or synced via iCloud Keychain / Google Password Manager. **Chosen.**

### Session representation

- **Self-contained signed JWT in the cookie:** Fast (no KV read per request), but revocation is impossible without a denylist — sign-out across devices can't work. Rejected.
- **D1 session table:** Correct semantics but slower than KV for a read-heavy, low-payload lookup. Every authenticated request would pay a D1 query just to resolve `sessionId → userHandle`. Rejected.
- **KV-backed session, signed cookie:** Cookie contains only an opaque session ID (signed with `SESSION_COOKIE_SECRET`). The `{sessionId → userHandle, expiresAt}` lives in KV. Revocation is a single KV delete — sign-out anywhere invalidates the session everywhere. No PII in the cookie. Fast (KV reads are ~1ms). **Chosen.**

### Counter-zero for synced passkeys

- **Strict monotonic check (always reject regression):** Correct for platform-bound authenticators, but synced passkeys (iCloud Keychain, Google Password Manager, 1Password) deliberately return `counter = 0` on every assertion — per WebAuthn Level 3, counters are not reliably maintained across synced devices. Applying the check unconditionally would lock users out on their second device. Acceptance criterion "sign in on laptop via iCloud Keychain" fails. Rejected as the sole check.
- **Disable counter check entirely:** Loses the cloned-credential signal for platform-bound authenticators (where the counter genuinely advances). Rejected.
- **Conditional skip based on `credentialBackedUp` flag:** SimpleWebAuthn's verification response includes `backupEligible` and `backupState` (`credentialBackedUp`). Skip the monotonic check when `credentialBackedUp = true`; apply it when both stored and received counters are `> 0`. **Chosen.**

---

## Reasoning

**Passkeys match the privacy posture exactly.** The `userHandle` is 16 random bytes, hex-encoded, stored as the D1 primary key. Nothing links it to a person. Passkey loss means account loss — this is a feature, not a bug (no email recovery path = no PII to protect). The risk is communicated at registration.

**KV sessions are the right fit for this use case.** The only thing the session lookup needs to return is `userHandle` (32 hex chars). There is no need to store anything else server-side per-session. KV's eventual consistency (writes propagate globally within ~60s) is acceptable: sign-in lag of up to 60s on a cold edge node is unusual in practice, and sign-out lag (stale KV entry readable at another PoP after delete) is acceptable — the cookie is gone from the client, so the user can't accidentally use the stale session.

**Counter-zero handling is required for the headline acceptance criterion.** The acceptance criterion explicitly tests Face ID iPhone → iCloud Keychain laptop sign-in. Without the conditional skip, that test fails on the first cross-device sign-in attempt. The `credentialBackedUp` flag is the authoritative signal from the authenticator — it is not a workaround, it is the specified protocol.

---

## Trade-offs accepted

**KV eventual consistency on sign-in/sign-out.** A successful sign-in may not be immediately visible at every Cloudflare PoP. In practice, the SPA and the Worker are served from the same Cloudflare region and KV write propagation is fast — this is not a user-visible concern under normal conditions. Sign-out lag is accepted: the cookie is gone from the client browser, so even a stale server session cannot be exploited without the cookie.

**No session counter per user.** We don't count active sessions or enforce a maximum. A single user handle can have multiple valid KV sessions simultaneously (phone + laptop). This is intentional — Magnus is the primary user, and concurrent sessions are expected behaviour.

**Counter-zero skips the cloned-credential signal for synced passkeys.** Synced passkeys inherently cannot signal credential cloning via the counter — that signal is only meaningful for platform-bound hardware keys. We accept this limitation; it is the correct WebAuthn behaviour for the credential type.

---

## Implications

**Enables:**

- Trivial sign-out anywhere: delete the KV key.
- Multiple active sessions per user (phone + laptop) without conflict.
- Cross-device sign-in via passkey sync (iCloud Keychain, Google PM) without false lockouts.
- Privacy-preserving auth with zero PII.

**Prevents/constrains:**

- Cannot issue a "revoke all sessions" from the server without iterating KV keys by prefix — acceptable since there is no multi-device admin dashboard in Phase 4/5.
- Passkey loss without sync = account loss. Recovery path is out of scope and intentionally excluded.
- `SESSION_COOKIE_SECRET` rotation requires all existing sessions to re-authenticate. Documented as a future operational concern; acceptable for the Phase 4/5 audience (Magnus alone until public launch).

---

## References

- Phase 4 spec: [SPECIFICATIONS/04-accounts-and-presets.md](../../SPECIFICATIONS/04-accounts-and-presets.md)
- Rate-limiter ADR (user-tier key shape): [2026-05-12-kv-rate-limiter.md](./2026-05-12-kv-rate-limiter.md)
- WebAuthn Level 3 spec — counter semantics for synced credentials: https://www.w3.org/TR/webauthn-3/#sctn-sign-counter
- SimpleWebAuthn docs: https://simplewebauthn.dev
