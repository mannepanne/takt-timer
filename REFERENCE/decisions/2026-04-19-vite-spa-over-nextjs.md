# ADR: Vite + React SPA over Next.js for Takt

**Date:** 2026-04-19
**Status:** Active

---

## Decision

Takt is built as a Vite + React + TypeScript single-page application, served as static assets by a single Cloudflare Worker that also hosts the API. We deviate from the project-wide default (Next.js with App Router) for this project only.

## Context

Takt is a mobile-first, voice-driven interval timer. The project's default web stack is Next.js with App Router, because server-rendering and SEO are usually important. For Takt, neither matters:

- The product is an *app*, not a content site. There is no public, crawlable content to render. SEO is a non-goal.
- Every meaningful interaction is client-side: capturing microphone audio, running the timer, animating set dots, playing Web Audio beeps, taking a Screen Wake Lock.
- The backend surface is tiny: a handful of endpoints for WebAuthn registration/sign-in, presets CRUD, a Whisper + Llama voice endpoint, and rate-limit bookkeeping. A single Worker is enough.
- Hosting on Cloudflare: running Next.js on Cloudflare via `@cloudflare/next-on-pages` works but adds moving parts (adapter, bundling quirks, edge-runtime caveats). A Vite SPA served by a Worker has no such layer.

## Alternatives considered

- **Next.js (App Router) on Cloudflare Pages** with `@cloudflare/next-on-pages` — the project default. Rejected for Takt: heavy for a feature set that needs no SSR or server components, and introduces adapter complexity on a platform where a simpler path exists.
- **Astro with the Cloudflare adapter** — appealing for content-heavy sites, overkill for a pure app. No island-based content to benefit from.
- **Remix on Cloudflare Workers** — solid, but its strengths (nested routing, loaders/actions, progressive enhancement) don't line up with this app's structure. One main flow, a handful of screens, heavy client state.
- **Chosen: Vite + React + TypeScript SPA, served by a single Cloudflare Worker.** Fastest build times, simplest mental model, zero SSR machinery, a service worker for offline, and the same Worker handles both static asset serving (via Workers Assets) and API routes.

## Reasoning

- Every feature in the prototype and the outline is client-driven: screens, voice overlay, running timer, animations, audio, haptics.
- The whole point of the project is "simple and beautiful." The build system should reflect that. Vite's dev loop (instant HMR, no compile step to debug) is significantly faster than Next.js on this size of app, and that compounds over the lifetime of development.
- Cloudflare Workers Assets lets one Worker serve both the static bundle and the API with no separate build target or adapter. That collapses the deployment story to a single artefact.
- A PWA service worker is easier to reason about with a pure client bundle than with a framework that also has server-rendered pages.
- If SEO ever becomes relevant (it won't for a rehab timer), a marketing page can be added later as a separate Cloudflare Pages site on a subdomain.

## Trade-offs accepted

- **Breaks the default.** Anyone used to the Next.js default on other Magnus projects has to re-learn the shape. Mitigated by this ADR being the first thing they find when asking "why no Next.js?".
- **No built-in file-based routing.** We add a small client router (React Router or TanStack Router, decided in the frontend phase). Trivial for a handful of screens.
- **No server components, no streaming SSR.** We don't need them. If that changes, this ADR gets superseded.
- **No built-in image optimisation.** Mobile-first app with a tiny icon set — not a problem.

## Implications

- Enables: a minimal build, fast HMR, a single-artefact deploy, a simple PWA story, a clean offline model built on the service worker + IndexedDB.
- Prevents: direct reuse of server-component patterns or Next.js-specific libraries on this project. Other projects continue to use the Next.js default.

---

## References

- Related ADRs: [2026-04-19-port-prototype-css.md](./2026-04-19-port-prototype-css.md)
- Project outline: [../../SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md](../../SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md)
- Technology defaults: [../../.claude/COLLABORATION/technology-preferences.md](../../.claude/COLLABORATION/technology-preferences.md)
