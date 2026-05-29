# Consolidate Settings and Account into a single entry point

## Problem

The Home screen has two icons for settings-related functionality:

- **Top-left:** Settings cog → `/settings` (language, accent, sound, account link)
- **Top-right:** User/Account icon → `/account` (sign in / sign out / delete account)

This is redundant — Settings already surfaces account status and links to Account. Two icons for overlapping concerns adds unnecessary cognitive load.

## Solution

Collapse both into a single Settings entry point:

1. Move the Settings cog to **top-right** (conventional mobile placement for settings/account).
2. Inline all account management **directly in the Settings panel** — eliminating `/account` as a separate route.
3. After a successful sign-in from Settings, stay on Settings and show a "Signed in" confirmation toast.

## Acceptance criteria

- [ ] Home screen has one icon on the right (Settings cog, links to `/settings`).
- [ ] Home screen has no Account/User icon.
- [ ] Settings panel shows inline account management — no link to `/account`.
  - Authenticated: "Signed in" status label + Sign out button + Delete account button (two-tap confirm).
  - Unauthenticated: "Not signed in" status label + Sign in / Register button (opens `PasskeyPrompt`).
- [ ] Signing in from Settings: session refreshes, panel updates to show "Signed in" state, a confirmation toast appears briefly.
- [ ] Sign out from Settings: session cleared, navigates to `/`.
- [ ] Delete account from Settings: session cleared, history cleared, navigates to `/`.
- [ ] The `/account` route is removed from the router.
- [ ] `Account.tsx` is deleted.
- [ ] The Presets icon (top-left, authenticated only) is unaffected.
- [ ] No new i18n strings required (all `account.*` and `settings.*` keys already exist).
- [ ] All existing tests pass; new tests cover the inlined account section.

## Files affected

| File                                        | Change                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/routes/Home.tsx`                       | Move Settings cog to right slot; remove User icon and `authPromptOpen` state           |
| `src/routes/Settings.tsx`                   | Inline account management section; add sign-in/sign-out/delete logic and PasskeyPrompt |
| `src/App.tsx`                               | Remove `/account` route and `Account` import                                           |
| `src/routes/Account.tsx`                    | **Delete**                                                                             |
| `src/routes/Settings.test.tsx` (or similar) | Update/add tests for inlined account section                                           |

## UX details

### Sign-in flow (unauthenticated)

1. User opens Settings → sees "Not signed in" + "Sign in" button.
2. Taps "Sign in" → `PasskeyPrompt` opens.
3. On success: prompt closes, session refreshes, section updates to "Signed in" state, toast shows `t('settings.saved')` (or a dedicated signed-in string if one is added).

### Sign-out flow (authenticated)

1. User opens Settings → sees "Signed in" + Sign out button.
2. Taps Sign out → session cleared → navigates to `/`.

### Delete flow (authenticated)

1. User taps Delete account → button label changes to "Are you sure?" (two-tap confirm).
2. Confirms → account deleted, history cleared, navigates to `/`.
3. Cancel button available between taps.

## Out of scope

- Visual redesign of the Settings panel layout.
- Adding new i18n strings (use existing keys throughout).
- Changing the Presets drawer behaviour.
