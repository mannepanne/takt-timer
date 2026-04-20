# Technical debt tracker

**When to read this:** Planning a refactor, deciding whether to fix something now or later, or documenting an accepted shortcut at the end of a phase.

**Related documents:**

- [CLAUDE.md](../CLAUDE.md) — project navigation.
- [testing-strategy.md](./testing-strategy.md) — coverage expectations.
- [troubleshooting.md](./troubleshooting.md) — operational issues.

---

Tracks known limitations, accepted shortcuts, and deferred improvements in Takt. Items here are deliberate decisions, not bugs.

---

## How it works

- Each item has an ID: `TD-001`, `TD-002`, etc. IDs are allocated sequentially — once given, never reused.
- Phase specs may declare _anticipated_ debt (e.g. "TD-002 will be introduced in Phase 3 — English-only Whisper hint, resolved in Phase 5"). When the phase lands, the item moves from the phase spec into this tracker.
- Low-risk items can live here indefinitely. High-risk items should have a resolution phase.

---

## Active technical debt

### TD-008: D1 and migration runner deferred to Phase 4

- **Location:** `migrations/` (empty), `wrangler.toml` (D1 binding commented out).
- **Issue:** The Phase 1 spec scoped provisioning a D1 database and setting up a migration runner. Phase 1 shipped without either; both land with Phase 4 (Accounts and presets), alongside the schema they need.
- **Why accepted:** Installing a migration tool with no migrations, and provisioning a D1 database with no tables, was work without benefit. Phase 4 installs `drizzle-orm` + `drizzle-kit` in the same breath as defining the schema they manage.
- **Risk:** Low. Phase 4 has more scope than Phase 1 pushed onto it, but the scope is coherent.
- **Resolution phase:** Phase 4.

### TD-009: GitHub Actions pinned to mutable tags, not SHAs

- **Location:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- **Issue:** `actions/checkout@v4`, `actions/setup-node@v4`, and `cloudflare/wrangler-action@v3` are tag-pinned, not SHA-pinned. The deploy workflow holds `CLOUDFLARE_API_TOKEN`; a malicious retag of any action would expose the token on the next deploy.
- **Why accepted:** Low likelihood for a solo-maintainer project; SHA-pinning plus Dependabot is a meaningful maintenance overhead for the current threat model.
- **Risk:** Low (with high impact if realised).
- **Resolution phase:** Revisit before Phase 6 public launch. If keeping a public-facing service beyond launch, SHA-pin + enable Dependabot.

### TD-010: `'unsafe-inline'` in CSP `style-src`

- **Location:** `worker/lib/securityHeaders.ts` — CSP directive list.
- **Issue:** The baseline CSP allows `'unsafe-inline'` on `style-src` because `src/routes/*.tsx` use inline `style={{…}}` objects (ported from the prototype's JSX patterns). Inline styles permit some CSS-injection attack patterns.
- **Why accepted:** Porting every inline style to CSS classes is scope creep for Phase 1.5. The baseline CSP is the posture documented in the Phase 1 spec.
- **Risk:** Low at this stage (no auth, no user-generated content). Rises when Phase 4 ships passkey UI.
- **Resolution phase:** Remove `'unsafe-inline'` from `style-src` before Phase 4 ships WebAuthn ceremony UI. Port inline styles to CSS classes (or CSS Modules) as part of Phase 2 or Phase 4 preparation.

### TD-011: No dependency-vulnerability scanning in CI

- **Location:** `.github/workflows/ci.yml`.
- **Issue:** CI doesn't run `pnpm audit` or equivalent, and Dependabot isn't configured. Vulnerable transitive deps can land silently.
- **Why accepted:** Phase 1 has a tiny dependency surface and no auth/crypto code; the risk is low until real user data flows through.
- **Risk:** Low for now, rises with each phase.
- **Resolution phase:** Phase 4, when auth and WebAuthn libraries enter the dep tree.

### TD-016: iOS Safari Whisper misclassifies Swedish as Icelandic

- **Location:** Observed at the `/api/voice/parse` endpoint; specifically `worker/api/voice/parse.ts` language-gate block (`SUPPORTED_LANGUAGES`) and the Llama system prompt in `worker/api/voice/llama.ts`.
- **Issue:** iOS Safari's Whisper path routinely transcribes Swedish speech with Icelandic phonology ("åtta" → "ótta", "sekunder" → "sekundar", "fyrtiofem" → "fyrtífem", "tio" → "tíu"). The language gate accepts `is` (Nordic cousin) so the call reaches Llama, but Llama's Swedish numeral table doesn't cover Icelandic spellings. Result: parsed numbers are sometimes wrong. Real-device bake-off observed ~50% wobble rate on Swedish phrases on iOS; Android and English on all platforms are unaffected.
- **Why accepted:** The root cause is "no `language` hint passed to Whisper" — and we can't pass one until Phase 5 Settings gives us a user preference (auto-detect is needed for the language gate until then). Interpretation screen shows the parsed session before the timer starts, so users notice and edit wrong numbers. Phase 3 proper adds an interim mitigation (conditional prompt enrichment for `language === 'is'` + Icelandic numeral tokens).
- **Risk:** **Low for English/Android; Medium for Swedish on iOS.** English is the default and is rock-solid on both platforms.
- **Resolution phase:** Phase 3 proper ships the prompt-enrichment interim; Phase 5 Settings resolves the root cause by passing `language: 'sv'` to Whisper when the user has selected Swedish.
- **Future fix:** `whisper.ts` gains an optional `language` param sourced from user preference; the Nordic-cousins gate can narrow back to `{en, sv}` at that point.

### TD-015: KV eventually-consistent rate-limit race

- **Location:** `worker/api/voice/rate-limit.ts` — the `get` → `put` sequence in `checkAndIncrementRateLimit`.
- **Issue:** KV reads are eventually consistent. Under concurrent requests from the same IP, two workers can each read `current = N` before either writes `N + 1`, letting ~1-2 extra calls slip per IP before the counter catches up.
- **Why accepted:** Bounded impact (single-digit extra calls per IP per day) against a cost-control limiter that's already a guard rather than a hard ceiling. Durable Objects would give strict consistency but are overkill for 3-per-day semantics.
- **Risk:** Low. Attacker parallelising from one IP gains at most ~2 extra Workers AI calls before the counter settles.
- **Resolution phase:** Revisit with Phase 4 authenticated tier — the threat model changes when we're protecting authenticated users' personal caps rather than an anonymous IP-wide aggregate.
- **Future fix:** If revisit is warranted, move to Durable Objects per IP-hash, or route the authenticated-tier counters through D1 (strongly consistent).

### TD-017: Minimum-viable rate limiter in place of the Phase 3 proper design

- **Location:** `worker/api/voice/rate-limit.ts`, `worker/api/voice/parse.ts` (the `checkAndIncrementRateLimit` call).
- **Issue:** The Phase 3 spike ships a coarse 20/day-per-IP-hash KV-backed limiter — a cost-control guard, not the Phase 3 proper design. Missing: tuned 3/day anonymous cap, authenticated-user tier (Phase 4 dependency), `retryAfter` UX copy, dev-bypass flag, and the `ALLOW_RATE_LIMIT_BYPASS` env var support the spec calls for.
- **Why accepted:** Size cap + origin check alone only reduce cost-per-abuse; the limiter is what caps total spend. Landing even a coarse limiter with the spike closes the live exposure. The full design lands with Phase 3 proper alongside the KV-vs-native Rate Limiting ADR.
- **Risk:** Low. 20/day is permissive enough that legitimate users won't hit it during the spike, strict enough to cap adversarial abuse at a predictable daily neuron spend.
- **Resolution phase:** Phase 3 proper.
- **Future fix:** Replace with the full limiter: 3/day anonymous, higher authenticated tier (Phase 4), dev-bypass flag, `retryAfter` UX, and an ADR covering KV's eventual-consistency race. The call site in `parse.ts` should survive unchanged; only `rate-limit.ts` needs to rewrite.

### TD-001: Sound toggle lives on the Running screen, not in Settings

- **Location:** `src/routes/Run.tsx` — top-right toggle; preference persisted in `takt.sound.v1`.
- **Issue:** Phase 2 shipped a sound on/off control on the Running screen rather than Settings, because Settings does not yet exist.
- **Why accepted:** Phase 5 adds the Settings screen; moving the control then is the natural home.
- **Risk:** Low.
- **Resolution phase:** Phase 5.

### TD-012: Count-in duration fixed at 3s

- **Location:** `src/lib/timer/types.ts` — `phaseTotalSec` returns `3` for `countIn`.
- **Issue:** Count-in is hard-coded rather than user-configurable.
- **Why accepted:** 3s is the sensible default; making it configurable before Settings ships would be scope-creep.
- **Risk:** Low.
- **Resolution phase:** Phase 5 — move to Settings as a user-adjustable preference.

---

## Anticipated debt by phase

These are debt items declared in phase specs that will become active when the phase ships. Listed here for forward visibility.

- **TD-002** (Phase 3, partial): Settings toggle for language choice is deferred to Phase 5. The pipeline itself validates both English and Swedish in Phase 3. Risk: Low.
- **TD-003** (Phase 3): IP-based rate limiter only; authenticated-user tier added in Phase 4. Risk: Low.
- **TD-013** (Phase 3): Language toggle UI not shipped — pipeline handles en/sv, UI choice lands Phase 5. Risk: Low.
- **TD-014** (Phase 3): Silence detection / VAD deferred — hard 8s cap + manual stop only. Risk: Low. Resolution: Phase 5+ if user feedback warrants.
- **TD-004** (Phase 4): `isAdmin` flag set by hand in D1 until Phase 6 automates it. Acceptable because only Magnus needs admin before Phase 6. Risk: Low.
- **TD-005** (Phase 4): No admin UI yet; users table inspected via direct D1 queries until Phase 6. Risk: Low.
- **TD-006** (Phase 5): Missing-i18n-key warning is log-only, not a build-time check. Acceptable for two languages; revisit if a third lands. Risk: Low.

---

## Resolved items

### TD-007: `@worker/*` TypeScript path alias — resolved 2026-04-19 (PR #3)

- **Location:** `tsconfig.worker.json`, `vitest.config.ts`.
- **Issue:** The alias resolved in Vitest (via `vitest.config.ts`) but not in production (Wrangler's esbuild doesn't honour tsconfig paths). Tests could pass while the Worker bundle broke.
- **Resolution:** Alias removed from both places. Worker code uses relative imports exclusively.

---

## Entry format

```markdown
### TD-NNN: Short description

- **Location:** `path/to/file.ts` — `functionName`
- **Issue:** What limitation or shortcut exists.
- **Why accepted:** The reasoning at the time.
- **Risk:** Low / Medium / High.
- **Resolution phase:** Phase number, or "open" if deliberately indefinite.
- **Future fix:** How to address it when the time comes.
```
