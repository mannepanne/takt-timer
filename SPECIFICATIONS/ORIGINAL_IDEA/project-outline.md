# Takt — project outline

Source of truth for what Takt is, why it exists, and the decisions that shape every phase. This document captures the *what* and *why*. The *how* lives in numbered phase specs and ADRs under `REFERENCE/decisions/`.

**Tagline:** *Takt — keep it going.*

**Domain:** `takt.hultberg.org`

**Status:** Planning. No implementation yet. Prototype exists in `SPECIFICATIONS/prototype-design-files/` (mocked voice, fake data).

---

## Origin and problem

Magnus does rehab training and wants a dead-simple interval timer: a number of sets, a work duration, a rest duration in between. Every existing app piles on features he doesn't want. The second insight: interval timing is a *perfect* voice use case — easy to say, easy to parse, easy to demo to anyone. "Three sets of one minute, thirty seconds rest between each" is faster than tapping through three menus.

Built for Magnus first. Released to the world because the problem isn't unique to him.

## Product principles

- **Simple beats clever.** One feature, done beautifully.
- **Voice-first, touch-always.** Every voice action has a tap equivalent. No one is ever stuck.
- **Stockholm on Cloudflare.** Design that looks considered, not busy. Infrastructure that's quiet and cheap.
- **Privacy by architecture, not by policy.** We don't store what we never collect. The auth model is the privacy story.
- **Mobile-first, mobile-only (viewport).** Desktop browser renders the phone layout centred in a frame. We design one viewport.

## Scope

### In scope for v1 (match the prototype + the additions below)

Every screen and interaction shown in `SPECIFICATIONS/prototype-design-files/` is in scope:

- Home screen: mic button, "What cadence do you need?" prompt, streak sparkline, last-session quick-start.
- Voice overlay: listening / thinking states, transcript display, cancel.
- Interpretation screen: parsed intent with editable stepper chips for sets / work / rest, stepper sheet for big-target editing.
- Running screen: count-in, work/rest phases with different backgrounds, big mono numerals, set dots, progress bar, pause/resume, skip phase, repeat set, audible cue beeps, countdown pip for final three seconds, haptics.
- Complete screen: totals, "run it again", "save as preset".
- Presets drawer: pin, reorder (long-press drag), duplicate, delete, create, edit, run.
- Settings screen: accent colour theming, sound on/off, language toggle (see below).
- Onboarding: first-run introduction.
- Save preset sheet: name a session and keep it.

**Additions not in the prototype:**

- **Account creation and sign-in via passkeys** (prototype has no auth).
- **Local-first session history for anonymous visitors.** Every completed session is saved to `localStorage` (capped at ~30 entries). The streak sparkline on Home renders from this, so a first-time visitor sees their session count light up immediately — no dead empty state. On account creation, the user is offered a one-shot import: *"Bring your N sessions with you?"*. Accepting writes them into D1; either choice clears local after registration so the device holds no orphan history.
- **Language toggle in Settings: English and Swedish**, with full UI translation and a language hint passed to Whisper.
- **Admin backend** for Magnus: view anonymised usage stats, delete profiles.
- **Privacy policy page.** A dedicated page explaining the promise in plain language: no email, no phone, no personal details; what we do store (a random user handle, a public key, pseudonymous session history, ephemeral rate-limit counters); who sees what (Cloudflare's edge sees IPs, we don't persist them beyond the rate-limit window); and the consequences of losing a passkey. Linked from Settings and Onboarding. Available in English and Swedish.
- **Offline-capable running**: a configured session runs fully without network. Voice does not.
- **Cloudflare Web Analytics** for basic traffic visibility.

### Voice scope

Voice is for two actions only:

1. **Configure a session** — "Three sets of one minute each, thirty seconds rest in between."
2. **Save the current session as a preset** — "Save this as basic rehab pattern."

Running a saved preset by voice, voice control during a running session, and any other voice command are **out of scope** for v1.

### Explicitly out of scope

- Native iOS or Android app. No App Store submission.
- Locked-screen or background-tab audio. Sessions only run with the tab visible and screen on.
- SMS or email-based auth. No OTP. No magic links.
- Account recovery codes. If the passkey is lost and not synced, the account is gone. Presets with it.
- Voice during a running session ("pause", "skip", "run preset X").
- Desktop-optimised layout. The desktop experience is the phone layout, centred.
- Any social, sharing, or multi-user features.

## Users

- **Anonymous visitor.** Lands on the site, can run a session configured by voice or manual entry. Completed sessions accumulate in `localStorage` so the streak sparkline works from the first session onwards. Cannot save presets. Subject to anonymous rate limits.
- **Registered user.** Created a passkey on their device. Can save presets, history is persisted in D1 (and syncs across their devices via passkey sync), settings persist across their devices.
- **Admin (Magnus only).** Authenticates via Cloudflare Access with his Google account. Has access to an admin route with usage stats and profile deletion. Admin status is stored as a flag on his user row in D1 so the running-app rate-limit exemption works without a second auth path.

## Architecture overview

### Stack

- **Hosting:** Cloudflare. One Worker serving both static assets (the Vite-built SPA) and the API routes.
- **Frontend:** Vite + React + TypeScript + PWA (service worker + manifest). Installable to home screen. Rationale: [ADR 2026-04-19 — Vite SPA over Next.js](../../REFERENCE/decisions/2026-04-19-vite-spa-over-nextjs.md).
- **Styling:** Port the prototype's `styles.css` directly. Rationale: [ADR 2026-04-19 — Port prototype CSS](../../REFERENCE/decisions/2026-04-19-port-prototype-css.md).
- **Database:** Cloudflare D1 for user records, presets, session history, rate-limit counters.
- **Session tokens / ephemeral state:** Cloudflare KV or signed cookies. Decision deferred to phase spec.
- **AI inference:** Cloudflare Workers AI. `@cf/openai/whisper-large-v3-turbo` for transcription. A Workers AI Llama model for intent parsing. Both on-platform, no external keys.
- **Analytics:** Cloudflare Web Analytics (cookieless, privacy-preserving).
- **Email:** Cloudflare Email Sending (Beta) — *only* if a concrete need appears (e.g., admin alerts to Magnus). The user-facing app has no email flow.
- **Admin gate:** Cloudflare Access (Zero Trust) with the existing Google IdP policy, protecting the admin route at the edge.

### Voice pipeline

Two-step, both on Workers AI:

1. **Transcription:** browser captures audio → Worker → Whisper-turbo → text. Language hint passed from the user's UI language setting (not auto-detected — faster and more accurate).
2. **Interpretation:** text → Llama model on Workers AI → structured JSON `{ sets, workSec, restSec, name? }` → Interpretation screen for user confirmation.

Hybrid with the browser's native `SpeechRecognition` API is explicitly deferred. It would save inference cost but splits the code path and makes Swedish less reliable. Revisit if usage grows and cost becomes real.

### Auth model — two distinct layers

- **User auth: passkeys (WebAuthn).** Library: `@simplewebauthn/server` in the Worker, `@simplewebauthn/browser` in the SPA. D1 stores one row per user: a random `userHandle`, the stored public key, a signature counter, and `createdAt`. No email, no phone, no name. Cross-device sign-in relies on the platform passkey sync (iCloud Keychain, Google Password Manager). Session established via a signed HTTP-only cookie.
- **Admin auth: Cloudflare Access.** A separate subdomain or path (e.g., `takt.hultberg.org/admin`) is gated by Access with Magnus's Google identity. No application code involved in the admin gate — Cloudflare handles it.
- **Admin identity inside the running app.** Magnus-as-user has a passkey like anyone else. His D1 row has `isAdmin: true`. This is what the rate limiter checks for exemption — one identity, one code path.

### Data model (initial sketch)

- `users`: `userHandle` (random, primary), `publicKey`, `counter`, `createdAt`, `isAdmin`, `language`, `accentColour`, `soundOn`.
- `presets`: `id`, `userHandle`, `name`, `sets`, `workSec`, `restSec`, `pinned`, `orderIndex`, `createdAt`.
- `sessions` (history): `id`, `userHandle`, `completedAt`, `totalSec`, `sets`, `workSec`, `restSec`.
- `rateLimits`: ephemeral counters keyed by IP (anon) or `userHandle` (authed). KV is probably a better fit than D1 for this — decided in the phase spec.

No PII anywhere. Session history is pseudonymous usage data tied only to a random handle.

### Data retention

All data is tied to a pseudonymous `userHandle`. To avoid unbounded growth, inactive users (no session recorded for 12 months) are purged automatically, including their presets and history. Policy stated here; implementation deferred to a later phase.

## Privacy posture

The marketing claim: **"No email. No phone. No personal details."** 

For this to be literally true:

- No field in the schema stores anything a user typed about themselves except preset names (which they control).
- Passkeys store a public key and a counter — not a fingerprint of the person.
- Session history is pseudonymous cadence data, never linked to an identity outside our database.
- Analytics is Cloudflare Web Analytics: cookieless, no user tracking.

The one honest caveat: Cloudflare's edge sees IP addresses. The product does not store them beyond ephemeral rate-limit counters.

## Rate limiting

Starting point from Magnus: **3 voice commands per IP per day, with an admin exemption.**

Considerations to resolve in the phase spec:

- IPs are fragile boundaries (NAT on mobile carriers and offices means many users share one IP). A small café can hit the cap with one person testing.
- Better axes: 3/day for anonymous visitors, a higher cap (e.g. 20–50) for authenticated users, unlimited for admin.
- All tunable by config. Don't over-engineer the first pass.

Keep Magnus's 3/day as the default for anon and decide the authenticated-user tier when we write the auth phase.

## Internationalisation

- **Languages:** English and Swedish.
- **First load:** auto-detect from `navigator.language` to pick an initial UI language.
- **Explicit control:** Settings toggle overrides detection. Stored on the user row in D1 when authenticated, `localStorage` otherwise.
- **Voice:** the selected UI language is passed to Whisper as a language hint.
- **Translation approach:** a small in-app strings file per language. No i18n library needed for this scope — flat key-value suffices.

## Offline behaviour and audio

- The SPA shell, CSS, icons, and a list of the user's presets are cached by a service worker.
- A **configured** session runs fully offline: the timer, beeps, haptics, screen transitions, and "save as preset" (queued to sync when online) all work without network.
- **Voice does not work offline** — Whisper is remote. The mic button disables (or shows a friendly "voice needs network" state) when offline.
- **Audio behaviour:** targeted at "phone face-up, screen on, Takt tab visible." The Screen Wake Lock API is used to prevent auto-lock during a running session. If the user backgrounds the tab or locks the phone, audio cues will stop. This is a browser platform limit, not a bug. Communicated in Onboarding and Settings.

## Admin backend

- Route: `takt.hultberg.org/admin` (or a subdomain — decided in the phase spec).
- Gated by Cloudflare Access with Magnus's Google identity.
- Minimal v1 surface:
  - Usage stats: active users over time, session counts, voice-command counts, rate-limit hits.
  - Profile listing (by `userHandle`, no other identifier — there isn't one).
  - Delete a profile (GDPR right to erasure, even though we hold no PII).
- Not a React app in its own right if a server-rendered simple page suffices. Decided in the phase spec.

## Design

- The prototype is the reference. Port its CSS variables, typography (Figtree + JetBrains Mono), accent options, motion, and component shapes.
- The `ios-frame.jsx` is a dev convenience for the desktop preview — we adopt the same centred-phone framing for desktop viewports in production.
- Accent colours: the six options in the prototype (`Icy Blue`, `Arctic`, `Lichen`, `Ember`, `Lilac`, `Graphite`) remain. Default: `Lichen`.

## Accepted risks

- **Passkey loss = account loss.** If the user's device is lost and their passkey was not synced to iCloud Keychain or Google Password Manager, we cannot recover their account or presets. Communicated in the UI at sign-up. This is a deliberate choice to uphold the privacy promise.
- **Audio stops when the tab is backgrounded.** Can't be worked around in a browser. Communicated in Onboarding.
- **Whisper + Llama latency** is acceptable for a one-shot configure-a-session command, not for conversational use. We are not building conversational.
- **Workers AI cost** is bounded by the rate limit. If the app unexpectedly scales, the cap protects the bill until we can react.

## Open questions and deferred decisions

Items deliberately not decided here, to be resolved in the relevant phase spec or ADR:

- Authenticated-user rate-limit tier (anon is 3/day).
- Session storage: signed cookie vs Cloudflare KV token.
- Admin UI: server-rendered page vs small SPA.
- Retention purge mechanism (Cron Trigger vs on-access check).
- Whether the 12-month retention clock resets on sign-in alone, or only on completed sessions.

## Reference

- Prototype: `SPECIFICATIONS/prototype-design-files/`
- Original design prompt used in Claude Design: preserved in `SPECIFICATIONS/ORIGINAL_IDEA/` notes (see this outline's origin section).
- Technology defaults (partially overridden for this project): `.claude/COLLABORATION/technology-preferences.md`
