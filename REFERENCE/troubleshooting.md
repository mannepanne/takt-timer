# Troubleshooting guide

**When to read this:** Hitting a problem during local development, deployment, or production. Populated as issues are encountered.

**Related documents:**
- [CLAUDE.md](../CLAUDE.md) — project navigation.
- [environment-setup.md](./environment-setup.md) — environment configuration.
- [technical-debt.md](./technical-debt.md) — known limitations.

---

Append new entries here as you encounter and solve issues. Each entry: symptom, cause, resolution. Keep it terse.

---

## Local development

### Wrangler not authenticated

**Symptom:** `pnpm dev` fails with "not authenticated" or cannot find the account.

**Resolution:**
```bash
pnpm dlx wrangler login
pnpm dlx wrangler whoami
```
Make sure `whoami` shows the Cloudflare account that owns the Takt resources.

### `.dev.vars` not loading

**Symptom:** `SESSION_COOKIE_SECRET` (or similar) is undefined at runtime.

**Resolution:**
- File is at the repo root (same level as `wrangler.toml`).
- Restart `pnpm dev` after editing.
- Check for accidental quotes around values — Wrangler takes them literally.

### Port in use

**Symptom:** `pnpm dev` fails to bind.

```bash
lsof -ti:8787 | xargs kill -9   # Replace with whichever port Wrangler reports
```

### TypeScript cache staleness

**Symptom:** `pnpm typecheck` reports errors for code that looks fine; a clean checkout is green.

```bash
rm -rf node_modules/.cache
pnpm typecheck
```

### Tests failing only in CI

**Symptom:** Green locally, red in CI.

Usual causes:
- Node version mismatch — pin the version in `.github/workflows/ci.yml` and `engines` in `package.json`.
- Environment variables not set in CI (e.g. `WEBAUTHN_RP_ID`).
- Timezone — tests that compare timestamps need to use `Date.now()` from a mocked clock, not real time.

---

## Cloudflare / deployment

### `wrangler deploy` fails with "no bindings"

**Symptom:** Deploy rejects because D1 / KV / Workers AI binding is missing.

**Resolution:** Check `wrangler.toml` against the resources listed in [environment-setup.md](./environment-setup.md). IDs must match the active account's resources.

### Production secret missing

```bash
pnpm dlx wrangler secret list
pnpm dlx wrangler secret put <NAME>
```

### D1 migration refuses to apply

**Symptom:** "migration already applied" or hash mismatch.

**Resolution:**
- Never edit an applied migration. Create a new one.
- If a local dev DB is out of sync, consider resetting it — never reset production.

### Access denies a supposedly allowed account

**Symptom:** Visiting `/admin` with Magnus's Google account returns 403 from Cloudflare Access.

**Resolution:** The Access application config lives in the Cloudflare dashboard, not in code. Verify the policy includes the right email and that the session cookie is valid (sign out of Access and back in).

---

## Voice pipeline

### Mic permission "permanently" denied on Safari

**Symptom:** The mic button shows the permission-denied state even after granting permission in Settings.

**Resolution:** Safari caches the denial aggressively. On iOS, Settings → Safari → Clear History and Website Data for the specific origin, or toggle the mic permission for the origin. Usually this is a user-side issue; document it in the UI for future users.

### Whisper returns empty transcript

**Symptom:** Voice call succeeds but transcript is `""`.

**Resolution:**
- Verify the audio blob is non-trivial (`blob.size > 5000` is a sensible floor).
- Check `MediaRecorder` MIME type — some combinations produce silent audio. `audio/webm;codecs=opus` is the known-good default.
- Very short recordings (<0.5s) can silently return nothing; enforce a minimum duration client-side.

### Llama returns invalid JSON

**Symptom:** `/api/voice/parse` logs "zod validation failed" repeatedly.

**Resolution:**
- Check the prompt hasn't drifted — the `strict JSON only, no prose` instruction is load-bearing.
- The phase 3 retry-once fallback catches most of these. If it's persistent, pick a larger model for a session.

---

## Timer / audio

### Audio silent on iOS

**Symptom:** Beeps don't play.

**Resolution:**
- iOS requires `AudioContext` to be resumed from a user gesture. The lazy `getAudio()` wrapper must be called first on a tap handler, not from effect code.
- Silent switch does *not* silence Web Audio; it does silence HTML audio elements. Use Web Audio only.

### Timer pauses when backgrounded

**Symptom:** Session appears to "freeze" when Safari tab is hidden.

**Resolution:** Platform limit, not a bug — documented operating mode ("phone face-up, screen on, tab visible"). The state machine correctly resumes on visibility change.

### Wake Lock not acquired

**Symptom:** Phone auto-locks mid-session.

**Resolution:**
- Verify `navigator.wakeLock` is available (some browsers don't support it; we degrade silently).
- On iOS, Wake Lock requires the tab to be foregrounded. This is expected.

---

## WebAuthn / passkeys

### Registration succeeds but sign-in fails

**Symptom:** Can create the account, but sign-in returns "unknown credential".

**Resolution:**
- `WEBAUTHN_RP_ID` mismatch between registration and sign-in — must be identical and match the origin.
- Passkey stored on a different browser profile than the one attempting sign-in.

### Second-device sign-in fails

**Symptom:** Registered on device A, cannot sign in on device B.

**Resolution:** iCloud Keychain / Google Password Manager sync isn't instant and may not be enabled. The user must explicitly opt in to cloud passkey sync on the creating device.

---

## Git and CI

### CI fails on coverage threshold

**Symptom:** Tests pass but CI marks the PR red on coverage.

**Resolution:** Run `pnpm test:coverage` locally and open `coverage/index.html`. Add tests for the uncovered lines or, if justified, lower the per-file threshold in the phase's PR with an explanation.

### Secrets accidentally committed

1. Rotate the secret immediately.
2. Rewrite history with `git filter-repo` (preferred over `git filter-branch`).
3. Force-push, warn anyone with a checkout to reset.
4. Update `.gitignore` to prevent recurrence.

---

## When all else fails

1. Minimal reproduction — what's the smallest case that fails?
2. Check logs — `pnpm dlx wrangler tail` for production, browser devtools for the client.
3. Check recent changes — `git log`, `git diff`.
4. Ask. Describe the problem, the reproduction, and what you've already tried.
