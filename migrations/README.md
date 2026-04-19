# D1 migrations

Empty for Phase 1 — Takt's D1 schema lands in **Phase 4 (Accounts and presets)**.

## Convention

Migrations are plain SQL files named `NNNN_short_description.sql`, numbered sequentially:

```
0000_init.sql                    # Phase 4: users, presets, sessions
0001_settings_columns.sql        # Phase 5: language, accent_colour, sound_on on users
…
```

Each migration is applied in order by `pnpm dlx wrangler d1 migrations apply takt` (or
`--local` during development).

## Why not Drizzle yet?

Drizzle (with `drizzle-kit`) was considered during Phase 1 planning and deferred to Phase 4,
where there is actual schema to generate. Installing `drizzle-kit` before we need it buys
nothing and invites rot. When Phase 4 starts, the chosen approach is:

1. Install `drizzle-orm` and `drizzle-kit`.
2. Define the schema in `worker/db/schema.ts`.
3. Let `drizzle-kit` generate the first migration into this directory.

See [SPECIFICATIONS/04-accounts-and-presets.md](../SPECIFICATIONS/04-accounts-and-presets.md).
