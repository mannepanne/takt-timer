# Environment and secrets setup

**When to read this:** Setting up local development for the first time, adding a new Cloudflare binding or secret, or deploying to production.

**Related documents:**
- [CLAUDE.md](../CLAUDE.md) — project navigation.
- [troubleshooting.md](./troubleshooting.md) — common setup issues.

---

## Overview

Takt is Cloudflare-native. Almost everything lives under a single Cloudflare account:
- **One Worker** hosts both the Vite-built SPA (via Workers Assets) and the `/api/*` routes.
- **D1** stores users, presets, and session history.
- **KV** stores session tokens and rate-limit counters.
- **Workers AI** runs Whisper-turbo and a Llama model — accessed via a Worker binding, no external API key.
- **Access (Zero Trust)** gates `/admin` with Magnus's Google identity.
- **Web Analytics** provides cookieless traffic stats.

Local development uses Wrangler's dev server, which connects the running code to real D1 and KV instances (or local simulated ones — decide per-command, see below).

---

## First-time setup

### 1. Install tooling

- Node.js (current LTS) and pnpm.
- Wrangler CLI — installed as a dev dependency in the repo; use `pnpm dlx wrangler ...` or the repo's own scripts (`pnpm dev`, `pnpm deploy`).

### 2. Authenticate Wrangler

```bash
pnpm dlx wrangler login
pnpm dlx wrangler whoami   # Verify the active account
```

The active Cloudflare account must own `takt.hultberg.org`, the D1 database, the KV namespace, and have Workers AI enabled.

### 3. Clone and install

```bash
git clone git@github.com:<owner>/takt-timer.git
cd takt-timer
pnpm install
```

### 4. Create `.dev.vars`

Copy the template (added in Phase 1):

```bash
cp .dev.vars.template .dev.vars
# Edit .dev.vars — see "Secrets" below for what goes in.
```

### 5. Run it locally

```bash
pnpm dev
```

This starts the Vite dev server and Wrangler in parallel. The app is served on a local port (printed in the output); API routes and Cloudflare bindings are available via Wrangler's dev runtime.

---

## Cloudflare resources

These are provisioned once per environment. Document the actual names and IDs in `wrangler.toml`; the table below is the canonical list.

| Resource | Purpose | Binding name | Notes |
|---|---|---|---|
| Worker | Serves SPA + API | — | Custom domain `takt.hultberg.org` |
| D1 database | Users, presets, sessions | `DB` | Migrations in `/migrations` |
| KV namespace | Session tokens, rate-limit counters | `SESSIONS`, `RATE_LIMITS` | Separate namespaces for clarity |
| Workers AI | Whisper + Llama | `AI` | Bound in `wrangler.toml` |
| Access application | Admin gate at `/admin` | — | Configured in Cloudflare dashboard |
| Web Analytics token | Analytics snippet in `index.html` | — | Beacon script loads from Cloudflare |

Exact resource IDs are kept out of this document — they live in `wrangler.toml` (committed) and Cloudflare's dashboard (not committed).

---

## Secrets

Takt is deliberately secret-light. The Cloudflare account credentials are held by Wrangler; resource access is via bindings declared in `wrangler.toml`, not via API keys in code.

**Application secrets that do exist:**

| Secret | Purpose | How to obtain | Set via |
|---|---|---|---|
| `SESSION_COOKIE_SECRET` | Signs session cookies | Generate a random 32+ byte value | `pnpm dlx wrangler secret put SESSION_COOKIE_SECRET` |
| `WEBAUTHN_RP_ID` | WebAuthn relying-party ID | Set to `takt.hultberg.org` (production) / `localhost` (local) | `.dev.vars` locally; Worker secret in production |
| `WEBAUTHN_ORIGIN` | Allowed origin for WebAuthn | `https://takt.hultberg.org` (production) / `http://localhost:<port>` (local) | `.dev.vars` locally; Worker secret in production |

`.dev.vars` template (created in Phase 1):

```bash
# WebAuthn config for local development
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:8787

# Cookie signing secret (generate your own)
SESSION_COOKIE_SECRET=<random 32+ bytes>
```

**Never commit `.dev.vars`.** It is in `.gitignore`.

---

## Useful commands

```bash
# Local dev
pnpm dev

# Run tests
pnpm test
pnpm test:watch
pnpm test:coverage

# Type check
pnpm typecheck

# Deploy to production
pnpm deploy

# Inspect or change production secrets
pnpm dlx wrangler secret list
pnpm dlx wrangler secret put <NAME>
pnpm dlx wrangler secret delete <NAME>

# Run a D1 migration
pnpm dlx wrangler d1 migrations apply <DB_NAME>

# Tail production logs
pnpm dlx wrangler tail
```

---

## Admin access (Cloudflare Access)

The `/admin` route is gated at the edge by Cloudflare Access with Magnus's existing Google IdP policy. Configuration lives in the Cloudflare dashboard, not in code.

To change who has admin access: update the Access application in the dashboard. The app reads the authenticated email header (`CF-Access-Authenticated-User-Email` or equivalent) and uses it for authorisation only — never persists it.

---

## Production deployment checklist

Before promoting a build:

- [ ] `wrangler.toml` references the correct D1 and KV IDs for production.
- [ ] All secrets set in production: `pnpm dlx wrangler secret list` shows the expected names.
- [ ] Web Analytics token in `index.html` matches the production site tag.
- [ ] Cloudflare Access policy on `/admin` verified with a known-allowed and known-denied account.
- [ ] `takt.hultberg.org/api/health` returns `200 OK`.
- [ ] Cron Trigger for the retention purge is configured (from Phase 6 onwards).

---

## Security notes

- All responses include a baseline security header set (CSP, HSTS, Referrer-Policy, Permissions-Policy). Tightened in Phase 6.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.
- No user-identifying fields in any D1 table. Admin authentication reads the Access email header for authorisation only; it is not persisted.
- Workers AI calls are rate-limited before inference; anonymous users by IP, authenticated users by `userHandle`, admin exempt.

---

## When things go wrong

See [troubleshooting.md](./troubleshooting.md). The most common setup friction is Wrangler authentication — `pnpm dlx wrangler login` followed by `whoami` resolves it in almost every case.
