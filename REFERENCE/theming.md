# Theming — design tokens, the dark palette, and the colour-discipline guard

**When to read this:** Adding or changing any colour in `src/styles.css`, tripping `src/styles.test.ts`, tuning the dark palette, or checking contrast before a PR.

---

## The one rule

**Every colour in `src/styles.css` goes through a custom property defined in `:root`.** No `#fff`, no `rgba(…)`, no `white` anywhere else. `src/styles.test.ts` enforces it on every test run.

Why: the dark appearance is _only_ a second set of values for those tokens (`:root[data-theme='dark']`). A colour that bypasses the tokens is invisible to dark mode and shows up as a white card on a dark screen. The guard exists so that can't happen quietly.

## Where the tokens live

Two blocks at the top of `src/styles.css`:

- `:root` — the light palette (the prototype's "paper" design), plus every token's default.
- `:root[data-theme='dark']` — the dark palette. It only overrides tokens `:root` already defines (the test checks this too), and it contains **no accent rules** — see below.

Selection is by the `data-theme` attribute on `<html>`, resolved in JS. There is deliberately no `@media (prefers-color-scheme)` block: the dark values live in exactly one place. (Design rationale and the rejected alternatives: [SPECIFICATIONS/ARCHIVE/dark-mode.md](../SPECIFICATIONS/ARCHIVE/dark-mode.md).)

### Token families

| Family              | Tokens                                                                                                                                    | Notes                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Page and surfaces   | `--paper`, `--paper-2`, `--surface`, `--surface-subtle`                                                                                   | Elevation inverts on dark: `--surface` (cards, chips) is _lighter_ than `--paper`.                                            |
| Text                | `--ink`, `--ink-2`, `--ink-3`, `--ink-muted`, `--ink-faint`, `--mute`                                                                     | `--mute` is the small-label grey and is tuned to clear 4.5:1 on all three surfaces in both themes.                            |
| Rules               | `--rule`, `--rule-strong`                                                                                                                 |                                                                                                                               |
| Accent              | `--accent`, `--accent-deep`, `--accent-soft`, `--on-accent`                                                                               | Written inline on `<html>` by `applyAccentCss()` — never edit their values in the stylesheet. `--on-accent` is white-on-fill. |
| Ink-filled elements | `--fill`, `--fill-hover`, `--on-fill`                                                                                                     | Primary CTA, run control, toasts, active toggle segment. Mid-surface on dark, never an off-white slab.                        |
| Danger              | `--danger`, `--danger-soft`, `--danger-deep`                                                                                              | Chosen for _text on paper_ (≥ 4.5:1); the white-on-danger icon button is judged at 3:1.                                       |
| Tints and scrims    | `--hover-tint`, `--scrim`, `--backdrop`, `--backdrop-strong`                                                                              |                                                                                                                               |
| Shadows             | `--shadow-lift`, `--shadow-pop`, `--shadow-sheet`, `--shadow-drawer`, `--shadow-knob`, `--shadow-mic`, `--shadow-toast`, `--frame-shadow` | On dark, shadows give way to 1px `rgba(255,255,255,…)` rings — a drop shadow on near-black is invisible.                      |

Thin indicators — the 3px progress-bar fill, set dots, the pager pill, the selected-swatch ring — stay on `--ink` on purpose. On dark they read as light marks, which is what an indicator should be; a mid-grey fill would vanish against the dark track.

## How the appearance is resolved

Three modes — `system` (default), `light`, `dark` — stored as `takt.theme.v1` in `localStorage` on each device, never synced (appearance is a per-device preference). `src/lib/settings/theme.ts` holds the pure helpers; `SettingsProvider` resolves the mode against `prefers-color-scheme` — live, and again whenever the app returns to the foreground — and calls `applyThemeToDocument()`, which stamps `data-theme` on `<html>` and points every `<meta name="theme-color">` at the matching `--paper`. The same resolved value drives the system bars on Android through the `@/lib/status-bar` seam (a no-op on the web) — see [android-app.md](./android-app.md) Part 7.

Before any of that runs, `public/theme-init.js` — a blocking classic script in `<head>` — does the same resolution from the stored key and the media query and stamps the attribute, so a dark-mode user never sees a light first frame. It is external rather than inline because neither CSP has nonce/hash machinery; `theme-init.test.ts` keeps its storage key and media query in step with `theme.ts`. Decision record: [ADR 2026-09-12](./decisions/2026-09-12-theme-resolution.md).

The Settings control is `ThemeToggle` (a radiogroup sharing the language toggle's look); under System it captions what the phone currently resolves to.

## Accent colours are the resolver's job

The six accents in `src/lib/settings/accents.ts` carry hand-authored light `deep` and `soft` values. `applyAccentCss(accentId, resolvedTheme)` writes `--accent`, `--accent-deep` and `--accent-soft` inline on `<html>`: the authored values in light, and on dark `color-mix(in srgb, main 72%, white)` / `color-mix(in srgb, main 24%, transparent)`. Inline always wins the cascade, so a stylesheet override of those three tokens could only lose — which is why the dark block has none.

The accent-derivation percentages are a contract shared by the resolver and `scripts/check-contrast.mjs`; change both together.

## Adding a colour

1. Add a token to `:root` with its light value.
2. Add the dark value to `:root[data-theme='dark']` — or, if the token is a `var()` of another token, let it re-resolve.
3. Use `var(--your-token)` in the rule.
4. If it's text on a surface, add the pair to `scripts/check-contrast.mjs` and run `pnpm contrast:check`.
5. If you change `--paper`, change the Android copies too: `window_background` and `splash_background` in `android/app/src/main/res/values{,-night}/colors.xml`, and `BG` in `scripts/gen-icons.mjs` (then regenerate). `theme.test.ts` pins the XML resources to `PAPER` so a drift fails the suite instead of surfacing as a flash on a phone.

The allow-list in `src/styles.test.ts` (`LITERAL_ALLOWED`) is for the two token blocks, the desktop canvas outside the phone frame, and the JS-off `.noscript-fallback` splash. Adding to it is a reviewed decision, not a convenience.

## The contrast script

```bash
pnpm contrast:check
```

Reports WCAG ratios for a **hand-listed** set of foreground/background pairs actually used in the app, in both palettes, and fails if any pair is below its threshold — 4.5:1 for text (WCAG 1.4.3), 3:1 for an icon or control on a filled shape (1.4.11). There are no exemptions. Paste the table into the PR when you touch a token.

It's a PR artefact rather than a CI gate because the pair list drifts if nobody maintains it; a red gate over a stale list helps nobody. Keep the list honest when you add or remove a text-on-surface usage.

## Related

- [testing-strategy.md](./testing-strategy.md) — "Stylesheet lint tests".
- [ADR 2026-04-19 — Port prototype CSS](./decisions/2026-04-19-port-prototype-css.md) — why hand-written CSS with custom properties in the first place.
- [android-app.md](./android-app.md) — the native side of appearance (status bar, `values-night`, splash).
