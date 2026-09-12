# Archived Specifications

Auto-loaded when working with files in this directory. Completed implementation phases moved here for reference.

## Completed phases

- **[01-foundation.md](./01-foundation.md)** — ✅ Vite + React + TS SPA, single Cloudflare Worker, custom domain, CI, Web Analytics, design system port.
- **[02-core-timer.md](./02-core-timer.md)** — ✅ State machine timer, count-in, work/rest phases, pause/resume, skip, beeps, haptics, Wake Lock, PWA, localStorage history, sparkline, last-session quick-start.
- **[03-voice.md](./03-voice.md)** — ✅ Mic capture, Whisper-turbo + Llama pipeline on Workers AI, anonymous rate limiting, calm failure states.
- **[04-accounts-and-presets.md](./04-accounts-and-presets.md)** — ✅ Passkey auth, D1 schema, presets drawer, history sync, authenticated rate-limit tier.
- **[05-i18n-settings-onboarding.md](./05-i18n-settings-onboarding.md)** — ✅ English + Swedish, Settings screen, Onboarding flow, Privacy policy.
- **[06-admin-and-launch.md](./06-admin-and-launch.md)** — ✅ Admin backend (Access-gated), dashboard, user delete, retention purge cron, security headers (A+), observability, soft launch.

## Post-launch features

Unnumbered specs that shipped after the six phases went live.

- **[consolidate-settings-account.md](./consolidate-settings-account.md)** — ✅ Settings and Account merged behind a single Home entry point.
- **[timer-mode.md](./timer-mode.md)** — ✅ Count-up stopwatch for rep-based exercises.
- **[dark-mode.md](./dark-mode.md)** — ✅ System / Light / Dark appearance for web and Android: design tokens, Settings control, native status bar / navigation bar / window / splash (#157, #158, #160).

---

**Note:** Archived specs are historical record. For current implementation details, see `REFERENCE/` documentation.
