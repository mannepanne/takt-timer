# Phase 7c: Auth/network no-op on native

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first. This deliverable makes the app usable cold with no login and no network call — the "opening the app requires zero taps beyond onboarding" acceptance criterion.

**Depends on:** 07b (needs the native build variant and `platform.ts`).
**Gates:** 07d (local presets assume auth resolves to `unauthenticated` and never calls the network).
**Shippable?** Yes — after this, native launches to a definite unauthenticated state with no spinners and no `/api` traffic.

---

## Goal

On native, no auth/account network call fires — ever, from any code path — and the UI resolves to a definite `unauthenticated` state rather than sitting at `loading`. Make **platform**, not auth state, the thing that gates network, so the guarantee is structural rather than incidental.

---

## Scope

- [ ] **`SessionProvider` (`src/lib/auth/session.tsx`) is a no-op on native, not merely hidden.** It currently calls `GET /api/auth/me` unconditionally on mount, before any UI decision. On native this must not fire at all, and — critically — the provider must resolve to a **definite `unauthenticated` state, not sit at the initial `loading`**. The whole UI branches on `isAuthenticated`/`loading`; a permanent `loading` would strand spinners and mis-render every auth-dependent view.
- [ ] **Neutralise `refresh()` and `login()` too.** Both call `getMe()` / the network unconditionally. On native they must no-op (and callers audited), or a later `refresh()` reintroduces the very call the mount fix removed.
- [ ] **Audit every `isAuthenticated` consumer — components, not just lib modules.** These fire `apiFetch` gated on auth state rather than platform, and stay silent on native only because `isAuthenticated` is incidentally false — fragile:
  - `Home.tsx` — `GET /api/sessions?latest=1`
  - `Complete.tsx` — `pushSession`
  - `Settings.tsx` — the account block
    The audit makes **platform** the gate, so the silence is guaranteed, not incidental. (Home's presets-unhiding and Complete's save-as-preset _behaviour_ belong to 07d; here we only stop their network calls.)
- [ ] **`settings/context.tsx`** — already `localStorage`-backed for the anonymous path; only its `apiFetch` sync needs suppressing on native, not a rewrite.
- [ ] **`history-sync.ts`** — replaced by its local no-op on native (history is already local via `history.ts`; only the sync-to-D1 path is suppressed).

## Out of scope

- Replacing `presets.ts` with the local module and unhiding the presets entry point → **07d** (this deliverable only ensures the presets _network_ path is dead).
- Hiding the account UI in `Settings.tsx` / `Onboarding.tsx` copy → **07g** (here we only kill the network call in the account block).

## The load-bearing test (read carefully — the obvious test is vacuous)

- [ ] **Assert: on native, `SessionProvider` resolves to `unauthenticated` and `getMe` is never called** (spy on the fetch). This is the real guard.
- A test that merely mocks `isNativePlatform() === true` is **vacuous** — native ⟹ `unauthenticated` ⟹ the `Home`/`Complete`/`Settings` fetches already short-circuit on auth, so it passes whether or not a platform gate was ever added.
- The structural guarantees do the rest of the work: `INTERNET` absent from the merged manifest (07b) + the scoped CSP (07b).
- A component-level "no fetch on native" test is **belt-and-braces only**, and meaningful _only_ if it forces the impossible-in-production **native-and-authenticated** state so it actually exercises a platform gate. It must not stand in for the `SessionProvider` assertion.

## Acceptance criteria

- [ ] Opening the app cold shows no login screen, no registration prompt, no spinner-stuck view — a definite unauthenticated UI, immediately.
- [ ] `SessionProvider` resolves to `unauthenticated` on native with **no** network call (verified by fetch spy).
- [ ] No `apiFetch`/`getMe`/`pushSession`/sessions-fetch fires on native from any of the audited call sites, including after a `refresh()`/`login()` call.
- [ ] Web behaviour unchanged: sign-in, session refresh, history sync, and the account block all work exactly as today; existing Vitest suite passes.

## Risks specific to this deliverable

- **A missed `isAuthenticated` consumer** silently reintroduces a network call. The audit must be exhaustive — grep every `apiFetch`/`isAuthenticated` site, not just the named ones.
- **`refresh()`/`login()` re-arming the call** after the mount fix — explicitly neutralised and caller-audited.
- **Permanent `loading`** if the native branch forgets to resolve state — the acceptance test for a _definite_ `unauthenticated` guards this.

## PR workflow

Branch `feature/phase-7c-auth-network-noop`. Touches shared auth code — `/review-pr`, expect standard tier. The regression-guard test is the review's focal point.
