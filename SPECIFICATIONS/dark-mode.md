# Dark mode — System / Light / Dark appearance for web and Android

Tracks [issue #154](https://github.com/mannepanne/takt-timer/issues/154).

## Problem

Takt's operating mode is a phone lying face-up, screen on, for the whole session — often in a gym with the lights down. A full-brightness off-white panel in that setting is unpleasant and, as one tester put it, makes the phone "shine like a lighthouse". Two closed-test testers asked for dark mode on day one of feedback. The app has exactly one appearance today: the light "paper" palette from the prototype.

The commonly cited battery argument is real only on OLED panels and modest even there — it is **not** the reason to do this. The reason is the gym.

## Solution

A three-state **Appearance** control in Settings — **System / Light / Dark** — defaulting to **System**, which follows the OS. The same tokens, components and control ship on web and Android; the native app additionally keeps the Android status bar and splash in step so it feels like a first-class Android app rather than a web page that went dark.

Why three states and not an on/off switch: the gym case is precisely "my phone is in light mode but I want Takt dark right now". System-default keeps the polite behaviour for everyone who doesn't care; the explicit states cover the people who asked.

Dark mode is a **second set of values for the existing design tokens**, not a second stylesheet. The prototype port ([ADR 2026-04-19](../REFERENCE/decisions/2026-04-19-port-prototype-css.md)) left the whole design keyed off `--paper`, `--ink`, `--rule`, `--accent` and friends on `:root`, and the accent-colour feature already proves the runtime mechanism (`applyAccentCss()` in `src/lib/settings/context.tsx` sets custom properties on `document.documentElement`). Theme is the same pattern with one attribute instead of three properties.

### Out of scope

- A quick-toggle on the Home top bar or the Run screen (the issue floats both). The Run screen is deliberately sparse and appearance isn't something you flip mid-set. Settings only for v1; revisit only if testers ask for the shortcut.
- Hand-tuned dark variants of the six accent palettes. Dark-mode accent shades are **derived** with `color-mix()` (already used in `styles.css`), not authored — see Architecture.
- A pure-black "AMOLED" variant, scheduled/sunset switching, or per-screen overrides.
- A dynamic PWA manifest — `theme_color`/`background_color` in `vite.config.ts` are static by nature. The web-PWA launch splash stays light. Accepted.
- Dark-mode store screenshots for the Play listing (`store-assets/`). Worth doing once this ships; separate task.
- iOS.
- The `.noscript-fallback` block, the `body`/`.app-shell` desktop canvas (already dark by design), and the `.tweaks` panel — the last is dead prototype CSS with no consumer in `src/` and is **deleted** as part of the leak sweep rather than themed.

## Behaviour

- **Three modes:** `system` (default), `light`, `dark`. Stored as `takt.theme.v1` in `localStorage` on both platforms; additionally synced to D1 for authenticated web users, exactly like accent and sound.
- **Resolution:** the mode resolves to a concrete `light` or `dark` appearance. `system` resolves from `prefers-color-scheme` and **re-resolves live** when the OS switches (no reload, no restart — the OS "dark at sunset" schedule just works while Takt is open).
- **No flash on load:** a dark-mode user never sees a white frame on cold start, reload, or PWA launch. This is a hard criterion, not a nice-to-have — it is the one place a dark-mode implementation reads as cheap.
- **Every surface follows.** Cards, chips, sheets, the voice overlay and its scrim, the drawer backdrop, toasts, toggles, the settings screen, the run screen, the count-in, the complete screen, onboarding, privacy. There is no "mostly dark" — a single white card on a dark screen fails acceptance.
- **Accents stay recognisable.** Lichen is still green, coral still coral. Their _usage_ shifts: on dark surfaces the "deep" shade (used for small icons and text) is a lighter tint of the accent rather than a darker one, and the "soft" tint is stronger so it remains visible.
- **Contrast holds.** Body text ≥ 4.5:1 against its surface, large text / UI ≥ 3:1, in both appearances, for all six accents. Verified by a script, not by eye.
- **Android status bar** icons stay legible: light icons over the dark app, dark icons over the light app — including when the user's explicit choice differs from the OS.
- **Android splash** follows the _OS_ appearance (it renders before any JS runs, so it cannot follow an in-app override). A user who forces Dark on a light-mode phone sees the light splash for a few hundred milliseconds, then dark. Accepted and documented.
- **Older Android (API < 29, Android 7–9):** the WebView cannot report `prefers-color-scheme`, so `system` resolves to `light`. Explicit `dark` still works fully (it's our attribute, not the media query). Accepted; `minSdk` is 24 and these devices are a rounding error, but the spec says it out loud.
- **Reduced motion / high contrast:** unchanged — this feature adds no motion and the existing `prefers-reduced-motion` block is untouched.

## Architecture

### Tokens: one dark block, keyed off a resolved attribute

`src/styles.css` gains a second token block:

```css
:root {
  /* existing light tokens … */
  color-scheme: light;
}
:root[data-theme='dark'] {
  --paper: #101214;
  --paper-2: #171a1e;
  --surface: #1c2025;
  --ink: #f5f4f0;
  --ink-2: #d9d7d0;
  --ink-3: #b0aea6;
  --mute: #7d8592;
  --rule: #262a30;
  --rule-strong: #343941;
  --success: #4fbf7f;
  --warn: #e08a3a;
  --danger: #e0605a;
  --shadow-soft: 0 0 0 1px rgba(255, 255, 255, 0.05);
  --shadow-lift: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}
```

These values are a **starting palette to be tuned on a real phone**, not a design decision — the acceptance criteria are the contrast numbers, not these hexes. Two principles behind them: dark paper is a warm near-black in the family of the existing `--ink` (`#0e1116`) so the brand doesn't go cold, and elevation inverts — cards (`--surface`) are _lighter_ than the page in dark mode, so shadows (near-invisible on dark) give way to hairline borders.

**Why an attribute-only dark block and no `@media (prefers-color-scheme)` block in CSS.** Takt is an app that cannot run without JS (there's a `<noscript>` fallback and nothing else), so the appearance is resolved in JS and stamped on `<html data-theme="light|dark">` — _always_, including in System mode. The CSS then has exactly one dark block and one source of truth. The alternative — a media-query block for System plus an attribute block for explicit overrides — means the ~20 dark tokens live in two places that must never drift, or CSS nesting / `light-dark()`, both too new to rely on across the Android WebView population. If the resolver script ever fails to load, the page degrades to light and the provider corrects it after mount: a flash, not a broken app.

`color-scheme` is set alongside the tokens so native form controls, scrollbars and the WebView's own chrome agree with the page, and — on Android — so the WebView treats the page as dark-aware and never applies algorithmic darkening on top (see Native, below).

### The colour-leak sweep

Roughly 40 declarations in `styles.css` bypass the tokens with literal `#fff`/hex/`rgba()` values (audited 12 Sep 2026; `awk` over the file, mapped to selectors). They fall into five groups and each gets a rule, so the sweep is mechanical rather than judgement-by-line:

| Group                                                                                                  | Examples                                                                                                    | Rule                                                                                              |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Card / raised surfaces** hard-coded white                                                            | `.chip`, `.history-chip`, `.preset-card`, `.last-session-card`, `.run-ctrl-secondary`                       | → `var(--surface)` (new token; `#ffffff` in light)                                                |
| **Hover / pressed tints** as ink-alpha                                                                 | `.btn-ghost:hover`, `.icon-btn:hover` (`rgba(14,17,22,0.03–0.04)`)                                          | → `var(--hover-tint)` (ink-alpha in light, white-alpha in dark)                                   |
| **Scrims and backdrops**                                                                               | `.voice-layer`, `.voice-overlay-scrim` (paper-alpha); `.drawer-backdrop`, `.pause-toast-dialog` (ink-alpha) | → `var(--scrim)` and `var(--backdrop)`                                                            |
| **Deliberately constant** — white knobs and white-on-accent/danger text that should stay white on both | `.switch .knob`, `.settings-toggle-thumb`, `.icon-btn-danger-confirm`, `.voice-overlay-mic`                 | → `var(--on-accent)` (`#fff` in both blocks — tokenised for greppability, not because it changes) |
| **Element shadows** with literal black-alpha                                                           | `.run-ctrl-primary`, `.voice-overlay-sheet`, `.mic-retry-toast`, the toggle thumbs                          | → the existing `--shadow-soft`/`--shadow-lift`, or a new `--shadow-pop` for the heavy 60px ones   |

Four tokens are **already referenced but never defined** — `--ink-muted` (`.accent-picker-label`, no fallback, so it silently inherits today), `--surface-subtle`, `--ink-faint`, `--accent-ink` (all with inline fallbacks). They become real tokens in both blocks; `--accent-ink` folds into `--on-accent`. This is a latent bug the sweep fixes for free.

**A lint test keeps it fixed.** `src/styles.test.ts` reads `styles.css` and fails if any hex or `rgba()` literal appears outside the `:root` / `:root[data-theme='dark']` token blocks, the `.noscript-fallback` rules, and the desktop canvas (`body`, `.app-shell`, `.app-viewport`'s frame shadow). Without this, the next PR reintroduces a `#fff` and dark mode quietly rots. The allow-list is explicit in the test so an intentional exception is a one-line, reviewed change.

### Accent in dark mode: derived, not authored

`accents.ts` keeps its six `{ main, deep, soft }` entries untouched — they are D1 IDs and light-mode values. `applyAccentCss()` keeps setting `--accent`, `--accent-deep`, `--accent-soft`. The dark block **overrides the derived two**:

```css
:root[data-theme='dark'] {
  --accent-deep: color-mix(in srgb, var(--accent) 72%, white);
  --accent-soft: color-mix(in srgb, var(--accent) 24%, transparent);
}
```

`--accent` itself is unchanged, so a lichen user is still unmistakably lichen. `--accent-deep` is consumed for small accent-coloured icons and text (`Icon.Play color="var(--accent-deep)"` in `LastSessionCard.tsx`, the rest-cue chip in `Run.tsx`) — on dark those need to go _lighter_, not darker, which is the whole reason this isn't a simple inversion. `--accent-contrast` (white text on accent-filled buttons) is unchanged in both modes; its contrast against `--accent` is a pre-existing property of the palette and not made worse here.

Cascade note: `applyAccentCss()` writes inline `style` properties on `<html>`, which beat any stylesheet rule — including the dark block's `color-mix` overrides. So on dark, `applyAccentCss()` must **not** write `--accent-deep`/`--accent-soft` inline (write `--accent` only and let the stylesheet derive the rest), or it must write the derived values itself. The spec picks the first: inline sets `--accent` on both modes, and the light-mode `--accent-deep`/`--accent-soft` move out of `accents.ts`'s runtime path into the same `color-mix()` shape in the light `:root` block, tuned to reproduce the current authored values closely. `accents.ts` keeps `deep`/`soft` fields only if something else reads them; if nothing does after this change, they're removed (the D1 `accent_colour` ID is the only contract).

### Resolution and persistence: `SettingsProvider`, plus a pre-paint script

**No new provider.** `SettingsProvider` already owns accent + sound, the `localStorage` keys, and the one-shot D1 fetch / `PUT /api/me/settings` sync, platform-gated so native never syncs (07c). Theme joins it:

- `themeMode: 'system' | 'light' | 'dark'`, `setThemeMode(mode)`, and `resolvedTheme: 'light' | 'dark'` on `SettingsContextValue`.
- `readStoredTheme()` mirrors `readStoredAccent()` — unknown or malformed values fall back to `'system'`.
- `applyThemeCss(resolved)` sets `document.documentElement.dataset.theme`. Idempotent, so it doesn't fight the pre-paint script that already stamped the same value.
- While `themeMode === 'system'`, a `matchMedia('(prefers-color-scheme: dark)')` `change` listener re-resolves and re-applies. Removed when the mode is explicit or on unmount.
- `setThemeMode` persists to `localStorage` and calls `persistToServer({ theme })`; the D1 fetch reads `data.theme` like `data.accent_colour`.
- `resolvedTheme` is what the native status-bar seam and the `theme-color` meta update from (below).

**Pre-paint script — `public/theme-init.js`.** Roughly a dozen lines, loaded as a classic blocking `<script src="/theme-init.js">` in `<head>` before the stylesheet: read `takt.theme.v1`, resolve `system` via `matchMedia`, set `data-theme`. Wrapped in `try/catch` so a throwing `localStorage` (private mode, some WebViews) degrades to light rather than blank.

Why an **external** file and not an inline `<script>`: the web CSP is `script-src 'self' https://static.cloudflareinsights.com` with no nonce or hash machinery (`worker/lib/securityHeaders.ts`), and the native CSP is `script-src 'self'` (`vite.native-html.ts`). An inline script would need a hash kept in sync by hand across two CSP constants and `index.html` — a drift trap. An external file under `/` is allowed by `'self'` on both, is precached by Workbox (`**/*.js` is in `globPatterns`), survives `transformNativeHtml` (its regexes only target font/analytics hosts), and needs **no CSP change at all**. `vite.native-html.test.ts` gains an assertion that the tag survives the native transform, and `worker/lib/securityHeaders.test.ts` is unchanged — which is the point.

Why not skip the script and rely on CSS: with attribute-only tokens there is nothing for CSS to key off until JS runs, and the explicit-Dark user (the gym case) would get a white flash on every cold start. The script is what makes "no flash" a criterion rather than a hope.

The script duplicates the `takt.theme.v1` key string (it can't import from `src/`). `theme-init.test.ts` (root-level, next to `vite.native-html.test.ts`) reads the file with `readFileSync`, runs it via `new Function` against a stubbed `document`/`localStorage`/`matchMedia`, covers the 3 stored values × 2 media states plus missing/garbage/throwing storage, and asserts the key string equals the constant exported from `context.tsx`. `public/` is outside the coverage `include` globs, so this test exists for correctness, not for the thresholds — said plainly so nobody "fixes" the exclusion.

### `theme-color` and `color-scheme` metas (web)

- `index.html` gets `<meta name="color-scheme" content="light dark">` — required for the Android WebView to treat the page as dark-aware (see Native) and correct on every browser.
- The single `theme-color` meta becomes two, with `media="(prefers-color-scheme: light|dark)"`, carrying `#f5f4f0` and the dark `--paper`. This handles System mode with no JS. For an explicit override, `SettingsProvider` sets both metas' `content` to the resolved paper colour. Incidental fix: the current value `#F3F1EC` doesn't match `--paper` (`#f5f4f0`) or the manifest (`#F5F4F0`); it becomes `#f5f4f0`.

### Data: one nullable-by-default column, lenient PUT

Migration `worker/db/migrations/0005_theme_column.sql`, mirroring `0002`:

```sql
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'
  CHECK (theme IN ('system', 'light', 'dark'));
```

CI applies migrations before deploy (see the migrations memory / `wrangler.toml` `migrations_dir`); no manual step. `schema.ts` (`UserRow`, `UserSettings`), `queries.ts` (`insertUser`, `getUserSettings`, `updateUserSettings`), `registration.ts` (default `'system'`), and `worker/api/me/settings.ts` (`VALID_THEMES`, `invalid_theme`) all grow the field.

**`PUT /api/me/settings` treats `theme` as optional, defaulting to `'system'` when absent** — validated when present. This is deliberate, not sloppy: the SPA is served through a service worker with `autoUpdate`, so for one load after deploy a still-cached client will PUT the old three-field body. Making `theme` required would 400 that request and — because `persistToServer` swallows errors — silently drop the user's accent/sound change. The lenient contract costs one `??` and removes the window. Documented in `REFERENCE/auth-and-presets-api.md`.

`GET` returns `theme` alongside the other three. No admin surface reads settings columns; the retention purge and delete-cascade are unaffected.

### Native: status bar, splash, and the WebView's idea of "dark"

Three small pieces, all following Phase 7's existing seams and rules ([android-app.md](../REFERENCE/android-app.md) Part 3 — any plugin install is followed by `pnpm android:check`, because manifest-merge is where `INTERNET` could sneak back).

1. **Status bar via `@capacitor/status-bar` (v8), behind a seam.** `src/lib/status-bar.ts` is a web no-op; `src/lib/status-bar-native.ts` wraps the plugin and is aliased in `vite.config.ts` exactly like `wakeLock-platform` / `app-lifecycle`, so the plugin never enters the web bundle. `SettingsProvider` calls `setStatusBarStyle(resolvedTheme)` whenever `resolvedTheme` changes. Note the plugin's naming: `Style.Dark` means _light icons for a dark background_ — the seam maps `'dark' → Style.Dark`, `'light' → Style.Light`, and the unit test pins that inversion so nobody "fixes" it. On Android 15+/16 edge-to-edge, `setBackgroundColor` is a documented no-op; only `setStyle` is used. No new permission.

2. **Splash follows the OS.** `res/values-night/ic_launcher_background.xml` overrides `splash_background` with the dark `--paper`. The launcher-icon background is **not** overridden — icons don't change with theme. `scripts/gen-icons.mjs` is untouched.

3. **The WebView must actually report dark.** Behaviour by API level, from the Android docs: on **33+** the WebView derives `prefers-color-scheme` from the activity theme's `isLightTheme`, which our `Theme.AppCompat.DayNight.NoActionBar` sets automatically — nothing to do. On **29–32** it does not, unless force-dark is `AUTO`; `MainActivity` therefore gains a guarded call in `onCreate` after `super.onCreate()`:

   ```java
   WebSettings s = getBridge().getWebView().getSettings();
   if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
     WebSettingsCompat.setForceDark(s, WebSettingsCompat.FORCE_DARK_AUTO);
   }
   if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
     WebSettingsCompat.setForceDarkStrategy(s, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY);
   }
   ```

   `androidx.webkit` is already a dependency (`variables.gradle`). `WEB_THEME_DARKENING_ONLY` plus the `color-scheme` meta guarantees the WebView never algorithmically inverts our already-dark page. On 33+ these calls are deprecated no-ops behind the feature guard. Below 29 nothing works and `system` means light (see Behaviour). `AndroidManifest.xml` already lists `uiMode` in `configChanges`, so an OS theme flip doesn't recreate the activity — the `matchMedia` listener sees a live `change` event instead. **All three of these are device-verify items, not assumptions** — see Acceptance criteria.

### Sequencing: three PRs

1. **Tokens + leak sweep + lint test** (`styles.css`, `styles.test.ts`). No visible change — the dark block exists but nothing sets the attribute. Reviewable as a pure refactor; the lint test proves the sweep is complete.
2. **Setting + resolution + persistence** (`SettingsProvider`, `ThemeToggle`, `theme-init.js`, metas, D1 migration + API, i18n, docs). Dark mode ships on web here, and on Android as far as the WebView is concerned.
3. **Native integration** (`@capacitor/status-bar` seam, `values-night`, `MainActivity`, `android:check`, `versionCode` bump). Device-verified before merge.

## UI

- **Settings screen:** a new section between **Accent colour** and **Sound effects** — label `t('settings.theme')` = "Appearance" / "Utseende", control `ThemeToggle`: three segments **System / Light / Dark** (`settings.theme.system|light|dark` = "System" / "Ljust" / "Mörkt"; Swedish "System" is the same word). Selecting one calls `setThemeMode` and fires the existing "Saved" toast via `triggerSaved()`, like every other row.
- **`ThemeToggle`** reuses the `LanguageToggle` visual (`.lang-toggle` / `.lang-toggle-btn` rules become a grouped selector `.lang-toggle, .theme-toggle { … }` — no rename, no risk to the language tests). Semantics are `role="radiogroup"` with three `role="radio"` / `aria-checked` buttons (three exclusive options; `AccentPicker` already uses this shape), rather than the language toggle's `group` + `aria-pressed`.
- Shown on **both** platforms — unlike language (native is English-only) and account (native has none), appearance is meaningful everywhere.
- The **accent swatches** need a visible ring on dark: `.accent-swatch.selected` uses `border-color: var(--ink)` today, which flips to off-white on dark automatically via the token — verify it reads as "selected" and not as "glowing".
- No other screen changes. Everything else follows from the tokens.

## Accessibility

- `ThemeToggle` is a proper radiogroup, keyboard-operable, with the current mode announced.
- Contrast targets (WCAG AA: 4.5:1 body, 3:1 large text / UI components) are checked programmatically for **every text-token × surface-token pair used in the app** and for each accent's `--accent-deep` on `--paper` and `--surface`, in both appearances. The check is a small Node script (`scripts/check-contrast.mjs`) run in the PR, with its output pasted into the PR description; it is not a CI gate for v1 because token values will be tuned on device and a red gate mid-tuning helps nobody. Promote to CI once the palette settles.
- `color-scheme` keeps native form controls (the numeric steppers on Configure) and the scrollbar legible.
- Nothing here changes focus order, motion, or announcements.

## Analytics

None. No new route, no event. The web beacon is unchanged and the native build has none.

## Files affected

| File                                                                             | Change                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------- |
| `src/styles.css`                                                                 | Dark token block; new tokens `--surface`, `--hover-tint`, `--scrim`, `--backdrop`, `--on-accent`, `--shadow-pop`, and real definitions for `--ink-muted`/`--surface-subtle`/`--ink-faint`; leak sweep; `.theme-toggle`; delete `.tweaks`; `color-scheme` |
| `src/styles.test.ts`                                                             | New — colour-literal lint with an explicit allow-list                                                                                                                                                                                                    |
| `src/lib/settings/accents.ts`                                                    | Drop `deep`/`soft` if nothing reads them after the `color-mix` move; IDs untouched                                                                                                                                                                       |
| `src/lib/settings/context.tsx`                                                   | `themeMode` / `setThemeMode` / `resolvedTheme`; `takt.theme.v1`; `matchMedia` listener; `applyThemeCss`; D1 fetch + PUT gain `theme`; status-bar + `theme-color` side effects; `applyAccentCss` writes `--accent` only                                   |
| `src/lib/settings/context.test.tsx`                                              | Update — default/system, read/persist, resolve, live OS change, explicit override ignores OS, D1 round-trip, malformed storage                                                                                                                           |
| `src/components/ThemeToggle.tsx` / `.test.tsx`                                   | New — radiogroup segmented control                                                                                                                                                                                                                       |
| `src/components/AccentPicker.test.tsx`                                           | Update only if `accents.ts` shape changes                                                                                                                                                                                                                |
| `src/routes/Settings.tsx` / `.test.tsx`                                          | Appearance row between accent and sound; toast on change; shown on native                                                                                                                                                                                |
| `src/i18n/strings.ts`                                                            | `settings.theme`, `settings.theme.system                                                                                                                                                                                                                 | light | dark` (en + sv) |
| `src/lib/status-bar.ts` / `status-bar-native.ts` / `status-bar-native.test.ts`   | New — seam + native implementation + `Style` mapping test                                                                                                                                                                                                |
| `src/test-utils/setup.ts`                                                        | Add a `window.matchMedia` stub — jsdom has none, and every render through `SettingsProvider` would throw                                                                                                                                                 |
| `public/theme-init.js`                                                           | New — pre-paint resolver                                                                                                                                                                                                                                 |
| `theme-init.test.ts`                                                             | New — root-level, exercises the file via `readFileSync` + `new Function`; asserts the storage key matches `context.tsx`                                                                                                                                  |
| `index.html`                                                                     | `<script src="/theme-init.js">` in `<head>`; `color-scheme` meta; two `theme-color` metas; `#F3F1EC` → `#f5f4f0`                                                                                                                                         |
| `vite.native-html.test.ts`                                                       | Assert the script tag and metas survive the native transform                                                                                                                                                                                             |
| `vite.config.ts`                                                                 | Native alias `@/lib/status-bar` → `status-bar-native.ts`                                                                                                                                                                                                 |
| `package.json`                                                                   | `@capacitor/status-bar` ^8                                                                                                                                                                                                                               |
| `worker/db/migrations/0005_theme_column.sql`                                     | New                                                                                                                                                                                                                                                      |
| `worker/db/schema.ts`, `worker/db/queries.ts`, `worker/api/auth/registration.ts` | `theme` field, default `'system'`                                                                                                                                                                                                                        |
| `worker/api/me/settings.ts` / `.test.ts`                                         | `VALID_THEMES`, `invalid_theme`; optional-with-default on PUT; returned on GET                                                                                                                                                                           |
| `android/app/src/main/res/values-night/ic_launcher_background.xml`               | New — dark `splash_background` only                                                                                                                                                                                                                      |
| `android/app/src/main/java/org/hultberg/takt/MainActivity.java`                  | Guarded force-dark AUTO + web-theme-only strategy                                                                                                                                                                                                        |
| `android/app/build.gradle`                                                       | `versionCode` bump for the closed-track upload                                                                                                                                                                                                           |
| `scripts/check-contrast.mjs`                                                     | New — token-pair WCAG check                                                                                                                                                                                                                              |
| `REFERENCE/auth-and-presets-api.md`                                              | `theme` on GET/PUT; the optional-with-default rule and why                                                                                                                                                                                               |
| `REFERENCE/android-app.md`                                                       | Part 3: the status-bar plugin + `values-night`; Part 5-adjacent: the WebView force-dark note by API level                                                                                                                                                |
| `REFERENCE/i18n.md`                                                              | Only if a new key shape is introduced (none expected)                                                                                                                                                                                                    |
| `CLAUDE.md`, `SPECIFICATIONS/CLAUDE.md`                                          | Post-launch feature pointer while in progress; archive on ship                                                                                                                                                                                           |

## Acceptance criteria

**Tokens and sweep (PR 1)**

- [ ] `src/styles.test.ts` passes: no hex/`rgba()` literal outside the allow-listed blocks.
- [ ] `.tweaks` is gone; `grep -rn tweaks src` returns nothing.
- [ ] `--ink-muted`, `--surface-subtle`, `--ink-faint` are defined in both token blocks; `--accent-ink` is replaced by `--on-accent` everywhere.
- [ ] With `data-theme="dark"` set manually in devtools, every screen (Home, Configure, Run incl. count-in and rest, Complete, Settings, Onboarding, Privacy, the presets drawer, the voice overlay, the pause dialog, the mic-retry toast) renders with **no white or light-grey surface** — screenshot set attached to the PR.

**Behaviour (PR 2)**

- [ ] Settings shows **Appearance** with System / Light / Dark; the current mode is checked; changing it shows the "Saved" toast.
- [ ] Default with nothing stored is System.
- [ ] System + OS dark → dark; System + OS light → light; flipping the OS setting while the app is open re-renders **without reload**.
- [ ] Light and Dark ignore the OS setting, in both directions.
- [ ] A dark-mode user (both explicit Dark and System-on-a-dark-OS) sees **no light frame** on cold start, hard reload, or PWA launch — checked with a throttled-CPU screen recording, not by eye.
- [ ] `takt.theme.v1` round-trips; garbage or a throwing `localStorage` falls back to System without an error in the console.
- [ ] Authenticated web user: mode persists to D1 and comes back on another browser after sign-in; `GET /api/me/settings` includes `theme`.
- [ ] `PUT /api/me/settings` without `theme` succeeds and stores `'system'`; with `theme: 'sepia'` returns `400 invalid_theme`.
- [ ] `theme-color` metas track the resolved appearance (browser chrome matches the page) in Safari iOS and Chrome Android.
- [ ] `scripts/check-contrast.mjs` reports every checked pair ≥ AA in both appearances for all six accents; output in the PR.
- [ ] All new strings exist in English and Swedish.
- [ ] `worker/lib/securityHeaders.test.ts` is unchanged and green — the CSP was not touched.

**Native (PR 3) — real device, not emulator**

- [ ] On the test OnePlus (API 33+): System follows the OS toggle live; explicit Dark on a light OS shows light status-bar icons over the dark app; explicit Light on a dark OS shows dark icons over the light app.
- [ ] Splash is dark when the OS is dark; light when light. The documented light-splash-then-dark case for "Dark on a light OS" is observed and accepted, not hidden.
- [ ] On the oldest Android device available (ideally API 29–32): System resolves to dark when the OS is dark. If no such device is available, this is recorded as **untested** in the PR rather than assumed.
- [ ] No algorithmic darkening artefacts (double-inverted images, wrong greys) on any device.
- [ ] `pnpm android:check` passes after `@capacitor/status-bar` is synced — still no `INTERNET`, recogniser `<queries>` intact.
- [ ] Hardware back button, keep-awake, voice, and presets are unaffected (smoke run of each on device).

## Risks

- **The palette is wrong on first try.** Certain. That's why the criteria are contrast numbers and screenshots, and why PR 1 ships the tokens before anything can select them.
- **A leak survives the sweep.** The lint test makes the sweep provable; the devtools walk-through in PR 1 catches anything the regex can't (e.g. an SVG `fill`).
- **`color-mix()` support.** Baseline since 2023 (Chrome 111, Safari 16.2, Firefox 113); `styles.css` already relies on it. The Android WebView updates via Play independently of OS version. Accepted.
- **Inline accent properties beating the dark block** — the cascade trap described under Accent. Handled by design (inline sets `--accent` only); the `context.test.tsx` case "dark + coral yields a lighter `--accent-deep`" pins it.
- **WebView on API 29–32 still reports light.** The force-dark call is the documented fix; if it doesn't work on a real device, `system` degrades to light on those devices (explicit Dark unaffected) and the PR says so. Not a blocker for the feature.
- **Service-worker skew on deploy.** Handled by the lenient PUT; also `theme-init.js` is a new precached asset — a client on the old SW simply doesn't have it until the SW updates, which means at worst one light flash for one load. Accepted.
- **Play closed test in flight.** PR 3 bumps `versionCode` and uploads to the closed track as a normal update; it doesn't reset the 14-day clock (see `android-app.md` Part 1, step 6). Ship it after the palette is settled, not mid-tuning — testers shouldn't get three palettes in a week.

## Decision to record

Resolving appearance in JS to a single `data-theme` attribute (attribute-only CSS, external pre-paint script, no CSP change) and routing native chrome through a Vite-aliased seam are choices that outlast this PR. If agreed, they get an ADR — `REFERENCE/decisions/2026-09-xx-theme-resolution-and-tokens.md` — written alongside PR 2.
