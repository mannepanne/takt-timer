# Phase 7h: Signing, store listing, and Play Store publishing

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first. This deliverable is mostly **not code** — it's the release pipeline and the Play Console admin. **Its calendar-time items must start on day one, in parallel with all the code deliverables**, because Google's closed-testing gate can't be compressed.

**Depends on:** all code deliverables for a _shippable_ AAB; but the **admin track (below) starts immediately, before any code is written.**
**Gates:** production launch.
**Shippable?** This _is_ the ship.

---

## Two tracks, different clocks

**Code track** (waits for 07a–07g): build a signed AAB, back up the keystore, write the `REFERENCE/` release doc.

**Admin track** (starts day one, runs on calendar time regardless of code progress): developer account, merchant profile, tester recruitment, closed testing, store listing, Data Safety form. The 14-day closed-testing clock is the earliest-launch-date driver — no amount of coding speed compensates for it.

---

## What Magnus must do himself (I can't — these need his identity, bank, Google account, and real people)

Flagged early because of lead time. I can guide, draft, and prepare, but these are his:

- [ ] **Google Play Developer account** — $25 one-time, one Google account, plus **identity verification** (legal name, address, phone). New personal accounts must clear this before publishing. _Start day one._
- [ ] **Merchant / payments profile** — required because it's a paid app. Needs bank details and tax info. _Start day one; has its own review lead time._
- [ ] **Recruit ≥12 testers** with Google accounts, willing to opt into the closed test and stay opted in for ≥14 continuous days. _Start recruiting day one — this is the critical-path gate._
- [ ] **Hold and back up the signing keystore secret** — I can generate it and script the build, but the secret is his to store securely (password manager / offline backup), never in the repo. Losing it after first release means the app can't be updated under the same listing.

## What I can do

- [ ] Generate the keystore + document the signed-AAB build process in `REFERENCE/android-app.md` (secure backup instructions; nothing secret committed).
- [ ] Draft store-listing copy (the honest pitch: _your presets and history never leave your device, no account ever, works offline_ — voice input uses the phone's built-in speech recognition, which may involve Google).
- [ ] Prepare screenshots and the privacy-policy page content (consistent with `Privacy.tsx` native copy from 07g).
- [ ] Draft the **Play Data Safety form** answers — no account/personal data collected; voice audio may be processed by Google's speech-recognition service (**pending a policy check** on whether a user-invoked system recogniser counts as app-collected data or an OS service — declare conservatively if unclear; this is a legal attestation, not copy).

## Scope — code/release artifacts

- [ ] Manual signed AAB build process, documented in `REFERENCE/android-app.md`.
- [ ] `android:allowBackup` decision made explicitly so the "reinstall wipes data" criterion is _true_, not assumed — covers presets, history, **and `takt.stopwatch.v1`**, all `localStorage` under one umbrella. (Auto Backup would otherwise preserve data across reinstall with no app-initiated network call.)
- [ ] Root `CLAUDE.md` updated to mention the Android app once live; `REFERENCE/android-app.md` documenting build/release + the local voice parser's supported grammar.

## Acceptance criteria

- [ ] A signed release AAB installs via the internal testing track and runs a full interval + stopwatch session in airplane mode.
- [ ] Uninstall/reinstall returns to zero presets/history and clears `takt.stopwatch.v1` — verified, with `android:allowBackup` set accordingly.
- [ ] The app passes Play Console review and the closed-testing requirement, and is purchasable at £0.99.
- [ ] The Data Safety declaration is accurate re: voice audio egress, and consistent with `Privacy.tsx` native copy.
- [ ] Keystore backed up securely outside the repo; no signing credentials anywhere in the repo.

## Risks specific to this deliverable

- **Closed-testing gate (12 testers / 14 days)** is calendar time — plan around it, not through it. Start recruiting day one.
- **Losing the upload keystore** makes updates impossible under the same listing — back up securely, off-repo.
- **£0.99 is effectively locked** — Play allows paid→free but restricts free→paid. Don't launch free intending to charge later; treat £0.99 as a floor you can drop but not re-raise.
- **A bare wrapped-website look** can draw store scrutiny even though Android has no Apple-4.2 equivalent — the icon/splash (07b) and no-visible-browser-chrome matter here.
- **Reinstall data-loss reads as a bug** to PWA users who bought expecting their presets to carry over (WebView origin ≠ Chrome origin) — worth a store-listing / first-run line.
- **Ongoing compliance** — target-API-level bumps, Data Safety re-attestation, Gradle/AGP upgrades arrive on Google's schedule regardless of active development. Budget recurring maintenance; this is not ship-and-forget.

## PR workflow

Branch `feature/phase-7h-publishing`. Mostly docs + release config — `/review-pr`, likely light/standard. The store/Console steps are manual, one-time, and can't be automated-tested; verify by hand.
