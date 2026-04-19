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

- **TD-002** (Phase 3): Hard-coded English language hint for Whisper. Swedish arrives in Phase 5. Risk: Low.
- **TD-003** (Phase 3): IP-based rate limiter only; authenticated-user tier added in Phase 4. Risk: Low.
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
