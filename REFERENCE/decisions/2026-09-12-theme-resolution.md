# ADR: Appearance is resolved in JS to one `data-theme` attribute, device-scoped

**Date:** 2026-09-12
**Status:** Active

---

## Decision

The appearance mode (System / Light / Dark) is resolved to a concrete `light` or `dark` in JavaScript and stamped as `data-theme` on `<html>`. The stylesheet has exactly one dark block, keyed off that attribute. An external pre-paint script (`public/theme-init.js`) stamps it before first paint; `SettingsProvider` keeps it in step afterwards. The choice lives in `localStorage` only — it is never synced to D1.

## Context

Dark mode ([SPECIFICATIONS/dark-mode.md](../../SPECIFICATIONS/dark-mode.md), issue #154) needed three things at once: a System mode that follows the OS live, explicit Light/Dark overrides (the gym case: phone in light mode, Takt dark), and no light flash on load for dark-mode users. Takt is an app that cannot run without JS, is served under a CSP with no nonce or hash machinery on either platform, and already applies its accent colour by writing custom properties on `<html>` at runtime.

## Alternatives considered

- **A `@media (prefers-color-scheme: dark)` block for System plus a `[data-theme]` block for overrides.** Rejected: the ~25 dark token values would live in two places that must never drift. CSS nesting and `light-dark()` would collapse them, but both are too new to rely on across the Android WebView population.
- **Media-query-only, no override, no script (a smaller v1).** Rejected because the explicit override _is_ the tester ask, and the product decision to match Android's own appearance setting had already been taken. Costed in the spec review as a genuine option had the answer been different.
- **An inline `<script>` in `index.html`.** Rejected: the web CSP (`worker/lib/securityHeaders.ts`) and the native CSP (`vite.native-html.ts`) are static strings with no nonce/hash mechanism; an inline script would need a hash kept in sync by hand across two constants and the HTML. An external file under `/` is allowed by `script-src 'self'` on both, is precached by Workbox, and survives the native HTML transform. Zero CSP change.
- **A D1 `theme` column synced like accent and sound.** Rejected: appearance is device-scoped — dark on the gym phone and light on the laptop is correct, not a sync failure — and native never syncs. The spec review also showed the "lenient PUT" needed to survive service-worker skew would have silently overwritten a stored choice from a stale client. Adding a column later is trivial; the reverse is not.
- **Chosen: JS-resolved `data-theme`, attribute-only CSS, external pre-paint script, `localStorage` only.**

## Reasoning

- One source of truth for the dark values, and the same runtime mechanism the accent feature already proved.
- Resolving in JS makes "no flash" a structural guarantee rather than a hope: the blocking script in `<head>` runs before anything paints. If it ever fails to load the page degrades to light and the provider corrects it after mount — a flash, not a broken app.
- The accent's dark shades are derived and written inline by the same provider, so the dark block needs no accent rules and there is no cascade to reason about (inline always wins).
- No server surface means no contract, no migration, no skew window.

## Trade-offs accepted

- `theme-init.js` is an extra small render-blocking request on an uncached cold load, and it is unhashed (served with ETag revalidation). Don't add a long immutable `Cache-Control` for `/*.js` without thinking about this file.
- The storage key string is duplicated in the script (it cannot import from `src/`); `theme-init.test.ts` asserts the two match.
- Android below API 29 cannot report `prefers-color-scheme`, so System resolves to light there; explicit Dark still works.
- No cross-device sync of appearance. If that is ever wanted, a nullable column with "absent means unchanged" semantics is the way — not a default.

## Implications

- Enables: one dark palette, a lint test that can prove it complete, live OS-following, native chrome (status bar, window background) driven from the same resolved value.
- Prevents: any stylesheet override of `--accent-deep` / `--accent-soft` (they are the resolver's; a stylesheet rule can only lose), and any `prefers-color-scheme` media block in `styles.css`.

---

## References

- Relevant spec: [SPECIFICATIONS/dark-mode.md](../../SPECIFICATIONS/dark-mode.md)
- How it works: [REFERENCE/theming.md](../theming.md)
- Related ADRs: [2026-04-19 — Port prototype CSS](./2026-04-19-port-prototype-css.md), [2026-07-26 — Capacitor wraps the SPA](./2026-07-26-capacitor-android-wrapper.md) (the seam pattern the native status bar follows)
