# Implementation specifications library

Auto-loaded when working with files in this directory. Forward-looking plans for Takt's implementation.

---

## How this folder works

- **Numbered phase files** (`01-…md` through `06-…md`) are completed specs, archived in [ARCHIVE/](./ARCHIVE/). All six original web-app phases shipped. Each phase is sequential and self-contained: scope, acceptance criteria, technical approach, testing, PR workflow, risks.
- **Unnumbered feature specs** sit at the root of this folder while in progress — small post-launch features that don't belong to the original phase sequence. Same "When a phase ships" archiving rule applies once merged and verified in production, e.g. [timer-mode.md](./ARCHIVE/timer-mode.md), shipped and archived.
- **[07-android-app.md](./07-android-app.md)** is active — a Capacitor-wrapped Android release, sold on Google Play. Independent of the original six web-app phases; does not affect the live web app. It's the **umbrella spec** (north star, architecture decisions, cross-cutting criteria, risk register); the implementable detail is split across eight child specs delivered as a sequence of PRs:
  - [07a-spikes.md](./07a-spikes.md) — keep-awake / lifecycle / speech-recognition go/no-go (runs first)
  - [07b-capacitor-scaffold.md](./07b-capacitor-scaffold.md) — Capacitor + native build variant
  - [07c-auth-network-noop.md](./07c-auth-network-noop.md) — auth/network no-op on native
  - [07d-local-presets.md](./07d-local-presets.md) — device-scoped presets + native creation
  - [07e-wake-lock-native.md](./07e-wake-lock-native.md) — native keep-awake backing (gated on 07a)
  - [07f-voice-pipeline.md](./07f-voice-pipeline.md) — on-device recogniser + English parser (gated on 07a)
  - [07g-back-button-copy.md](./07g-back-button-copy.md) — back button, lifecycle, copy forks
  - [07h-publishing.md](./07h-publishing.md) — signing, store listing, Play Store publishing (admin track starts day one)
- **[ORIGINAL_IDEA/project-outline.md](./ORIGINAL_IDEA/project-outline.md)** is the source of truth for _what_ Takt is and _why_. Phase specs reference it but don't duplicate it.
- **[prototype-design-files/](./prototype-design-files/)** holds the Claude Design prototype — the visual and interaction reference for v1.
- **[ARCHIVE/](./ARCHIVE/)** receives phase files after they ship. Move them here once the PR is merged and the features are verified in production.
- **[00-TEMPLATE-phase.md](./00-TEMPLATE-phase.md)** is a blank template, kept for future phases.

Before making an architectural decision that outlasts today's PR, consult [../REFERENCE/decisions/](../REFERENCE/decisions/) for precedent. New architectural decisions get their own ADR.

---

## Active implementation phases

Full product vision: [ORIGINAL_IDEA/project-outline.md](./ORIGINAL_IDEA/project-outline.md).

**Current phase:** The original six web-app phases are complete and live, with small post-launch features (e.g. [timer-mode.md](./ARCHIVE/timer-mode.md)) shipping as unnumbered specs. [Phase 7](./07-android-app.md) — an Android app sold on Google Play — is **in progress**: `07a`–`07f` plus `07g`'s copy forks have landed and are device-verified — the native app installs, runs offline, keeps the screen awake ([`07e`](./07e-wake-lock-native.md)), does on-device voice setup with a fail-safe manual fallback ([`07f`](./07f-voice-pipeline.md)), and saves/browses device-local presets ([`07d`](./07d-local-presets.md)). Remaining: [`07g`](./07g-back-button-copy.md)'s hardware back-button + lifecycle (gated on `07e`, now unblocked) and [`07h`](./07h-publishing.md) publishing.

**Live deployment:** https://takt.hultberg.org — all six web-app phases live.

### Phase files (work through in order)

1. ~~**[01-foundation.md](./ARCHIVE/01-foundation.md)**~~ — ✅ complete
   Scaffolded Vite + React + TS SPA, single Cloudflare Worker serving both assets and API, custom domain, CI, Web Analytics, design system port. Archived.

2. ~~**[02-core-timer.md](./ARCHIVE/02-core-timer.md)**~~ — ✅ complete
   Shipped the usable tap-only timer — state machine, count-in, work/rest phases, pause/resume, skip, repeat-set, beeps, haptics (Android), Wake Lock, PWA with offline running, localStorage history, sparkline, last-session quick-start, demo mic button. Archived.

3. ~~**[03-voice.md](./ARCHIVE/03-voice.md)**~~ — ✅ complete
   Mic capture, Voice overlay, Whisper-turbo + Llama pipeline on Workers AI, anonymous rate limiting (3/day/IP), calm failure states. English only. Archived.

4. ~~**[04-accounts-and-presets.md](./ARCHIVE/04-accounts-and-presets.md)**~~ — ✅ complete
   Passkey auth, D1 schema for users/presets/sessions, presets drawer, save preset sheet, voice "save as preset", history sync with one-shot import-on-register, authenticated rate-limit tier. Archived.

5. ~~**[05-i18n-settings-onboarding.md](./ARCHIVE/05-i18n-settings-onboarding.md)**~~ — ✅ complete
   English and Swedish translations, full Settings screen (language, accent, sound, account), Onboarding flow, real Privacy policy content in both languages. Archived.

6. ~~**[06-admin-and-launch.md](./ARCHIVE/06-admin-and-launch.md)**~~ — ✅ complete
   Admin backend gated by Cloudflare Access, dashboard + user listing + delete, retention purge cron, security headers (A+), observability, soft launch. Archived.

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
4. Update "Current phase" here and in [root CLAUDE.md](../CLAUDE.md) to reflect the new status.
5. Resolve any deferred items promised in the phase spec, or track them as GitHub issues with the `technical-debt` label if they're now active.
