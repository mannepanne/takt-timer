# Implementation specifications library

Auto-loaded when working with files in this directory. Forward-looking plans for Takt's implementation.

---

## How this folder works

- **Numbered phase files** (`01-…md` through `06-…md`) are living specs. They describe what's being built _now_ or _next_. Each phase is sequential and self-contained: scope, acceptance criteria, technical approach, testing, PR workflow, risks.
- **[ORIGINAL_IDEA/project-outline.md](./ORIGINAL_IDEA/project-outline.md)** is the source of truth for _what_ Takt is and _why_. Phase specs reference it but don't duplicate it.
- **[prototype-design-files/](./prototype-design-files/)** holds the Claude Design prototype — the visual and interaction reference for v1.
- **[ARCHIVE/](./ARCHIVE/)** receives phase files after they ship. Move them here once the PR is merged and the features are verified in production.
- **[00-TEMPLATE-phase.md](./00-TEMPLATE-phase.md)** is a blank template. Kept on purpose — useful if we ever add a Phase 7.

Before making an architectural decision that outlasts today's PR, consult [../REFERENCE/decisions/](../REFERENCE/decisions/) for precedent. New architectural decisions get their own ADR.

---

## Active implementation phases

Full product vision: [ORIGINAL_IDEA/project-outline.md](./ORIGINAL_IDEA/project-outline.md).

**Current phase:** Phase 2 — Core timer (not started).

**Live deployment:** https://takt.hultberg.org — Phase 1 shell deployed 2026-04-19.

### Phase files (work through in order)

1. ~~**[01-foundation.md](./ARCHIVE/01-foundation.md)**~~ — ✅ complete
   Scaffolded Vite + React + TS SPA, single Cloudflare Worker serving both assets and API, custom domain, CI, Web Analytics, design system port. Archived.

2. **[02-core-timer.md](./02-core-timer.md)** — 5–8 days
   Usable vertical slice: manual session configuration, full Running screen, Web Audio beeps, Wake Lock, offline service worker, `localStorage` history and sparkline. No voice, no auth.

3. **[03-voice.md](./03-voice.md)** — 4–6 days
   Mic capture, Voice overlay, Whisper-turbo + Llama pipeline on Workers AI, anonymous rate limiting (3/day/IP), calm failure states. English only.

4. **[04-accounts-and-presets.md](./04-accounts-and-presets.md)** — 7–10 days
   Passkey auth, D1 schema for users/presets/sessions, presets drawer, save preset sheet, voice "save as preset", history sync with one-shot import-on-register, authenticated rate-limit tier.

5. **[05-i18n-settings-onboarding.md](./05-i18n-settings-onboarding.md)** — 4–6 days
   English and Swedish translations, full Settings screen (language, accent, sound, account), Onboarding flow, real Privacy policy content in both languages.

6. **[06-admin-and-launch.md](./06-admin-and-launch.md)** — 4–6 days
   Admin backend gated by Cloudflare Access, dashboard + user listing + delete, retention purge cron, security headers, observability, pre-launch checklist, launch.

### Supporting documentation

**[ORIGINAL_IDEA/](./ORIGINAL_IDEA/)**

- `project-outline.md` — source of truth for what Takt is, why, and the shaping decisions.

**[prototype-design-files/](./prototype-design-files/)**

- The Claude Design prototype of Takt — reference for the v1 design and interaction model.

**[ARCHIVE/](./ARCHIVE/)**

- Completed specifications (moved here when a phase is done).

**[../REFERENCE/decisions/](../REFERENCE/decisions/)**

- Architecture Decision Records. Search here before making architectural decisions (library choice, patterns, API design). Follow existing ADRs unless new information invalidates the reasoning.

---

## When a phase ships

1. PR merged to `main`, features verified in production.
2. Move the phase file to `ARCHIVE/`.
3. Update how-it-works docs in `REFERENCE/` if implementation reveals anything worth documenting for future work.
4. Update "Current phase" here and in [root CLAUDE.md](../CLAUDE.md) to point at the next phase.
5. Resolve any `TD-NNN` items promised in the phase spec, or move them to [technical-debt.md](../REFERENCE/technical-debt.md) if they're now active.
