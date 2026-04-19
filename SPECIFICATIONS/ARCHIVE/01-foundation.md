# Phase 1: Foundation

## Phase overview

**Phase number:** 1
**Phase name:** Foundation — infrastructure and app shell
**Estimated timeframe:** 3–5 days
**Dependencies:** None (starting phase)

**Brief description:**
Stand up the skeleton: a deployable Vite + React + TypeScript SPA served by a single Cloudflare Worker that also hosts the API. Domain live, CI green, design system ported from the prototype, analytics wired. No product features yet — this phase delivers an empty, beautiful shell we can build into.

---

## Scope and deliverables

### In scope

- [ ] Vite + React + TypeScript project scaffolded in `/src`, configured with strict mode.
- [ ] Single Cloudflare Worker (using Workers Assets) that serves both the built SPA and `/api/*` routes.
- [ ] Wrangler configuration (`wrangler.toml`), environment bindings declared (D1, Workers AI, KV — created even if unused this phase).
- [ ] D1 database provisioned, empty migration runner set up (e.g. `drizzle-kit` or raw SQL + a small migration script — decide at start of phase).
- [ ] Custom domain `takt.hultberg.org` attached, HTTPS verified.
- [ ] Deploy pipeline: pushes to `main` deploy to production; PR branches deploy to a preview URL.
- [ ] Prototype CSS ported to `/src/styles.css` (or equivalent), CSS custom properties preserved.
- [ ] Typography loaded: Figtree + JetBrains Mono via `<link>` (per prototype).
- [ ] App shell components ported from prototype: `Wordmark`, `TopBar`, icon set from `icons.jsx` rewritten as typed React components.
- [ ] Phone-frame layout wrapper for desktop viewports (centres the phone-shaped canvas, matches `ios-frame.jsx`).
- [ ] Client-side router (React Router v6 or TanStack Router — decided at start of phase) with routes for `/`, `/privacy` (stub).
- [ ] Privacy policy page stub: the page exists and is linked from the footer of Home, but contains placeholder copy only.
- [ ] Cloudflare Web Analytics snippet added to `index.html`.
- [ ] Vitest + Testing Library set up, smoke tests for the shell components.
- [ ] ESLint + Prettier + TypeScript strict mode, pre-commit hook (`husky` or `lefthook`) running lint + typecheck + tests.
- [ ] GitHub Actions CI: lint, typecheck, test on every PR.
- [ ] README updated with local-dev instructions; `REFERENCE/environment-setup.md` updated with Cloudflare account details, Wrangler setup, required secrets.

### Out of scope

- Any user-facing feature (mic, timer, presets, settings).
- D1 schema beyond an empty database.
- Voice API, Workers AI calls.
- Authentication of any kind.
- Privacy policy content (stub page only).
- Onboarding.

### Acceptance criteria

- [x] `pnpm dev` (or equivalent) starts the Vite dev server with hot reload.
- [x] `pnpm deploy` publishes to production; `takt.hultberg.org` renders the wordmark, an empty Home placeholder, and the phone-frame on desktop.
- [x] Lighthouse on mobile scores ≥90 for Performance and ≥95 for Accessibility on the empty shell. (Final: 93 / 100 / 100 / 100.)
- [x] CI green: lint passes, typecheck passes, tests pass with ≥95% line/function/statement coverage and ≥90% branch coverage on the (small) code that exists.
- [x] Cloudflare Web Analytics shows the first pageview.

**Removed from scope (2026-04-19):** the _"PR opened against main gets a preview URL automatically"_ criterion. Decision: local review against `pnpm dev` / `pnpm dev:all` is sufficient for this project's size and team (one developer plus AI). Preview URLs add CF account clutter and deploy-pipeline complexity without a proportional benefit. Revisit only if the team grows or the surface area of per-PR visual regressions becomes significant.

---

## Technical approach

### Architecture decisions

**Single Worker with Workers Assets serves both SPA and API**

- Choice: one Worker, one bundle, one deploy. Static assets served via Workers Assets, API routes on `/api/*`.
- Rationale: fewer moving parts, single custom-domain configuration, unified observability.
- Alternatives considered: Cloudflare Pages + separate Worker (two deploy targets), Pages Functions (ties the API to Pages lifecycle). Neither buys us anything for a project this size.

**Client router and migration library chosen at phase start, not now**

- These are small, reversible decisions. Pick once, document the choice in the PR description. No ADR needed unless the discussion runs long.

### Technology choices

- **Vite 5+** as the build tool. Rationale: fastest dev loop, ESM-native, well supported on Cloudflare.
- **React 18+** with function components and hooks (matches the prototype).
- **TypeScript strict mode** — always.
- **Vitest** for unit and component tests (matches the wider project's stated default).
- **Wrangler** (latest) for Cloudflare deployment.
- **Drizzle ORM** (provisional) for D1 — strongly typed, small runtime, plays well with D1. Confirmed or swapped at phase start.

### Key files and components

**New files to create (illustrative, not exhaustive):**

```
/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css              # ported from prototype
│   ├── components/
│   │   ├── Wordmark.tsx
│   │   ├── TopBar.tsx
│   │   ├── PhoneFrame.tsx
│   │   └── icons/              # one file per icon, typed
│   ├── routes/
│   │   ├── Home.tsx            # empty placeholder this phase
│   │   └── Privacy.tsx         # stub
│   └── lib/
│       └── router.ts
├── worker/
│   ├── index.ts                # Worker entry, serves assets + /api
│   └── api/
│       └── health.ts           # /api/health returns OK
├── migrations/
│   └── 0000_init.sql           # empty or schema stub
└── .github/workflows/ci.yml
```

### Database schema changes

No application schema this phase. The D1 database is provisioned and the migration runner is set up so phase 2 and beyond can evolve the schema cleanly.

---

## Testing strategy

### Unit tests

**Coverage targets:** per project default (lines/functions/statements ≥95%, branches ≥90%).

**Key test files:**

- `Wordmark.test.tsx` — renders text and bar.
- `TopBar.test.tsx` — slots render, wordmark present.
- `PhoneFrame.test.tsx` — desktop viewport shows frame, mobile viewport does not.
- `worker/api/health.test.ts` — returns `200 OK`.

### Integration tests

- [ ] Build succeeds end-to-end (`pnpm build`).
- [ ] `wrangler dev` serves the SPA and `/api/health` together on one port.

### Manual testing checklist

- [ ] Visit `takt.hultberg.org` on an iPhone and an Android phone — phone-sized layout, no horizontal scroll, fonts load.
- [ ] Visit on a desktop browser — phone-frame centred on the page, content sized correctly inside.
- [ ] HTTPS padlock, no mixed content warnings.
- [ ] Analytics pageview recorded in the Cloudflare dashboard.

---

## Pre-commit checklist

- [ ] All tests passing (`pnpm test`).
- [ ] Type checking passes (`pnpm typecheck`).
- [ ] Coverage meets targets (`pnpm test:coverage`).
- [ ] Lint passes (`pnpm lint`).
- [ ] No `console.log`, no commented-out code.
- [ ] No secrets in the repo; required secrets documented in `REFERENCE/environment-setup.md`.
- [ ] README's "getting started" section verified by running it fresh.

---

## PR workflow

**Branch:** `feature/phase-1-foundation`
**PR title:** `Phase 1: Foundation`

Use `/review-pr-team` — this phase has architectural impact (deploy pipeline, domain config, CI).

**Deployment steps:**

1. Merge to `main`.
2. GitHub Actions builds and runs `wrangler deploy`.
3. Verify `takt.hultberg.org/api/health` returns OK.
4. Verify analytics records the production pageview.

---

## Edge cases and considerations

### Known risks

- **Wrangler / Workers Assets API surface changes.** Cloudflare's asset-serving story evolves. Mitigation: pin versions, document exact commands in `environment-setup.md`, keep the setup boring.
- **Domain / DNS misconfiguration locks out traffic.** Mitigation: verify via `dig` and HTTPS check before merging; keep DNS changes out of the code repo (Cloudflare dashboard documented separately).

### Security considerations

- Content Security Policy headers added in Worker response (at least a baseline — tightened in phase 6).
- `strict-transport-security` header set.
- No secrets in client bundle; all secrets live as Worker environment variables.

### Accessibility considerations

- Wordmark includes accessible name.
- Phone-frame wrapper on desktop is presentational only; does not trap focus or add landmarks.

### Future optimisation opportunities

- Brotli compression (Cloudflare enables by default — verify).
- Critical CSS inlining (defer unless a Lighthouse issue appears).

---

## Technical debt introduced

None anticipated. If trade-offs become necessary during implementation, add entries to `REFERENCE/technical-debt.md`.

---

## Related documentation

- [Root CLAUDE.md](../CLAUDE.md)
- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [ADR — Vite SPA over Next.js](../REFERENCE/decisions/2026-04-19-vite-spa-over-nextjs.md)
- [ADR — Port prototype CSS](../REFERENCE/decisions/2026-04-19-port-prototype-css.md)
- [Testing strategy](../REFERENCE/testing-strategy.md)
- [Environment setup](../REFERENCE/environment-setup.md)
