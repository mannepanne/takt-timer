# Scheduled cron — retention purge

How the daily retention purge is triggered, what it does, and how to test it.

---

## Schedule

```toml
# wrangler.toml
[triggers]
crons = ["0 3 * * *"]
```

Fires at **03:00 UTC every day**. The handler is the `scheduled` export in `worker/index.ts`.

---

## What it does

`runPurge` in `worker/cron/purge.ts`:

1. Computes the eligibility threshold: `now - 90 days` (constant `RETENTION_DAYS = 90`).
2. Calls `pruneInactiveUsers(db, thresholdMs, false)` — finds users with `created_at < threshold` who have no sessions and no presets, then deletes their `sessions`, `presets`, `voice_calls`, and `users` rows in chunks of 24 (to stay under D1's 100-statement batch limit). Each chunk re-verifies eligibility before deleting (TOCTOU guard).
3. Calls `pruneVoiceCalls(db, thresholdMs)` — deletes anonymous (`user_handle IS NULL`) voice_calls rows older than the threshold.
4. Calls `insertPurgeRun(db, now, deleted)` — records a `purge_runs` audit row. Written even when nothing was deleted.

The handler exits silently; errors are not retried by the platform.

---

## Retention criteria

A user is eligible for purge if **all three** conditions hold:

- `users.created_at < now - 90 days`
- No rows in `sessions` for this `user_handle`
- No rows in `presets` for this `user_handle`

Users with any session or preset history — regardless of how long ago — are never purged by the cron.

---

## Admin dry-run

Before the cron fires, you can preview eligible users on the admin Users page (`/admin/user`). The page calls `pruneInactiveUsers` with `dryRun = true`, which returns the list without making any changes. A "Run purge" button posts to `POST /admin/purge/run` to execute immediately. See `REFERENCE/admin-api.md`.

---

## Testing locally

Cloudflare does not fire cron triggers in `wrangler dev` automatically. To test the purge logic:

1. Import `runPurge` directly in a test or script and call it with a test D1 binding.
2. Or trigger it manually via the Cloudflare dashboard: **Workers & Pages → your Worker → Triggers → Run**.

The cron unit tests live in `worker/cron/purge.test.ts`. Run with `pnpm test`.

---

## Monitoring

The `purge_runs` table in D1 records every execution:

```sql
SELECT * FROM purge_runs ORDER BY ran_at DESC LIMIT 10;
```

Access via the Cloudflare D1 dashboard or `wrangler d1 execute takt-db --command "SELECT * FROM purge_runs ORDER BY ran_at DESC LIMIT 10"`.
