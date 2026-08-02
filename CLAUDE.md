# CLAUDE.md

Navigation index and quick reference for working on Takt.

## Rules of engagement

Collaboration principles and ways of working: @.claude/CLAUDE.md
When asked to remember anything, add project memory in this CLAUDE.md (project root), not @.claude/CLAUDE.md.

## Project overview

**Takt** — a voice-driven, mobile-first interval timer. Tagline: _Takt — keep it going._

Built for Magnus's rehab training, released to the world because the problem — a dead-simple interval timer without the feature bloat — isn't unique to him. Voice configures a session, touch runs it, passkeys enable optional cross-device sync without storing any personal details.

**Core workflow:**

1. Tap the mic, say _"Three sets of one minute each, thirty seconds rest in between"_.
2. Confirm the parsed session on the Interpretation screen, or edit numerically.
3. Run the session with count-in, beeps, haptics, and progress bar.
4. Land on Complete; optionally "Save as preset" (registered users).

**Full specification:** [SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md](./SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md)

## Architecture overview

**Stack:**

- **Framework:** Vite + React + TypeScript (strict mode) — see [ADR 2026-04-19 — Vite SPA over Next.js](./REFERENCE/decisions/2026-04-19-vite-spa-over-nextjs.md).
- **Styling:** Ported from the Claude Design prototype's hand-written CSS, with CSS custom properties driving the accent-colour theming — see [ADR 2026-04-19 — Port prototype CSS](./REFERENCE/decisions/2026-04-19-port-prototype-css.md).
- **Hosting:** Single Cloudflare Worker with Workers Assets, serving both the SPA bundle and `/api/*` routes.
- **Database:** Cloudflare D1 for users, presets, session history.
- **Ephemeral state:** Cloudflare KV for session tokens and rate-limit counters.
- **AI inference:** Cloudflare Workers AI — Whisper-turbo for transcription, a Llama model for intent parsing. No external API keys.
- **Auth:** Passkeys (WebAuthn) for users; Cloudflare Access (Google IdP) for the admin backend.
- **Analytics:** Cloudflare Web Analytics (cookieless, privacy-preserving).
- **Domain:** `takt.hultberg.org`.
- **PWA:** Service worker + manifest, installable to home screen, a configured session runs fully offline.

**Key integrations:**

- Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo` + a Llama model) — voice pipeline.
- Cloudflare Access with Magnus's existing Google IdP policy — admin gate.
- Cloudflare Web Analytics — traffic visibility.

**Current status:** All six numbered phases complete; Takt is live at https://takt.hultberg.org and now receives post-launch feature work on top (see "Implementation phases" below).

## Implementation phases

Development is organised into six sequential phases. Each phase has its own spec with scope, acceptance criteria, testing strategy, and PR workflow.

1. ~~[01-foundation.md](./SPECIFICATIONS/ARCHIVE/01-foundation.md)~~ — ✅ complete, archived
2. ~~[02-core-timer.md](./SPECIFICATIONS/ARCHIVE/02-core-timer.md)~~ — ✅ complete, archived
3. ~~[03-voice.md](./SPECIFICATIONS/ARCHIVE/03-voice.md)~~ — ✅ complete, archived
4. ~~[04-accounts-and-presets.md](./SPECIFICATIONS/ARCHIVE/04-accounts-and-presets.md)~~ — ✅ complete, archived
5. ~~[05-i18n-settings-onboarding.md](./SPECIFICATIONS/ARCHIVE/05-i18n-settings-onboarding.md)~~ — ✅ complete, archived
6. ~~[06-admin-and-launch.md](./SPECIFICATIONS/ARCHIVE/06-admin-and-launch.md)~~ — ✅ complete, archived
7. [07-android-app.md](./SPECIFICATIONS/07-android-app.md) — 🚧 spec approved, ready to implement — Android app via Capacitor, sold on Google Play, device-scoped presets, no accounts. Umbrella spec; broken into eight child deliverables `07a`–`07h` (spikes → scaffold → auth no-op → presets → wake-lock → voice → back-button/copy → publishing), shipped as a sequence of PRs.

**Post-launch feature work:** once all six phases are live, further features get their own spec in [SPECIFICATIONS/](./SPECIFICATIONS/), outside the numbered sequence, while in progress. Once shipped and verified, it's archived like any other spec — e.g. [timer-mode.md](./SPECIFICATIONS/ARCHIVE/timer-mode.md) (count-up stopwatch for rep-based exercises; see [ADR 2026-08-02](./REFERENCE/decisions/2026-08-02-timer-mode-provider-scoped-state.md)).

**Current phase:** The original six web-app phases are complete and live, and small post-launch features ship as unnumbered specs (see above). The next larger effort — Phase 7, an Android app via Capacitor — is spec-approved and broken into eight child deliverables (`07a`–`07h`), ready to implement starting with the `07a` spikes.

**Live at:** https://takt.hultberg.org — beta version launched.

### SPECIFICATIONS/

- [01–06 phase files](./SPECIFICATIONS/ARCHIVE/) — completed phase specs (historical record).
- [ORIGINAL_IDEA/project-outline.md](./SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md) — master product spec.
- [prototype-design-files/](./SPECIFICATIONS/prototype-design-files/) — the Claude Design prototype; the visual reference for v1.
- [ARCHIVE/](./SPECIFICATIONS/ARCHIVE/) — completed phase specs.

### REFERENCE/

How-it-works documentation and operational reference:

- [testing-strategy.md](./REFERENCE/testing-strategy.md) — TDD, Vitest, coverage targets, what to mock.
- [environment-setup.md](./REFERENCE/environment-setup.md) — Cloudflare account, Wrangler, D1/KV/Workers AI setup.
- [troubleshooting.md](./REFERENCE/troubleshooting.md) — common issues (populated as we encounter them).
- [pr-review-workflow.md](./REFERENCE/pr-review-workflow.md) — how to use `/review-spec`, `/review-pr`, `/review-pr-team`.
- [auth-and-presets-api.md](./REFERENCE/auth-and-presets-api.md) — HTTP contract for auth, presets, sessions, and `/api/me/settings`.
- [voice-api-contract.md](./REFERENCE/voice-api-contract.md) — HTTP contract for `/api/voice/parse`, NDJSON events, `X-Takt-Lang` hint.
- [admin-api.md](./REFERENCE/admin-api.md) — HTTP contract for `/admin/*` routes, auth guard, user delete, retention purge endpoints.
- [cron.md](./REFERENCE/cron.md) — daily retention purge cron, criteria, `purge_runs` audit table, dry-run.
- [i18n.md](./REFERENCE/i18n.md) — `strings.ts` schema, key naming, `t()` API, testing patterns.
- [safety-harness.md](./REFERENCE/safety-harness.md) — pre-tool-use hook: blocked patterns, bypass, extending.
- [scratch-write-hook.md](./REFERENCE/scratch-write-hook.md) — Write auto-approval for `SCRATCH/`.
- [decisions/](./REFERENCE/decisions/) — Architecture Decision Records. Consult before making decisions in the same space.

_Note: CLAUDE.md files are kept short (<300 lines). Details live in subdirectory files that auto-load when relevant._

## Code conventions

### File headers

```typescript
// ABOUT: Brief description of file purpose
// ABOUT: Key functionality or responsibility
```

### Naming

- Descriptive names: `TimerMachine`, `VoiceOverlay`, `parseIntent`, not `Helper`, `Util`, `doIt`.
- TypeScript conventions: `camelCase` for variables and functions, `PascalCase` for types and components.
- Avoid temporal references: no "new", "improved", "old" in names or comments.

### Comments

- Evergreen (describe what the code does, not how it evolved).
- Minimal — prefer self-documenting code.
- Explain non-obvious decisions, hidden constraints, subtle invariants.

## Development workflow

**CRITICAL: ALL code changes require a feature branch + PR. Zero exceptions.**

**Step 0 before any changes:**

- [ ] On a feature branch, not `main`?
- [ ] Branch named `feature/`, `fix/`, or `refactor/`?

**Implementation steps:**

1. Create feature branch.
2. Read the relevant phase spec in [SPECIFICATIONS/](./SPECIFICATIONS/).
3. Run `/review-spec` for non-trivial specs before writing code.
4. Implement with tests (TDD preferred).
5. Run tests and typecheck before committing.
6. Open PR; run `/review-pr` — the dispatcher picks the tier automatically. For critical changes where you want to skip triage, use `/review-pr-team`. See [pr-review-workflow.md](./REFERENCE/pr-review-workflow.md).

## TypeScript configuration

- **Target:** ESNext (Worker runtime is modern).
- **Strict mode:** enabled — always.
- **Path alias:** `@/` maps to `./src/` (SPA code). Worker code uses relative imports because esbuild (Wrangler's bundler) doesn't honour tsconfig paths.
- **Types:** React, Vite, Cloudflare Workers types (`@cloudflare/workers-types`).

## Testing

Tests serve dual purpose:

1. **Validation** — verify code works.
2. **Directional context** — executable specifications for future work.

**Commands:**

```bash
pnpm test                # Run all tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # Coverage report
pnpm typecheck           # TypeScript type checking
```

**Coverage targets:** aim ≥95% lines/functions/statements, ≥90% branches. Enforced CI floors are currently lines 95, statements 94, functions 92, branches 88 (recalibrated for vitest 4's stricter v8 measurement; aim to restore 95/90 — tracked in issue #101). See [testing-strategy.md](./REFERENCE/testing-strategy.md).

**See:** [testing-strategy.md](./REFERENCE/testing-strategy.md) for full details.

## Quick reference links

**Planning & specs:**

- Project outline → [SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md](./SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md)
- Current phase → see "Implementation phases" above.
- Completed specs → [ARCHIVE/](./SPECIFICATIONS/ARCHIVE/)
- ADRs → [REFERENCE/decisions/](./REFERENCE/decisions/)

**Reference docs:**

- Environment setup → [environment-setup.md](./REFERENCE/environment-setup.md)
- Testing → [testing-strategy.md](./REFERENCE/testing-strategy.md)
- Technical debt → GitHub Issues with `technical-debt` label
- Troubleshooting → [troubleshooting.md](./REFERENCE/troubleshooting.md)

## Project-specific notes

- **No personal data stored.** The auth model is the privacy story. If you're about to add a field to the schema that identifies a user, stop and reconsider — this is load-bearing.
- **Passkey loss = account loss.** Deliberate. Don't add recovery codes or email fallbacks without re-discussing the privacy posture.
- **Audio operating mode:** phone face-up, screen on, Takt tab visible. Backgrounding the tab stops audio; that's a platform limit, not a bug.
- **Rate limits:** 3 voice calls/day per anonymous IP, higher for authenticated users, admin exempt. Any change here should be considered against cost (Workers AI neurons) and UX simultaneously.
- **British English** in all user-facing copy and documentation (optimise, colour, etc.).
