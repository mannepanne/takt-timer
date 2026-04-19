# Takt

_Takt — keep it going._

A voice-driven, mobile-first interval timer. Tap the mic, say _"Three sets of one minute each, thirty seconds rest in between"_, run the session. No email, no phone, no personal details.

**Live at:** `takt.hultberg.org`

## What it is

Takt is for people who want a dead-simple interval timer — sets, work duration, rest duration — without the feature bloat of general-purpose fitness apps. It was built originally for rehab training, but the shape fits anything that needs a cadence.

Voice is the primary input; every voice action has a tap equivalent. Designed mobile-first and phone-only by viewport; the desktop browser renders the phone layout centred in a frame.

**Key properties:**

- Voice input parsed by Cloudflare Workers AI (Whisper + Llama) — sub-two-second round-trip for one-shot session configuration.
- Passkey-based accounts (WebAuthn). No email. No phone. No personal details.
- A configured session runs fully offline; voice requires network.
- English and Swedish.
- Cloudflare-native hosting, database, AI, analytics, and admin gate.

## Status

Phase 1 (Foundation) deployed to [takt.hultberg.org](https://takt.hultberg.org) on 2026-04-19. Phase 2 (Core timer) is next. See [SPECIFICATIONS/](./SPECIFICATIONS/) for the full six-phase plan.

## Getting started (for contributors / future Magnus)

Local development requires:

- [Node.js](https://nodejs.org/) (current LTS) and [pnpm](https://pnpm.io/) via [corepack](https://nodejs.org/api/corepack.html).
- A Cloudflare account with Workers, D1, KV, Workers AI, and Access enabled.
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) authenticated (`pnpm dlx wrangler login`).

```bash
pnpm install
pnpm dev          # Vite dev server only (front-end iteration)
pnpm dev:all      # Vite + Wrangler in parallel (full stack, SPA + /api)
pnpm test         # Vitest
pnpm typecheck    # TypeScript strict checking
pnpm deploy       # Build + deploy Worker to Cloudflare
```

Full environment configuration, secrets, and production deployment steps: [REFERENCE/environment-setup.md](./REFERENCE/environment-setup.md).

## Documentation

- [CLAUDE.md](./CLAUDE.md) — navigation index and project context.
- [SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md](./SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md) — the full product spec.
- [SPECIFICATIONS/](./SPECIFICATIONS/) — phase-by-phase implementation plans.
- [REFERENCE/decisions/](./REFERENCE/decisions/) — architecture decision records.
- [REFERENCE/](./REFERENCE/) — testing strategy, environment setup, troubleshooting.

## Design

The visual design originated with [Claude Design](https://claude.ai) and is preserved in [SPECIFICATIONS/prototype-design-files/](./SPECIFICATIONS/prototype-design-files/) as the v1 reference. Stockholm-on-Cloudflare: considered, quiet, cheap.

## License

MIT.

## Credits

- Design: produced with Claude Design from a simple brief — _"a really stylish, beautifully simple, timer app… voice controlled, that looks like it was designed in Stockholm and grew up on CloudFlare."_
- Collaboration patterns: [@obra](https://github.com/obra), [@harperreed](https://github.com/harperreed), [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/), [steipete/agent-rules](https://github.com/steipete/agent-rules).
