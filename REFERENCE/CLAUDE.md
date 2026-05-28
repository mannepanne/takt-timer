# Reference Documentation Library

Auto-loaded when working with files in this directory. How-it-works documentation for implemented features.

## Files in this directory

### [testing-strategy.md](./testing-strategy.md)

**When to read:** Writing tests, setting up test coverage, or implementing TDD workflow.

Complete testing philosophy, framework setup (Vitest), test categories, coverage requirements, and CI/CD integration.

### [environment-setup.md](./environment-setup.md)

**When to read:** Setting up local development, configuring secrets, or deploying to production.

Cloudflare account setup, Wrangler commands, resource bindings (Worker, D1, KV, Workers AI, Access, Web Analytics), and the small set of application secrets (WebAuthn config, session cookie secret).

### [troubleshooting.md](./troubleshooting.md)

**When to read:** Debugging issues, fixing deployment problems, or resolving API integration errors.

Common issues and solutions for local development, deployment, and API integrations.

### [pr-review-workflow.md](./pr-review-workflow.md)

**When to read:** Starting a new feature, creating PRs, or running any kind of review.

How to use `/review-spec` (pre-implementation), `/review-pr`, and `/review-pr-team` skills.

### [safety-harness.md](./safety-harness.md)

**When to read:** A safety-harness block or ask dialog fired and you want to understand what's going on, you want to add a pattern, or you want to bypass the hook for a legitimate use.

What's caught at block / ask tier, what's deliberately not caught, how the inline `SAFETY_HARNESS_OFF=1` bypass works (and its limits), how the hook composes with the allowlist, how to extend patterns + tests.

### [scratch-write-hook.md](./scratch-write-hook.md)

**When to read:** Reviewing or extending the `Write` auto-approval for `<project>/SCRATCH/`, debugging a SCRATCH/ Write prompt that fired unexpectedly, or removing the hook if upstream Claude Code fixes the underlying matcher.

What the hook approves and why, where it sits in the call path alongside `safety-harness.sh`, what's deliberately out of scope (symlinks, exotic filenames), how to extend, and the rollback path if the upstream defect is fixed. Decision rationale at [`decisions/2026-04-26-scratch-write-pretooluse-hook.md`](./decisions/2026-04-26-scratch-write-pretooluse-hook.md).

### [auth-and-presets-api.md](./auth-and-presets-api.md)

**When to read:** Implementing or debugging auth flows, presets CRUD, session history sync, or user settings; checking exact request/response shapes for client/server contracts.

HTTP contract for `/api/auth/*`, `/api/presets/*`, `/api/sessions`, and `/api/me/settings` — registration/sign-in ceremony flow, verify response shapes, preset CRUD, session import, settings GET/PUT, `isAllowedOrigin` guard, and the session cookie.

### [i18n.md](./i18n.md)

**When to read:** Adding or editing UI strings, adding a new language, understanding `t()` interpolation, or writing tests for i18n-dependent components.

The `strings.ts` schema, key naming conventions, `satisfies` pattern, `takt.lang.v1` persistence, `useI18n()` hook API, interpolation contract, and testing patterns.

### [voice-api-contract.md](./voice-api-contract.md)

**When to read:** Implementing or debugging the voice pipeline client; understanding HTTP status codes vs NDJSON error events; cold-start behaviour; rate-limit bypass.

HTTP contract for `/api/voice/parse` — status codes, NDJSON event shapes (whisper / parsed / error), cold-start AbortController behaviour, and the dev-only rate-limit bypass.

### [admin-api.md](./admin-api.md)

**When to read:** Working on the admin backend, debugging admin auth or delete flows, or checking the exact HTTP contract for `/admin/*` routes.

HTTP contract for the admin backend — auth guard, dashboard metrics, user-lookup, two-step delete with audit log, error responses, local dev bypass.

### [decisions/](./decisions/)

**When to read:** Making architectural decisions, choosing between alternatives, or looking up why something was built the way it was.

Architecture Decision Records (ADRs) — permanent log of significant technical choices, alternatives considered, and trade-offs accepted.
