# Dark mode — System / Light / Dark appearance for web and Android

Tracks [issue #154](https://github.com/mannepanne/takt-timer/issues/154). Reviewed with `/review-spec` on 12 Sep 2026; this revision resolves every blocking finding and condition from that review.

## Problem

Takt's operating mode is a phone lying face-up, screen on, for the whole session — often in a gym with the lights down. A full-brightness off-white panel in that setting is unpleasant and, as one tester put it, makes the phone "shine like a lighthouse". Two closed-test testers asked for dark mode on day one of feedback. The app has exactly one appearance today: the light "paper" palette from the prototype.

The commonly cited battery argument is real only on OLED panels and modest even there — it is **not** the reason to do this. The reason is the gym.

## Solution

A three-state **Appearance** control in Settings — **System / Light / Dark** — defaulting to **System**, which follows the OS. The same tokens, components and control ship on web and Android; the native app additionally keeps the Android status bar, window background and splash in step so it feels like a first-class Android app rather than a web page that went dark.

Why three states and not an on/off switch: the gym case is precisely "my phone is in light mode but I want Takt dark right now". System-default keeps the polite behaviour for everyone who doesn't care; the explicit states cover the people who asked.

Dark mode is a **second set of values for the existing design tokens**, not a second stylesheet. The prototype port ([ADR 2026-04-19](../REFERENCE/decisions/2026-04-19-port-prototype-css.md)) left the whole design keyed off `--paper`, `--ink`, `--rule`, `--accent` and friends on `:root`, and the accent-colour feature already proves the runtime mechanism (`applyAccentCss()` in `src/lib/settings/context.tsx` sets custom properties on `document.documentElement`). Theme is the same pattern with one attribute instead of three properties.

### Out of scope

- **Cross-device sync of the appearance setting.** Appearance is device-scoped by nature — dark on the gym phone and light on the laptop is _correct_, not a sync failure. Native never syncs anything (07c), so a D1 column would serve only authenticated web users running two browsers, and adding one later is trivial if that ever matters. No migration, no API change, no worker code. `localStorage` on each device is the store, on both platforms.
- A quick-toggle on the Home top bar or the Run screen (the issue floats both). The Run screen is deliberately sparse and appearance isn't something you flip mid-set. Settings only for v1; revisit only if testers ask for the shortcut.
- Hand-tuned dark variants of the six accent palettes. Dark-mode accent shades are **derived** with `color-mix()`, not authored — see Architecture.
- A pure-black "AMOLED" variant, scheduled/sunset switching, or per-screen overrides.
- A dynamic PWA manifest — `theme_color`/`background_color` in `vite.config.ts` are static by nature. The web-PWA launch splash stays light. Accepted.
- Dark-mode store screenshots for the Play listing (`store-assets/`). Tracked as a GitHub issue opened when PR 2 merges, so it survives this spec being archived.
- iOS.
- The `.noscript-fallback` block, the `body`/`.app-shell` desktop canvas (already dark by design), and the `.tweaks` panel — the last is dead prototype CSS with no consumer in `src/` and is **deleted** as part of the leak sweep rather than themed.

## Behaviour

- **Three modes:** `system` (default), `light`, `dark`. Stored as `takt.theme.v1` in `localStorage` on both platforms. Never synced. On Android the key sits under the `takt.*` umbrella that `allowBackup="false"` wipes on reinstall (07h) — appearance resetting to System on reinstall is intended, not an oversight.
- **Resolution:** the mode resolves to a concrete `light` or `dark` appearance. `system` resolves from `prefers-color-scheme` and **re-resolves live** when the OS switches (no reload, no restart — the OS "dark at sunset" schedule just works while Takt is open). On native it also re-resolves when the app returns to the foreground, in case the OS flipped while Takt was backgrounded.
- **No flash on load, on either platform:** a dark-mode user never sees a white frame on cold start, reload, or PWA launch on web, nor between splash dismissal and first paint on Android. This is a hard criterion, not a nice-to-have — it is the one place a dark-mode implementation reads as cheap.
- **Every surface follows.** Cards, chips, sheets, the voice overlay and its scrim, the drawer backdrop, toasts, toggles, the settings screen, the run screen, the count-in, the complete screen, the Timer/stopwatch screen, onboarding, privacy. There is no "mostly dark" — a single white card on a dark screen fails acceptance.
- **Ink-filled elements invert deliberately, not automatically.** The primary CTA, the progress-bar fill, set dots, toasts and the active segment of a toggle are "ink on paper" today; in dark they must not become blinding off-white blocks. See the sixth sweep group.
- **Accents stay recognisable.** Lichen is still green, coral still coral. Their _usage_ shifts: on dark surfaces the "deep" shade (used for small icons and text) is a lighter tint of the accent rather than a darker one, and the "soft" tint is stronger so it remains visible. **Light mode's accent values do not change at all.**
- **Contrast does not regress.** No token pair scores worse in dark than in light, and no light pair gets worse. Verified by a script, not by eye. (The light palette already has pre-existing pairs below AA — `--mute`, `--warn`, `--success`, white-on-accent — which are documented exemptions, not something this feature fixes or is blocked by.)
- **Android status bar** icons stay legible: light icons over the dark app, dark icons over the light app — including when the user's explicit choice differs from the OS.
- **Android splash and window background** follow the _OS_ appearance (they render before any JS runs, so they cannot follow an in-app override). A user who forces Dark on a light-mode phone sees a light splash for a few hundred milliseconds, then dark. Accepted and documented.
- **Older Android (API < 29, Android 7–9):** the WebView cannot report `prefers-color-scheme`, so `system` resolves to `light`. Explicit `dark` still works fully (it's our attribute, not the media query). Accepted; `minSdk` is 24 and these devices are a rounding error, but the spec says it out loud.
- **Reduced motion / high contrast:** unchanged — this feature adds no motion and the existing `prefers-reduced-motion` block is untouched.

## Architecture

### Tokens: one dark block, keyed off a resolved attribute

`src/styles.css` gains a second token block:

```css
:root {
  /* existing light tokens … plus the new ones below, with light values */
  --surface: #ffffff;
  --fill: var(--ink);
  --on-fill: var(--paper);
  --on-accent: #ffffff;
  --hover-tint: rgba(14, 17, 22, 0.04);
  --scrim: rgba(245, 244, 240, 0.78);
  --backdrop: rgba(14, 17, 22, 0.55);
  --frame-ring: rgba(255, 255, 255, 0.04);
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
  --fill: #2a2f36;
  --on-fill: #f5f4f0;
  --on-accent: #ffffff;
  --hover-tint: rgba(255, 255, 255, 0.06);
  --scrim: rgba(16, 18, 20, 0.82);
  --backdrop: rgba(0, 0, 0, 0.6);
  --frame-ring: rgba(255, 255, 255, 0.1);
  --shadow-soft: 0 0 0 1px rgba(255, 255, 255, 0.05);
  --shadow-lift: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}
```

The dark block contains **no accent rules** — accent shades are written inline by `applyAccentCss()` (below).

These values are a **starting palette to be tuned on a real phone**, not a design decision — the acceptance criteria are the no-regression contrast check and the screenshot walk-through, not these hexes. Two principles behind them: dark paper is a warm near-black in the family of the existing `--ink` (`#0e1116`) so the brand doesn't go cold, and elevation inverts — cards (`--surface`) are _lighter_ than the page in dark mode, so shadows (near-invisible on dark) give way to hairline borders.

**Why an attribute-only dark block and no `@media (prefers-color-scheme)` block in CSS.** Takt is an app that cannot run without JS (there's a `<noscript>` fallback and nothing else), so the appearance is resolved in JS and stamped on `<html data-theme="light|dark">` — _always_, including in System mode. The CSS then has exactly one dark block and one source of truth. The alternative — a media-query block for System plus an attribute block for explicit overrides — means the ~25 dark tokens live in two places that must never drift, or CSS nesting / `light-dark()`, both too new to rely on across the Android WebView population. If the resolver script ever fails to load, the page degrades to light and the provider corrects it after mount: a flash, not a broken app.

`color-scheme` is set alongside the tokens so native form controls, scrollbars and the WebView's own chrome agree with the page, and — on Android — so the WebView treats the page as dark-aware and never applies algorithmic darkening on top (see Native, below).

### The colour-leak sweep — six groups

43 declarations in `styles.css` bypass the tokens with literal `#fff`/hex/`rgba()` values (audited 12 Sep 2026; `awk` over the file, mapped to selectors). No colour literal exists in any `.ts`/`.tsx` — icons are `currentColor`, `Wordmark`/`Sparkline` carry no colour — so the sweep is CSS-only and the lint test below is genuinely sufficient. Five groups are mechanical; the sixth is the one that costs design time:

| Group                                                                                           | Examples                                                                                                                                                                                                                                                                      | Rule                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Card / raised surfaces** hard-coded white                                                     | `.chip`, `.history-chip`, `.preset-card`, `.last-session-card`, `.run-ctrl-secondary`                                                                                                                                                                                         | → `var(--surface)`                                                                                                             |
| **Hover / pressed tints** as ink-alpha                                                          | `.btn-ghost:hover`, `.icon-btn:hover` (`rgba(14,17,22,0.03–0.04)`)                                                                                                                                                                                                            | → `var(--hover-tint)`. Merging 0.03 and 0.04 into one token is a deliberate, tiny light-mode change — say so in the PR body    |
| **Scrims and backdrops**                                                                        | `.voice-layer`, `.voice-overlay-scrim` (paper-alpha); `.drawer-backdrop`, `.pause-toast-dialog` (ink-alpha)                                                                                                                                                                   | → `var(--scrim)` and `var(--backdrop)`                                                                                         |
| **Deliberately constant** — white knobs and white-on-accent/danger text that stay white on both | `.switch .knob`, `.settings-toggle-thumb`, `.icon-btn-danger-confirm`, `.voice-overlay-mic`, and every current `--accent-contrast` consumer                                                                                                                                   | → `var(--on-accent)` (`#fff` in both blocks — tokenised for greppability, not because it changes)                              |
| **Element shadows** with literal black-alpha                                                    | `.run-ctrl-primary`, `.voice-overlay-sheet`, `.mic-retry-toast`, the toggle thumbs, `.app-viewport`'s 1px frame ring                                                                                                                                                          | → the existing `--shadow-soft`/`--shadow-lift`, a new `--shadow-pop` for the heavy 60px ones, `--frame-ring` for the frame     |
| **Ink-filled elements** — token-correct today, inverted _wrongly_ by a naive swap               | `.btn-primary`, `.run-ctrl-primary`, `.run-bar .fill`, `.set-dots .dot.done` / `.active`, `.switch.on`, `.pager .pd.active`, `.toast`, `.run-cue-chip`, `.mic-retry-toast`, `.lang-toggle-btn.active`, `.accent-swatch.selected`, `.preset-card.dragging`, `.proc-dots .pdot` | → `background: var(--fill); color: var(--on-fill)` — a mid-surface fill in dark, not off-white. **Each is a design judgement** |

The sixth group is where the hours go. `background: var(--ink); color: var(--paper)` passes the lint test and the contrast script and produces the brightest objects on the Run screen — the primary CTA, the main run control, the **progress-bar fill**, the set dots, the toasts — as solid off-white blocks. Fourteen rules, each a "what should this be on dark?" decision made on device. Budget **3–5 hours of design time**, not a find-and-replace. The `--fill`/`--on-fill` pair is the mechanism; the values are tuned in PR 1's walk-through. This is also why PR 1 is _not_ a pure refactor (see Sequencing).

Token consolidation: `--accent-contrast`, `--accent-ink` and the new `--on-accent` all mean "white on a coloured fill". They collapse into **one** token, `--on-accent`; the other two names disappear. Four tokens are **already referenced but never defined** — `--ink-muted` (`.accent-picker-label`, no fallback, so it silently inherits today), `--surface-subtle`, `--ink-faint`, `--accent-ink` (with inline fallbacks). The first three become real tokens in both blocks; the fourth folds into `--on-accent`. A latent bug the sweep fixes for free.

**A lint test keeps it fixed.** `src/styles.test.ts` reads `styles.css` and fails if any hex or `rgba()` literal appears outside the `:root` / `:root[data-theme='dark']` token blocks, the `.noscript-fallback` rules, and the desktop canvas (`body`, `.app-shell`). Without this, the next PR reintroduces a `#fff` and dark mode quietly rots. The allow-list is explicit in the test so an intentional exception is a one-line, reviewed change.

**Desktop canvas.** `body`/`.app-shell` stay literal near-black and out of scope, but with dark `--paper` the phone-width viewport would vanish into them. `--frame-ring` (the `.app-viewport` 1px ring) is stronger on dark precisely so the frame stays visible. Requirement stated, not assumed.

### Accent in dark mode: derived inline, light mode untouched

`accents.ts` is **unchanged** — its six `{ id, main, deep, soft }` entries are D1 IDs and hand-authored light values, and stay exactly as they are. The review established that no single `color-mix()` percentage reproduces the authored `deep` values (their per-channel ratios differ within and between accents), and that trying would drop ocean and amber below AA _in light mode_. So light is never derived.

`applyAccentCss(accentId, resolvedTheme)` writes all three custom properties inline on `<html>`, every time either argument changes:

- **Light:** `--accent` = `main`, `--accent-deep` = the authored `deep`, `--accent-soft` = the authored `soft`. Byte-identical to today.
- **Dark:** `--accent` = `main`, `--accent-deep` = `color-mix(in srgb, ${main} 72%, white)`, `--accent-soft` = `color-mix(in srgb, ${main} 24%, transparent)` — written as inline string values, which is valid CSS.

`--accent` itself never changes, so a lichen user is still unmistakably lichen. `--accent-deep` is consumed for small accent-coloured icons and text (`Icon.Play color="var(--accent-deep)"` in `LastSessionCard.tsx`, the rest-cue chip in `Run.tsx`) — on dark those need to go _lighter_, not darker, which is the whole reason this isn't a simple inversion.

This is strictly simpler than deriving in the stylesheet: inline properties always win the cascade, so there is no cascade trap to reason about, the dark block needs zero accent rules, and `AccentPicker` and its tests are untouched. `context.test.tsx` pins "dark + coral yields a `--accent-deep` containing `color-mix` and `white`" and "light + coral yields the authored `#b83a3a`". `color-mix()` is baseline since 2023 (Chrome 111, Safari 16.2, Firefox 113); `styles.css` uses it once today and the Android WebView updates via Play independently of OS version. Accepted.

### Resolution: `SettingsProvider`, plus a pre-paint script

**No new provider.** `SettingsProvider` already owns accent + sound and their `localStorage` keys. Theme joins it — and, unlike accent and sound, never touches the D1 sync path:

- `themeMode: 'system' | 'light' | 'dark'`, `setThemeMode(mode)`, and `resolvedTheme: 'light' | 'dark'` on `SettingsContextValue`.
- `readStoredTheme()` mirrors `readStoredAccent()` — unknown or malformed values fall back to `'system'`.
- `applyThemeCss(resolved)` sets `document.documentElement.dataset.theme`. Idempotent, so it doesn't fight the pre-paint script that already stamped the same value.
- While `themeMode === 'system'`, a `matchMedia('(prefers-color-scheme: dark)')` `change` listener re-resolves and re-applies. Removed when the mode is explicit or on unmount.
- On native, the existing app-lifecycle seam's foreground signal (`appStateChange` → active, 07g) triggers one extra re-resolve, because the OS may have flipped while Takt was backgrounded and the WebView's `change` event may or may not have fired meanwhile.
- `setThemeMode` persists to `localStorage` only. `persistToServer` and the one-shot D1 fetch are not touched.
- `resolvedTheme` drives three side effects: `applyAccentCss`, the native status bar, and the `theme-color` metas.

**Pre-paint script — `public/theme-init.js`.** Roughly a dozen lines, loaded as a classic blocking `<script src="/theme-init.js">` in `<head>` before the stylesheet: read `takt.theme.v1`, resolve `system` via `matchMedia`, set `data-theme`. Wrapped in `try/catch` so a throwing `localStorage` (private mode, some WebViews) degrades to light rather than blank. It is one extra small render-blocking request on an uncached cold load — the no-flash recording criterion should quote that cost, not hand-wave it. The file is unhashed and served through Workers Assets' ETag revalidation; don't later add a long immutable `Cache-Control` for `/*.js` without thinking about this file.

Why an **external** file and not an inline `<script>`: the web CSP is `script-src 'self' https://static.cloudflareinsights.com` with no nonce or hash machinery (`worker/lib/securityHeaders.ts`), and the native CSP is `script-src 'self'` (`vite.native-html.ts`). An inline script would need a hash kept in sync by hand across two CSP constants and `index.html` — a drift trap. An external file under `/` is allowed by `'self'` on both, is precached by Workbox (`**/*.js` is in `globPatterns`), survives `transformNativeHtml` (its regexes only target font/analytics hosts, and `[^>]*` cannot cross a preceding tag's `>`), and needs **no CSP change at all**. `vite.native-html.test.ts` gains an assertion that the tag survives the native transform, and `worker/lib/securityHeaders.test.ts` is unchanged — which is the point.

Why not skip the script and rely on CSS: with attribute-only tokens there is nothing for CSS to key off until JS runs, and the explicit-Dark user (the gym case) would get a white flash on every cold start. The script is what makes "no flash" a criterion rather than a hope.

The script duplicates the `takt.theme.v1` key string (it can't import from `src/`). `theme-init.test.ts` (root-level, next to `vite.native-html.test.ts`) reads the file with `readFileSync`, runs it via `new Function` against a stubbed `document`/`localStorage`/`matchMedia`, covers the 3 stored values × 2 media states plus missing/garbage/throwing storage, and asserts the key string equals the constant exported from `context.tsx`. `public/` is outside the coverage `include` globs, so this test exists for correctness, not for the thresholds — said plainly so nobody "fixes" the exclusion.

**Test infrastructure.** jsdom has no `window.matchMedia` (verified), so `src/test-utils/setup.ts` installs a fake — and it must be a _controllable_ one (`src/test-utils/matchMedia.ts`: settable `matches`, working `addEventListener`/`removeEventListener`, a `dispatchChange()` helper), because two acceptance criteria simulate an OS flip while the app is open. It's global state every `SettingsProvider` render passes through, so it's reset in the existing `beforeEach`. Budget ~1 hour, not two lines.

### `theme-color` and `color-scheme` metas (web)

- `index.html` gets `<meta name="color-scheme" content="light dark">` — required for the Android WebView to treat the page as dark-aware (see Native) and correct on every browser.
- The single `theme-color` meta becomes two, with `media="(prefers-color-scheme: light|dark)"`, carrying `#f5f4f0` and the dark `--paper`. This makes the very first paint right with no JS. **From then on, `SettingsProvider` always drives both metas' `content` from `resolvedTheme`** — on every change, including back to System — and never treats the `media` attributes as live again. That gives a correct restore path: Dark → System on a light phone lands on `#f5f4f0`, not on a stale override.
- Incidental fix: the current value `#F3F1EC` doesn't match `--paper` (`#f5f4f0`) or the manifest (`#F5F4F0`); it becomes `#f5f4f0`.

### No server-side change

There is no migration, no schema/query change, no `/api/me/settings` change, no contract doc update. Appearance is device-scoped (see Out of scope). A consequence worth naming: signing in on the web does **not** overwrite a locally chosen appearance, unlike accent and sound — which is the correct behaviour for a per-device preference.

### Native: status bar, window, splash, and the WebView's idea of "dark"

Following Phase 7's existing seams and rules ([android-app.md](../REFERENCE/android-app.md) Part 3 — any plugin install is followed by `pnpm android:check`, because manifest-merge is where `INTERNET` could sneak back). The test device is the OnePlus on **Android 16**; record that in `android-app.md`, because several items below depend on it.

1. **Status bar via `@capacitor/status-bar` (v8), behind a seam.** `src/lib/status-bar.ts` is a web no-op; `src/lib/status-bar-native.ts` wraps the plugin and is aliased in `vite.config.ts` exactly like `wakeLock-platform` / `app-lifecycle`, so the plugin never enters the web bundle. `SettingsProvider` calls `setStatusBar(resolvedTheme)` whenever `resolvedTheme` changes and on foreground resume. The seam calls **both** `setStyle` and `setBackgroundColor(resolvedPaper)`:
   - `setStyle` is the real path on Android 15+/16, where edge-to-edge is enforced by the _device's_ OS version (not `targetSdk`), the bar is transparent over the page, and only icon contrast matters. Note the plugin's naming: `Style.Dark` means _light icons for a dark background_ — the seam maps `'dark' → Style.Dark`, `'light' → Style.Light`, and the unit test pins that inversion so nobody "fixes" it.
   - `setBackgroundColor` is a documented no-op on 15+ and the fix on **Android 13/14**, where the bar keeps its own DayNight-driven background and "explicit Light on a dark phone" would otherwise give dark icons on a dark bar. No 13/14 device is on hand; that case is recorded as untested unless one turns up.
   - No new permission. The seam's web no-op gets its own direct-import test (as `wakeLock-platform.ts` does) so it doesn't drag the coverage floors.

2. **Window and WebView background follow the OS — the native half of "no flash".** `capacitor.config.ts` sets no `backgroundColor` and `AppTheme.NoActionBar` sets `android:background="@null"`, so today the WebView is white between splash dismissal and first paint — a frame `theme-init.js` cannot close. Fix: a `window_background` colour resource (`#f5f4f0` in `res/values/colors.xml`, `#101214` in `res/values-night/colors.xml`), used as `android:windowBackground` in `AppTheme.NoActionBar`, **and** applied to the WebView itself in `MainActivity.onCreate` after `super.onCreate()` — one line, `getBridge().getWebView().setBackgroundColor(getColor(R.color.window_background))` — because a resource lookup is night-aware and the static `capacitor.config.ts` value is not. This is the _only_ Java in the feature.

3. **Splash follows the OS — including the wordmark.** `res/values-night/colors.xml` also overrides `splash_background` (the `values/ic_launcher_background.xml` resource; resource names are global, file names aren't) with the dark paper. `splash.xml` layers `splash_logo.png` over that colour, and `scripts/gen-icons.mjs` draws the logo in `INK #0E1116` — near-black on near-black would be a blank splash. So `gen-icons.mjs` additionally emits `res/drawable-night/splash_logo.png` with paper-coloured ink; Android picks the night drawable automatically. The launcher-icon background is **not** overridden — icons don't change with theme.

4. **The WebView must actually report dark — verify, don't pre-empt.** From the Android docs: on **API 33+** the WebView derives `prefers-color-scheme` from the activity theme's `isLightTheme`, which a `DayNight` parent sets from the system `uiMode`. `AppTheme.NoActionBar` is `Theme.AppCompat.DayNight.NoActionBar` — but the `<application>` theme `AppTheme` is `Light.DarkActionBar` and the launch window is `Theme.SplashScreen`, so this rests on `BridgeActivity` swapping to the DayNight theme before WebView init. **On the verify list, not assumed.** On **API 29–32** the docs describe a legacy `setForceDark` path; the review established that the app targets SDK 36 where that path is superseded, and that `FORCE_DARK_AUTO` enables exactly the algorithmic darkening we want to avoid. So **no force-dark code is written.** Verify 29–32 on device with just the `color-scheme` meta plus the DayNight theme; only if that empirically fails, reach for `WebSettingsCompat.setAlgorithmicDarkeningAllowed` — never `setForceDark`. No 29–32 device is on hand; recorded as untested unless one turns up. Below 29, `system` means light (see Behaviour). `AndroidManifest.xml` already lists `uiMode` in `configChanges`, so an OS theme flip doesn't recreate the activity — the `matchMedia` listener sees a live `change` event, and the foreground re-resolve covers the backgrounded case.

The seam itself needs no ADR — it is the fourth instance of an established pattern (`presets`, `wakeLock-platform`, `useVoiceMachine`, `app-lifecycle`); `android-app.md` gets a sentence pointing at the Capacitor ADR.

### Sequencing: three PRs, one native upload

1. **Tokens + six-group sweep + lint test** (`styles.css`, `styles.test.ts`, `gen-icons.mjs` night logo). Nothing sets the attribute yet, so the live app is visually unchanged except the deliberate `--hover-tint` merge — but **this PR contains the design risk**, not PR 2: the dark palette, the fourteen ink-filled decisions, the derived accents, and the full-screen walk-through all land here. The PR body must say so; "pure refactor" would mis-calibrate reviewer attention.
2. **Setting + resolution** (`SettingsProvider`, `ThemeToggle`, `theme-init.js`, metas, test fake, i18n, docs). Dark mode ships on web here.
3. **Native integration** (`@capacitor/status-bar` seam, `colors.xml` + `values-night`, `windowBackground`, `MainActivity` background line, `android:check`, `versionCode` bump). Device-verified before merge.

**PR 3 ships to the closed track as soon as it's device-verified — one upload carrying all three PRs.** Decided deliberately: the closed test is in flight and needs tester _activity_, not just opted-in installs; two testers asked for exactly this; and a visible response within the test window is how you keep twelve people engaged. The upload doesn't reset the 14-day clock (`android-app.md` Part 1, step 6). The one guard: PR 1's walk-through must have passed first, so testers get one settled palette, not three in a week.

## UI

- **Settings screen:** a new section between **Accent colour** and **Sound effects** — label `t('settings.theme')` = "Appearance" / "Utseende", control `ThemeToggle`: three segments **System / Light / Dark** (`settings.theme.system`, `settings.theme.light`, `settings.theme.dark` = "System" / "Ljust" / "Mörkt"; Swedish "System" is the same word). Selecting one calls `setThemeMode` and fires the existing "Saved" toast via `triggerSaved()`, like every other row.
- **Resolved hint:** when System is selected, a small caption under the control (the `.accent-picker-label` pattern) reads `settings.theme.resolved` = "Currently {mode}" / "Just nu {mode}", interpolating the light/dark label — so a user in the gym can see _why_ it's dark. Hidden when an explicit mode is selected. `{mode}` interpolation follows the existing `{count}`/`{time}` precedent; no new key shape.
- **`ThemeToggle`** reuses the `LanguageToggle` visual (`.lang-toggle` / `.lang-toggle-btn` rules become a grouped selector `.lang-toggle, .theme-toggle { … }` — no rename, no risk to the language tests). The active segment is in the sixth sweep group, so both toggles use `--fill`/`--on-fill` and invert correctly. Semantics are `role="radiogroup"` with three `role="radio"` / `aria-checked` buttons (three exclusive options; `AccentPicker` already uses this shape), rather than the language toggle's `group` + `aria-pressed`.
- Shown on **both** platforms — unlike language (native is English-only) and account (native has none), appearance is meaningful everywhere.
- The **accent swatches** need a visible ring on dark: `.accent-swatch.selected` is in the sixth group — verify it reads as "selected" and not as "glowing".

## Accessibility

- `ThemeToggle` is a proper radiogroup, keyboard-operable, with the current mode announced.
- **Contrast is a no-regression check, not an absolute bar.** `scripts/check-contrast.mjs` computes WCAG ratios for a **hand-listed** set of text-token × surface-token pairs actually used in the app (the list is in the script and drifts if nobody maintains it — which is why this is a PR artefact and must not become a CI gate at this specificity), plus each accent's `--accent-deep` on `--paper` and `--surface`, in both appearances. The criterion: **no dark pair scores worse than its light counterpart, and no light pair changes.** The light palette already fails AA on `--mute` (2.85:1), `--warn`, `--success` and white-on-accent for all six accents; those are seeded, commented exemptions — pre-existing debt, recorded, not fixed here. Budget 2–3 hours for the script. Output pasted into the PR description.
- The script catches _illegible_, not _ugly_. "The six accents still look like themselves on dark" is judged by eye in the PR 1 walk-through.
- `color-scheme` keeps native form controls (the numeric steppers on Configure) and the scrollbar legible.
- Check `styles.css` for `transition` rules on `background`/`color` at a level where an instantaneous OS flip would read as a smear; none are expected, and none are added.
- Nothing here changes focus order, motion, or announcements.

## Analytics

None. No new route, no event. The web beacon is unchanged and the native build has none.

## Files affected

| File                                                                    | Change                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles.css`                                                        | Dark token block; new tokens `--surface`, `--fill`/`--on-fill`, `--on-accent`, `--hover-tint`, `--scrim`, `--backdrop`, `--frame-ring`, `--shadow-pop`, real `--ink-muted`/`--surface-subtle`/`--ink-faint`; six-group sweep; `.theme-toggle`; delete `.tweaks`; `color-scheme`             |
| `src/styles.test.ts`                                                    | New — colour-literal lint with an explicit allow-list                                                                                                                                                                                                                                       |
| `src/lib/settings/accents.ts`                                           | **Unchanged**                                                                                                                                                                                                                                                                               |
| `src/lib/settings/context.tsx`                                          | `themeMode` / `setThemeMode` / `resolvedTheme`; `takt.theme.v1`; `matchMedia` listener + native foreground re-resolve; `applyThemeCss`; `applyAccentCss(accentId, resolvedTheme)` writing authored light / derived dark inline; status-bar + `theme-color` side effects. D1 paths untouched |
| `src/lib/settings/context.test.tsx`                                     | Update — default/system, read/persist, resolve, live OS change, explicit override ignores OS, malformed/throwing storage, light accent byte-identical, dark accent derived, metas restore on Dark → System                                                                                  |
| `src/components/ThemeToggle.tsx` / `.test.tsx`                          | New — radiogroup segmented control + resolved caption                                                                                                                                                                                                                                       |
| `src/routes/Settings.tsx` / `.test.tsx`                                 | Appearance row between accent and sound; toast on change; shown on native                                                                                                                                                                                                                   |
| `src/i18n/strings.ts`                                                   | `settings.theme`, `settings.theme.system`, `.light`, `.dark`, `settings.theme.resolved` (en + sv)                                                                                                                                                                                           |
| `src/lib/status-bar.ts` / `.test.ts`                                    | New — web no-op seam + direct-import test                                                                                                                                                                                                                                                   |
| `src/lib/status-bar-native.ts` / `.test.ts`                             | New — `setStyle` + `setBackgroundColor`; `Style` inversion pinned                                                                                                                                                                                                                           |
| `src/test-utils/matchMedia.ts`, `src/test-utils/setup.ts`               | New controllable `matchMedia` fake; installed and reset in `setup.ts`                                                                                                                                                                                                                       |
| `public/theme-init.js`                                                  | New — pre-paint resolver                                                                                                                                                                                                                                                                    |
| `theme-init.test.ts`                                                    | New — root-level, exercises the file via `readFileSync` + `new Function`; asserts the storage key matches `context.tsx`                                                                                                                                                                     |
| `index.html`                                                            | `<script src="/theme-init.js">` in `<head>`; `color-scheme` meta; two `theme-color` metas; `#F3F1EC` → `#f5f4f0`                                                                                                                                                                            |
| `vite.native-html.test.ts`                                              | Assert the script tag and metas survive the native transform                                                                                                                                                                                                                                |
| `vite.config.ts`                                                        | Native alias `@/lib/status-bar` → `status-bar-native.ts`                                                                                                                                                                                                                                    |
| `package.json`                                                          | `@capacitor/status-bar` ^8                                                                                                                                                                                                                                                                  |
| `scripts/gen-icons.mjs`                                                 | Emit `drawable-night/splash_logo.png` with paper-coloured ink                                                                                                                                                                                                                               |
| `android/app/src/main/res/drawable-night/splash_logo.png`               | New (generated)                                                                                                                                                                                                                                                                             |
| `android/app/src/main/res/values/colors.xml`, `values-night/colors.xml` | `window_background` (light/dark); night override of `splash_background`                                                                                                                                                                                                                     |
| `android/app/src/main/res/values/styles.xml`                            | `android:windowBackground` on `AppTheme.NoActionBar`                                                                                                                                                                                                                                        |
| `android/app/src/main/java/org/hultberg/takt/MainActivity.java`         | One line: WebView background from `R.color.window_background`. **No force-dark code**                                                                                                                                                                                                       |
| `android/app/build.gradle`                                              | `versionCode` bump for the closed-track upload                                                                                                                                                                                                                                              |
| `scripts/check-contrast.mjs`                                            | New — hand-listed token-pair WCAG check, no-regression + exemptions                                                                                                                                                                                                                         |
| `REFERENCE/android-app.md`                                              | Record OnePlus = Android 16; Part 3: status-bar plugin, night resources, `windowBackground`; the WebView-reports-dark note by API level and the verify-first rule                                                                                                                           |
| `REFERENCE/decisions/2026-09-xx-theme-resolution.md`                    | New ADR (see below)                                                                                                                                                                                                                                                                         |
| `CLAUDE.md`, `SPECIFICATIONS/CLAUDE.md`                                 | Post-launch feature pointer while in progress; archive on ship                                                                                                                                                                                                                              |

Not touched, deliberately: `worker/**`, `REFERENCE/auth-and-presets-api.md`, `capacitor.config.ts`, `AccentPicker.tsx` and its test, `REFERENCE/i18n.md`.

## Acceptance criteria

**Tokens and sweep (PR 1)**

- [ ] `src/styles.test.ts` passes: no hex/`rgba()` literal outside the allow-listed blocks.
- [ ] `.tweaks` is gone; `grep -rn tweaks src` returns nothing.
- [ ] `--ink-muted`, `--surface-subtle`, `--ink-faint` are defined in both token blocks; `--accent-ink` and `--accent-contrast` no longer exist — `--on-accent` everywhere.
- [ ] With `data-theme="dark"` set manually in devtools, **every route in `src/routes/` and every surface-bearing component in `src/components/`** — enumerated from the tree at implementation time, and explicitly including Timer, NotFound, Interpretation, SavePresetSheet, StepperSheet, PasskeyPrompt, TopBar, ProgressRing, SetDots, Sparkline, the presets drawer, the voice overlay, the pause dialog and the mic-retry toast — renders with **no white or light-grey surface**. Screenshot set attached to the PR.
- [ ] The fourteen ink-filled rules render as intended mid-surface fills on dark — the primary CTA, the run control, the progress-bar fill, set dots and toasts are not off-white blocks.
- [ ] All six accents still look like themselves on dark, judged by eye, screenshots attached.
- [ ] On desktop, the phone-width viewport is visibly framed against the canvas in dark mode.
- [ ] No `transition` on `background`/`color` turns a theme flip into a visible smear.
- [ ] Light mode is pixel-identical to `main` except the documented `--hover-tint` merge — confirmed by side-by-side screenshots of Home, Run and Settings.
- [ ] `scripts/check-contrast.mjs`: no dark pair worse than its light counterpart, no light pair changed; exemptions listed; output in the PR.

**Behaviour (PR 2)**

- [ ] Settings shows **Appearance** with System / Light / Dark; the current mode is checked; changing it shows the "Saved" toast; the "Currently …" caption appears only under System and is correct.
- [ ] Default with nothing stored is System.
- [ ] System + OS dark → dark; System + OS light → light; flipping the OS setting while the app is open re-renders **without reload**.
- [ ] Light and Dark ignore the OS setting, in both directions.
- [ ] A dark-mode user (both explicit Dark and System-on-a-dark-OS) sees **no light frame** on cold start, hard reload, or PWA launch — checked with a throttled-CPU screen recording, with the `theme-init.js` request time quoted.
- [ ] `takt.theme.v1` round-trips; garbage or a throwing `localStorage` falls back to System without an error in the console.
- [ ] Signing in on the web does not change a locally chosen appearance.
- [ ] `theme-color` metas track the resolved appearance in Safari iOS and Chrome Android — including Dark → System on a light phone restoring `#f5f4f0`.
- [ ] `applyAccentCss` light output is byte-identical to today for all six accents; dark output uses `color-mix` toward white.
- [ ] All new strings exist in English and Swedish.
- [ ] `worker/**` has no diff; `worker/lib/securityHeaders.test.ts` is unchanged and green — the CSP was not touched.

**Native (PR 3) — the OnePlus, Android 16, real device**

- [ ] System follows the OS toggle live, without restart; also correct after backgrounding Takt, flipping the OS theme, and returning.
- [ ] Explicit Dark on a light OS: light status-bar icons over the dark app. Explicit Light on a dark OS: dark icons over the light app.
- [ ] No white frame between splash dismissal and first paint with the OS in dark mode — screen recording attached.
- [ ] Splash is dark with a **legible wordmark** when the OS is dark; light when light. The documented light-splash-then-dark case for "Dark on a light OS" is observed and accepted, not hidden.
- [ ] No algorithmic-darkening artefacts (double-inverted images, wrong greys) — `MainActivity` contains no force-dark code.
- [ ] Android 13/14 status-bar background and API 29–32 `prefers-color-scheme` are **recorded as untested** in the PR unless a matching device is available; if one is, both are verified.
- [ ] `pnpm android:check` passes after `@capacitor/status-bar` is synced — still no `INTERNET`, recogniser `<queries>` intact.
- [ ] Hardware back button, keep-awake, voice, and presets are unaffected (smoke run of each on device).
- [ ] `versionCode` bumped; signed AAB uploaded to the closed track; `android-app.md` records the OnePlus OS version.

## Risks

- **The palette is wrong on first try.** Certain — and the sixth sweep group is where it costs hours. That's why PR 1 carries the walk-through and the by-eye criteria, and why it's framed as the risky PR.
- **A leak survives the sweep.** The lint test makes the sweep provable; the tree-derived walk-through catches the rest.
- **The WebView on API 29–32 reports light.** Verify-first policy; `setAlgorithmicDarkeningAllowed` is the only tool to reach for if it fails; `system` degrades to light on those devices otherwise. Not a blocker.
- **Android 13/14 status bar.** Covered by `setBackgroundColor`; untestable on hand; recorded.
- **Service-worker skew.** A client on the old SW lacks `theme-init.js` until the SW updates — at worst one light flash for one load. There is no server contract to skew any more.
- **Play closed test in flight.** Shipping PR 3 into the test is a deliberate engagement decision, guarded by "PR 1's walk-through passed first". The upload doesn't reset the clock.

## Decision to record

One ADR, written alongside PR 2: **appearance is resolved in JS to a single `data-theme` attribute** — attribute-only CSS, an external pre-paint script, no CSP change, device-scoped with no server sync. It must record the rejected alternatives a future reader will ask about: a `@media` block for System (token duplication), `light-dark()` / CSS nesting (WebView support), an inline script with a CSP hash (two-constant drift), a D1 column (device-scoped preference; clobber risk under SW skew). The native status-bar seam is precedent, not a decision, and gets a sentence in `android-app.md` instead.
