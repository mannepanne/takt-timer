# ADR: Origin guard — stratified policy by surface and method

**Date:** 2026-05-29
**Status:** Accepted

---

## Context

The Cloudflare Worker has two separate surfaces that need CSRF/origin protection:

- **Public API (`/api/*`)** — auth, presets, sessions, settings. Consumed by the SPA running in the user's browser. Both reads (GET) and writes (POST/PUT/PATCH/DELETE) are present.
- **Admin surface (`/admin/*`)** — user management, retention purge. Consumed only by Magnus, via a Cloudflare Access–gated browser session.

An early implementation applied a single origin check unconditionally across all routes (`isAllowedOrigin` returning `true` for any request with no `Origin` header). This allowed non-browser clients — including proxies that strip headers — to reach state-changing endpoints without an `Origin`, creating a CSRF bypass described in issue #56.

---

## Decision

Two origin guards, with deliberately different policies:

### 1. Public API guard — method-aware

`isAllowedRequest` (in `worker/lib/isAllowedRequest.ts`) applies to all `/api/*` routes except `/api/health` (no state) and `/api/voice/parse` (self-handles its own origin check with a structured NDJSON error envelope).

Policy:

- No `Origin` + GET/HEAD/OPTIONS → **allow** (same-origin browser reads legitimately omit Origin)
- No `Origin` + POST/PUT/PATCH/DELETE → **reject** (closes the proxy-strip bypass)
- `Origin` in allowlist → **allow**
- Any other `Origin` → **reject**

A single guard in the `routeRequest` dispatcher (after the early-return branches for health and voice) covers all remaining routes — no per-route repetition.

### 2. Admin guard — always-strict

`requireAdminAuthWithCsrf` (in `worker/admin/auth.ts`) requires `Origin` on **all** methods, including GETs. The explicit `!request.headers.get('origin')` check precedes the allowlist check.

This is stricter because admin GETs expose sensitive aggregate data (the full user list, retention dry-run results). A cross-origin scripted read by a malicious page loaded in an authenticated admin browser is a real threat — the same threat that motivates same-site CSRF protection for read-heavy admin panels.

---

## Alternatives considered

**Always require Origin on all methods, all surfaces:** Simpler to reason about, but breaks legitimate same-origin GET flows where browsers omit Origin (e.g. reload, navigation fetch, cross-origin reads that don't require credentials). Would require every integration test to send an `Origin` header on every request, including GETs. Rejected as unnecessarily strict for the public API surface.

**Single guard, no method awareness (pre-fix behaviour):** Allowed any request without Origin, regardless of method. Left a CSRF window for non-browser clients on write endpoints (issue #56). Rejected.

**Per-route guard (original implementation):** Correct behaviour but repeated at each of the 12+ call sites, making it easy to forget when adding a new route. Consolidated into a single middleware gate as part of the issue #56 fix.

---

## Consequences

- Adding a new public `/api/*` route is automatically protected by the middleware gate — no per-route guard needed.
- Admin routes must continue to maintain their own `requireAdminAuthWithCsrf` wrapper; the public-API gate does not cover `/admin/*`.
- Curl and scripted clients hitting state-changing public endpoints must send `-H "Origin: https://takt.hultberg.org"`. See `REFERENCE/troubleshooting.md`.
- The asymmetry between the two guards is load-bearing and intentional. Do not "harmonise" them by relaxing admin's always-strict check.
