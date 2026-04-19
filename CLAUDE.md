# CLAUDE.md

Navigation index and quick reference for working on Takt.

## Rules of engagement

Collaboration principles and ways of working: @.claude/CLAUDE.md
When asked to remember anything, add project memory in this CLAUDE.md (project root), not @.claude/CLAUDE.md.

## Project overview

**Takt** — a voice-driven, mobile-first interval timer. Tagline: *Takt — keep it going.*

Built for Magnus's rehab training, released to the world because the problem — a dead-simple interval timer without the feature bloat — isn't unique to him. Voice configures a session, touch runs it, passkeys enable optional cross-device sync without storing any personal details.

**Core workflow:**
1. Tap the mic, say *"Three sets of one minute each, thirty seconds rest in between"*.
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

**Current status:** Planning complete. Specs and ADRs written. Implementation starts at Phase 1.

## Implementation phases

Development is organised into six sequential phases. Each phase has its own spec with scope, acceptance criteria, testing strategy, and PR workflow.

1. [01-foundation.md](./SPECIFICATIONS/01-foundation.md) — scaffolding, domain, CI, design system port (3–5 days)
2. [02-core-timer.md](./SPECIFICATIONS/02-core-timer.md) — usable tap-only timer with offline PWA (5–8 days)
3. [03-voice.md](./SPECIFICATIONS/03-voice.md) — Whisper + Llama voice pipeline (4–6 days)
4. [04-accounts-and-presets.md](./SPECIFICATIONS/04-accounts-and-presets.md) — passkey auth, presets, history sync (7–10 days)
5. [05-i18n-settings-onboarding.md](./SPECIFICATIONS/05-i18n-settings-onboarding.md) — English + Swedish, Settings, Onboarding, Privacy policy (4–6 days)
6. [06-admin-and-launch.md](./SPECIFICATIONS/06-admin-and-launch.md) — admin backend, retention purge, hardening, launch (4–6 days)

**Current phase:** Phase 1 — Foundation (not started).

### SPECIFICATIONS/
- [01–06 phase files](./SPECIFICATIONS/) — active work-in-progress specs.
- [ORIGINAL_IDEA/project-outline.md](./SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md) — master product spec.
- [prototype-design-files/](./SPECIFICATIONS/prototype-design-files/) — the Claude Design prototype; the visual reference for v1.
- [ARCHIVE/](./SPECIFICATIONS/ARCHIVE/) — completed phase specs.

### REFERENCE/
How-it-works documentation and operational reference:
- [testing-strategy.md](./REFERENCE/testing-strategy.md) — TDD, Vitest, coverage targets, what to mock.
- [environment-setup.md](./REFERENCE/environment-setup.md) — Cloudflare account, Wrangler, D1/KV/Workers AI setup.
- [technical-debt.md](./REFERENCE/technical-debt.md) — accepted shortcuts and deferred improvements.
- [troubleshooting.md](./REFERENCE/troubleshooting.md) — common issues (populated as we encounter them).
- [pr-review-workflow.md](./REFERENCE/pr-review-workflow.md) — how to use `/review-spec`, `/review-pr`, `/review-pr-team`.
- [decisions/](./REFERENCE/decisions/) — Architecture Decision Records. Consult before making decisions in the same space.

*Note: CLAUDE.md files are kept short (<300 lines). Details live in subdirectory files that auto-load when relevant.*

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
6. Open PR; use `/review-pr` for routine changes, `/review-pr-team` for architecture- or security-sensitive work. See [pr-review-workflow.md](./REFERENCE/pr-review-workflow.md).

## TypeScript configuration

- **Target:** ESNext (Worker runtime is modern).
- **Strict mode:** enabled — always.
- **Path alias:** `@/` maps to `./src/` (SPA code); `@worker/` maps to `./worker/` (Worker code).
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

**Coverage targets:** ≥95% lines/functions/statements, ≥90% branches.

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
- Technical debt → [technical-debt.md](./REFERENCE/technical-debt.md)
- Troubleshooting → [troubleshooting.md](./REFERENCE/troubleshooting.md)

## Project-specific notes

- **No personal data stored.** The auth model is the privacy story. If you're about to add a field to the schema that identifies a user, stop and reconsider — this is load-bearing.
- **Passkey loss = account loss.** Deliberate. Don't add recovery codes or email fallbacks without re-discussing the privacy posture.
- **Audio operating mode:** phone face-up, screen on, Takt tab visible. Backgrounding the tab stops audio; that's a platform limit, not a bug.
- **Rate limits:** 3 voice calls/day per anonymous IP, higher for authenticated users, admin exempt. Any change here should be considered against cost (Workers AI neurons) and UX simultaneously.
- **British English** in all user-facing copy and documentation (optimise, colour, etc.).
