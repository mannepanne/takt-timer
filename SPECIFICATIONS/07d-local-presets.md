# Phase 7d: Local presets + native creation path

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first. This deliverable is the phase's main user-facing feature on native: presets that live entirely on-device, reachable with no login, creatable from the Complete screen.

**Depends on:** 07b (native alias mechanism), 07c (auth resolves to `unauthenticated`, presets network path dead).
**Gates:** nothing hard downstream, but it's the spine of "a usable native app".
**Shippable?** Yes — after this, a native user can create, pin, rename, duplicate, delete, and persist presets, all offline.

> **Delivered in two slices.** The **module** (`src/lib/presets-local.ts` + tests) shipped ahead of its `07b`/`07c` dependencies because it's device-independent pure logic — nothing imports it yet, no web path touched. Still to do (the **integration slice**, gated on 07b/07c): the native `@/lib/presets` → `presets-local` build alias, unhiding the presets entry in `Home.tsx`, and the native "Save as preset" path in `Complete.tsx`.
>
> **Locked storage key: `takt.presets.v1`.** Device-scoped `localStorage`, keyed to the WebView origin — a locked value on par with `takt.history.v1` and `takt.stopwatch.v1` (the "presets key" [07b](./07b-capacitor-scaffold.md) warns must survive the origin lock). Changing it orphans every user's presets.

---

## Goal

A device-scoped presets module that is **faithful to the web experience for a signed-in user, minus the sign-in step**. The drawer, the save sheet, and the reorder/pin/rename affordances all behave as on web; only identity (no `user_handle`) and the backend (raw `localStorage`, not D1) differ under the hood.

---

## Scope

- [ ] **New `src/lib/presets-local.ts`** storing presets device-side in `localStorage`, no `user_handle`. **No per-preset usage count, no lifetime session counter** — dropped to mirror the web app exactly (web has no per-preset counter; its Home session-count chip is history-derived and comes along unchanged via `src/` reuse).
  - **Match `presets.ts`'s _async_ (Promise-returning) surface, not `history.ts`'s sync one.** `PresetsDrawer` consumes presets via `listPresets().then(...)` in an effect and `await`s every mutation, with its own `loading`/`error` states — it is _not_ a render-time sync read. So `presets-local` wraps its synchronous `localStorage` in `Promise.resolve` and exposes the full set the drawer uses: `listPresets`, `createPreset`, `updatePreset`, `deletePreset` (covering pin, rename, duplicate, delete).
  - Retain the full `Preset` shape the drawer reads (`id`, `pinned`, `order_index`, `created_at`), synthesising values locally; only `user_handle` and the usage counts are dropped.
  - Define `order_index` for a locally-created preset: **append at current max + 1**.
  - `reorderPresets` has **no drawer UI today**, so it need not be ported — note its absence deliberately rather than silently omitting it.
- [ ] **Do not inherit `history.ts`'s silent-failure contract.** `appendHistory` discards `safeSet`'s failure boolean and silently caps at 30, dropping the oldest — tolerable for auto-recorded history, **not** for a paid user's curated presets with no cloud backstop. `presets-local` must:
  - **Surface a write failure to the caller** (so "Save as preset" can show an error instead of a false success).
  - **Not silently cap or evict** user-created presets.
- [ ] **Routing: a native-mode Vite alias `@/lib/presets` → `@/lib/presets-local`** (same build-variant trick as `virtual:pwa-register` in 07b). This leaves `PresetsDrawer` and `SavePresetSheet` **provably byte-identical on web**, satisfying "web paths unchanged" with no runtime branching in the components.
- [ ] **Unhide the presets entry point in `Home.tsx`.** Both the TopBar List button and the drawer render currently sit behind `if (isAuthenticated)` — permanently false on native, which would make the phase's main feature invisible. On native the entry must show **regardless of auth state**. `PresetsDrawer` itself needs no change (it reads through the aliased module) — the work is in `Home.tsx`.
- [ ] **A working native path to _create_ a preset.** On web, "Save as preset" on Complete becomes "Sign in to save" → passkey ceremony when unauthenticated. On native there's no sign-in: **"Save as preset" is always available and writes to `presets-local`.** Touches `Complete.tsx`, `SavePresetSheet`, and the passkey entry points (hidden on native).

## Out of scope

- Hiding the broader account UI (sign out, delete account) in `Settings.tsx` and account copy in `Onboarding.tsx` → **07g**. This deliverable only removes the sign-in gate on the _preset-creation_ path and unhides the _presets entry_.

## Acceptance criteria

- [ ] A native user opens the presets drawer with **no auth gate of any kind**, immediately on cold launch.
- [ ] A native user can **create a preset from the Complete screen with no sign-in step**, run it, and see it persist after a full device restart.
- [ ] Pin, rename, duplicate, and delete all work on native and persist.
- [ ] A **write failure** (full/evicted store) surfaces an error to the caller — never a false "saved". No user-created preset is silently evicted.
- [ ] Newly-created presets get a correct `order_index` (max + 1).
- [ ] Web unchanged: `PresetsDrawer`/`SavePresetSheet` are byte-identical (alias-routed); the web account-gated save flow works exactly as today; existing Vitest suite passes.

## Testing

- `presets-local` to the project's usual coverage (95%+ lines/functions, 90%+ branches): create/list/update/delete, `order_index` assignment, and — importantly — the **write-failure path** (surfaces an error, never a false success). No test assumes silent success.
- A test proving the web-side components are unchanged (alias only swaps the module on native).

## Risks specific to this deliverable

- **Saved presets silently vanishing** if the module inherits `history.ts`'s write contract — explicitly forbidden above; the write-failure test is the guard.
- **`localStorage` eviction under storage pressure** on some OEM WebViews (umbrella risk) — `presets-local` degrades gracefully on a read miss (loss is non-fatal), but persistence is "strongly durable, tolerant of loss", not guaranteed survival. Don't let acceptance copy imply otherwise.
- **PWA users expecting their existing presets to carry over** — they won't (WebView origin ≠ Chrome origin). A store-listing / first-run line, tracked in 07h.

## PR workflow

Branch `feature/phase-7d-local-presets`. Genuinely new client logic (`presets-local` + native creation path) — `/review-pr`, standard tier at minimum. The write-failure contract is the review's focal point.
