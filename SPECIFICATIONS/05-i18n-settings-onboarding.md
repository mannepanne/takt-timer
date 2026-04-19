# Phase 5: Internationalisation, Settings, Onboarding

## Phase overview

**Phase number:** 5
**Phase name:** i18n + Settings + Onboarding — shippable polish
**Estimated timeframe:** 4–6 days
**Dependencies:** Phase 4 (Accounts and presets) complete.

**Brief description:**
Ship the full non-admin user experience. Translate every UI string into Swedish, add a language toggle in a complete Settings screen, ship a considered Onboarding flow, and write real Privacy policy content in both languages. After this phase, the app is ready for external users.

---

## Scope and deliverables

### In scope

- [ ] Strings extracted from every component into a flat key-value file per language: `/src/i18n/en.ts`, `/src/i18n/sv.ts`. Small `t(key)` helper — no i18n library needed.
- [ ] Language detection on first load from `navigator.language` (maps `sv-*` → Swedish, everything else → English).
- [ ] Language toggle in Settings. For authenticated users, persisted on the user row in D1. For anonymous users, persisted in `localStorage`.
- [ ] Whisper language hint (`/api/voice/parse`) reads the active UI language per request.
- [ ] Full Settings screen (ported from `presets-settings.jsx`) containing:
  - Language toggle (English / Swedish).
  - Accent colour picker (the six options from the prototype, defaulting to Lichen).
  - Sound on/off (moved from wherever phase 2 stashed it).
  - Sign-in state: shows "Signed in" with an option to sign out and delete account, or "Sign in / create account" for anon.
  - Link to Privacy policy.
  - Small version / build indicator for debugging.
- [ ] Onboarding screen, shown on first visit (flagged by a localStorage key), with 3–4 friendly slides:
  - What Takt is.
  - How voice works ("phone face-up, screen on, tap the mic, speak naturally").
  - The passkey trade-off ("No email, no phone — but if you lose your passkey, your account goes with it").
  - A tap-through to the Home screen.
- [ ] Privacy policy content in both languages. Covers:
  - The claim: no email, no phone, no personal details.
  - What we store (pseudonymous user handle, public key, preset names, session summaries, ephemeral rate-limit counters).
  - What Cloudflare sees at the edge (IP addresses, not persisted by us beyond the rate-limit window).
  - How to delete your account.
  - Contact (a generic privacy@takt.hultberg.org alias or similar — to be decided).
- [ ] Accent colour applied live via CSS custom property overrides (`--accent`, `--accent-deep`, `--accent-soft`), persisted per user / per anon device.
- [ ] Empty states reviewed and translated: Home with no history, Presets drawer empty, voice failure states, rate-limit state.
- [ ] Smoke tests in both locales: main flows work in English and Swedish.

### Out of scope

- Admin backend (phase 6).
- Retention purge cron (phase 6).
- Additional languages beyond English and Swedish.

### Acceptance criteria

- [ ] A Swedish-speaking visitor opens the app on a Swedish phone; UI is Swedish; they say *"Tre set om en minut, trettio sekunders vila mellan varje"* and land on a correctly parsed Interpretation screen.
- [ ] Switching language in Settings flips every visible string and updates the Whisper hint on the next voice call.
- [ ] First-time visitor sees Onboarding once and never again on that device.
- [ ] Privacy policy page renders both languages and is linked from Settings, Onboarding, and the Home footer.
- [ ] Accent colour change persists across reloads and across sign-in on a second device (for authenticated users).
- [ ] Lighthouse Accessibility ≥95 on both Home and Settings in both languages.
- [ ] Tests pass with coverage targets met.

---

## Technical approach

### Architecture decisions

**No i18n library**
- Choice: flat object per language, a tiny `t(key, params?)` helper. Language stored in React context.
- Rationale: two languages, a few hundred strings. A library would be overkill, add bundle weight, and constrain how we render. Revisit if we add a third language.

**Settings backed by D1 for authenticated users, localStorage for anon**
- Choice: `users` table gains `language`, `accent_colour`, `sound_on` columns. A small `/api/me/settings` endpoint reads/writes them. Anon mirrors the same keys in localStorage.
- Rationale: single shape, one code path in the client, trivial migration from anon to authenticated (pushed at registration import).

**Accent theming via CSS custom properties**
- Choice: swap `--accent`, `--accent-deep`, `--accent-soft` at runtime on `:root`. All prototype styles already reference these.
- Rationale: zero-cost theming, no re-render.

### Technology choices

No new runtime dependencies. If we want visual diffs between locales in CI, `playwright` can be added, but that's optional and deferred.

### Key files and components

```
src/
├── i18n/
│   ├── en.ts
│   ├── sv.ts
│   ├── context.tsx             # provider + t() helper
│   ├── detect.ts
│   └── index.test.ts
├── routes/
│   ├── Settings.tsx
│   ├── Onboarding.tsx
│   └── Privacy.tsx             # real content now
├── components/
│   ├── LanguageToggle.tsx
│   ├── AccentPicker.tsx
│   └── OnboardingSlides.tsx
worker/
└── api/
    └── me/
        ├── settings.ts
        └── settings.test.ts
```

### Database schema changes

```sql
ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN accent_colour TEXT NOT NULL DEFAULT 'lichen';
ALTER TABLE users ADD COLUMN sound_on INTEGER NOT NULL DEFAULT 1;
```

---

## Testing strategy

### Unit tests

- `i18n/detect.test.ts` — correctly maps locale strings; sv-SE → Swedish, en-* and everything else → English.
- `i18n/context.test.tsx` — provider switches language, `t()` falls back to English for missing keys (and logs a warning in dev).
- `AccentPicker.test.tsx` — clicking a swatch updates CSS variables.
- `worker/api/me/settings.test.ts` — GET/PUT happy paths, authorisation.

### Integration tests

- [ ] Change language to Swedish, reload, language persists.
- [ ] Change accent, reload, accent persists.
- [ ] Voice call uses the correct language hint.

### Manual testing checklist

- [ ] Full app run in English: every visible string is intentional, no mojibake.
- [ ] Full app run in Swedish: same.
- [ ] Privacy policy renders correctly in both languages.
- [ ] Onboarding shown once on first visit.
- [ ] Accent colours look correct against both `--paper` and `--paper-2` backgrounds.

---

## Pre-commit checklist

- [ ] All tests passing.
- [ ] Type checking passes.
- [ ] Coverage meets targets.
- [ ] Translation pass reviewed by Magnus (native speaker); nothing machine-translated without a human check.
- [ ] Privacy policy reviewed for accuracy against the actual code behaviour (what we store, where).

---

## PR workflow

**Branch:** `feature/phase-5-i18n-settings-onboarding`
**PR title:** `Phase 5: i18n, Settings, Onboarding`

Use `/review-pr` — this phase is mostly UX polish. Use `/review-pr-team` only if the privacy policy copy or the data model for settings turns out to need scrutiny.

---

## Edge cases and considerations

### Known risks

- **Translation drift.** Easy to add an English string and forget Swedish. Mitigation: the `t()` helper logs a warning in dev for missing keys; a simple CI check (script) compares key sets between `en.ts` and `sv.ts` and fails on mismatch.
- **Swedish voice parsing quality.** Llama models vary across languages. Mitigation: expand the Llama prompt bake-off (from phase 3) to cover Swedish phrases; document the accepted accuracy.

### Performance considerations

- Both language bundles are small enough to ship together; no need for code-splitting per locale.

### Security considerations

- Privacy policy must match reality. Every claim in the page has a corresponding code path; any divergence is a bug.

### Accessibility considerations

- Language toggle uses proper `<label>` semantics and announces state change.
- Privacy policy uses semantic headings (`h1`, `h2`, …), not visual styling only.
- Onboarding slides keyboard-navigable (←/→ arrows, Escape to skip).

---

## Technical debt introduced

- **TD-006: Missing-key warning is log-only, not a build-time check.** Acceptable for two languages; revisit if a third lands. Risk: Low.

---

## Related documentation

- [Project outline](./ORIGINAL_IDEA/project-outline.md)
- [Phase 4](./04-accounts-and-presets.md)
- [Phase 6 — admin & launch](./06-admin-and-launch.md)
- [Prototype: presets-settings.jsx](./prototype-design-files/presets-settings.jsx)
