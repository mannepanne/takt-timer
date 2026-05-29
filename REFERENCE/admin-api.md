# Admin Backend Reference

HTTP contract for the `/admin/*` endpoints introduced in Phases 6b and 6c.

The admin backend is server-rendered HTML — no JSON API. It is gated by Cloudflare Access (Google IdP, Magnus only). All endpoints require the `CF-Access-Authenticated-User-Email` header that Cloudflare Access injects; requests that arrive without it (or via `workers.dev` instead of `takt.hultberg.org`) receive `403 Forbidden`.

**Auth guard:** `requireAdminAuth` (read-only routes) and `requireAdminAuthWithCsrf` (state-mutating routes). See `worker/admin/auth.ts`.

**Local dev:** Set `ALLOW_ADMIN_BYPASS=1` in `.dev.vars` to bypass Cloudflare Access. The actor is reported as `dev@local`. See `REFERENCE/environment-setup.md`.

All responses include `Cache-Control: no-store`.

---

## GET /admin

**Handler:** `handleDashboard`

Renders the admin dashboard with aggregate metrics from D1.

**Metrics displayed:**

| Metric                  | Query                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| Total users             | `COUNT(*)` from `users`                                                   |
| New users (7d)          | Users with `created_at` in last 7 days                                    |
| Active users (7d / 30d) | Distinct `user_handle` in `sessions` with `completed_at` in last 7d / 30d |
| Sessions (7d / 30d)     | `COUNT(*)` from `sessions` with `completed_at` in last 7d / 30d           |
| Voice calls (7d / 30d)  | `COUNT(*)` from `voice_calls` with `called_at` in last 7d / 30d           |

All eight queries run in a single `db.batch()` call.

**Auth:** `requireAdminAuth`

---

## GET /admin/user

**Handler:** `handleUserLookup`

Renders the Users page. Two sections are always rendered on every request.

**Section 1 — User lookup**

If a `?handle=` query parameter is present, queries `users` and aggregates sessions/presets for that handle.

**Query parameter:** `handle` — the 32-character hex user handle.

**Outcomes:**

- No `handle` param → renders empty search form.
- Handle found → renders user stats table + delete button.
- Handle not found → renders "No user found" message + empty form.

**User stats table:** handle, registration date, session count + last session date, preset count.

**Section 2 — Retention purge**

Calls `pruneInactiveUsers(db, thresholdMs, dryRun=true)` on every request and renders the result below the lookup form. Lists handles eligible for deletion (inactive >90 days, no sessions, no presets) and shows a "Run purge" button if any are found. The "Run purge" button posts to `POST /admin/purge/run`.

**Auth:** `requireAdminAuth`

---

## POST /admin/user-delete

**Handler:** `handleDeleteUserConfirmPage`

Renders a confirmation page before a hard delete. The handle is submitted in the POST body (not in the URL) so it does not appear in browser history or server access logs.

**Request body** (`application/x-www-form-urlencoded`):

| Field    | Description                  |
| -------- | ---------------------------- |
| `handle` | 32-character hex user handle |

**Outcomes:**

- Missing handle → `400 Bad Request`
- Handle not found → `404 Not Found`
- Success → confirmation page showing session count, preset count, and a "Confirm delete" button that posts to `/admin/user-delete/confirm`

**Auth:** `requireAdminAuthWithCsrf` (checks `Origin` header against allowed list)

---

## POST /admin/user-delete/confirm

**Handler:** `handleDeleteUserExecute`

Executes a hard delete of the user and all associated data. The sequence is:

1. `INSERT` into `admin_log` (audit trail — written first so a partial failure still leaves a record)
2. Delete all KV session tokens for the user (`deleteUserSessions`)
3. Explicit-delete all D1 rows for the user in a single batch (`deleteUserCascade`): `sessions`, `presets`, `voice_calls`, then `users`. D1 does not honour FK cascades; all deletes are explicit.

**Request body** (`application/x-www-form-urlencoded`):

| Field    | Description                  |
| -------- | ---------------------------- |
| `handle` | 32-character hex user handle |

**Outcomes:**

- Missing handle → `400 Bad Request`
- Handle not found (already deleted?) → `404 Not Found`
- Success → confirmation page with "User deleted" message and link back to dashboard

**Auth:** `requireAdminAuthWithCsrf`

---

## POST /admin/purge/run

**Handler:** `handlePurgeRun`

Executes the retention purge:

1. Calls `pruneInactiveUsers(db, thresholdMs, false)` — explicit-deletes `sessions`, `presets`, `voice_calls`, and `users` rows in chunks.
2. Calls `insertPurgeRun(db, now, deleted)` — records a `purge_runs` audit row even when nothing was deleted.
3. Calls `insertAdminLog(db, 'purge_run', actor, null, now)` — records who triggered the purge.

**Outcomes:**

- Success → "Purge complete" page with the count of deleted users.

**Auth:** `requireAdminAuthWithCsrf` (rejects absent `Origin` header; checks present `Origin` against allowed list)

---

## Audit log

Every successful delete writes a row to `admin_log`:

| Column       | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| `action`     | `delete_user`                                                                   |
| `actor`      | Email from `CF-Access-Authenticated-User-Email` (or `dev@local` in bypass mode) |
| `target`     | User handle                                                                     |
| `created_at` | Unix timestamp (ms)                                                             |

The insert runs before the cascade delete so a partial failure still leaves a record.

---

## Error responses

All error responses include `Cache-Control: no-store` (so a cached 403 cannot block a legitimate subsequent request).

| Status | Meaning                                                                 |
| ------ | ----------------------------------------------------------------------- |
| 403    | Not authenticated, non-production hostname, or CSRF origin check failed |
| 404    | Route not matched, or user handle not found                             |
| 400    | Required form field (`handle`) missing                                  |
