# Android app — getting started, dev environment, and publishing

> **Living document.** Right now it covers the two things that unblock Phase 7: the **Play Console admin track** (start today — it's the critical path) and the **local Android dev environment** (unblocks the `07a` spikes). Build/release detail (signed AAB steps, keystore backup, the local voice parser's supported grammar) gets added here as the implementation deliverables land — see [SPECIFICATIONS/07-android-app.md](../SPECIFICATIONS/07-android-app.md) and its children `07a`–`07h`.
>
> **A note on exact steps:** Google changes the Play Console UI and its wording often. This guide gives the accurate _shape_ and the _order_ of what's required; where it says "follow the on-screen prompts", trust the live console over any exact menu path written here, because the live console is current and this file may not be.

---

## Part 1 — Play Console admin track (start today)

This is the **critical path**. Google requires new personal developer accounts to run a **closed test with ≥12 testers opted in for ≥14 continuous days** before you can apply for production release. That's 14 days of calendar time no amount of coding can compress — so the sooner the account and testers are in motion, the sooner Takt can launch. Everything here is **yours to do** (it needs your identity, your bank, your Google account, and real people); I can't do it for you, but I'll prep every artefact you need.

> **Owner Google account (locked): `magnus.hultberg@happyherring.com`.** Takt's Play Console developer account is registered under this account, **not** `magnus.hultberg@gmail.com` — the Gmail account had an old developer account that Google **closed for inactivity**, which blocks a fresh registration on that address. An inactivity closure is administrative, not a policy ban, so registering fresh on a clean Google account is legitimate. Treat this owner account as a locked-in decision on par with the application ID: the developer account, the paid-app payments profile, and the published listing all live here, and moving them later is painful. **Keep it active** so this doesn't recur — publishing and maintaining Takt satisfies Google's activity rule automatically (publish within a year, verify contact email + phone, don't go 180 days unused).

### Ordered checklist — do these in sequence

1. **Create a Google Play Developer account.** Go to the Play Console at **[play.google.com/console](https://play.google.com/console/)** and sign in with **`magnus.hultberg@happyherring.com`** (the locked owner account above) — new accounts are guided straight into registration. (Overview / "get started" info lives at [play.google.com/console/about](https://play.google.com/console/about/); the Android Developers landing page [developer.android.com/distribute/console](https://developer.android.com/distribute/console) points to the same place.)
   - One-time **$25 USD** registration fee (the earlier fee on the closed Gmail account is forfeit — this is a fresh $25).
   - Choose account type **Personal** (you're an individual, not an organisation).
   - You'll complete **identity verification**: legal name, address, phone, and possibly a government photo ID. This can take anywhere from minutes to a few days on Google's side — starting it is the gate for everything else.

2. **Set up the payments / merchant profile** — required because Takt is a **paid** app (£0.99), not free.
   - In Play Console this is the "Payments profile" / Google payments centre. Needs your **bank account details** and **tax information**.
   - Has its own review lead time — kick it off right after the developer account, don't wait until the app is built.

3. **Recruit ≥12 testers** — the part with the longest human lead time.
   - Each needs a **Google account** and must **opt in** to the closed test (via an opt-in link you'll share) and **stay opted in for ≥14 continuous days**.
   - Start assembling the list now — friends, family, gym contacts, anyone with an Android phone or even just a Google account. Line up a couple of spares; people drop off.

4. **Create the app entry in Play Console** (can happen once the account exists, before the build is final):
   - App name **Takt**, default language, "app" (not game), **paid**.
   - You'll later fill: store listing (copy + screenshots — in `store-assets/`), **privacy policy URL**, **Data Safety** form, content rating questionnaire, target audience.
   - **Privacy policy URL (07h):** submit **`https://takt.hultberg.org/privacy/android`** — the Android-specific policy. The web app keeps its own at `/privacy/web`, and `/privacy` still auto-resolves by platform for the in-app link. All three render the same `Privacy.tsx`; the `/privacy/{web,android}` routes force the variant so each has a stable public URL a browser (or a Play reviewer) sees correctly. **Do not** submit `/privacy` or `/privacy/web` to Play — they describe the web app (accounts, Cloudflare, analytics) and would contradict the Android Data Safety form.
   - The **Data Safety** form is a legal attestation. **Resolved stance (07h): declare _no data collected or shared_.** Rationale: Takt's own process transmits nothing off-device (no account, no server, no analytics, `INTERNET` removed); the voice audio is captured and sent by Android's **system speech recogniser** — a separate Google/OS process the user invokes — which is outside the app's Data Safety scope. Answer the deletion question as **on-device** (uninstall / Settings → Apps → Takt → Storage → Clear); there is no account, so no account-deletion URL. Everything else (location, contacts, financial, health, messages, photos, app activity, device IDs, ads/tracking) is **None**. This matches the native `Privacy.tsx` copy, which still transparently discloses the OS voice path — keep the two consistent, privacy page authoritative.

5. **Set the price to £0.99.** Note: Play allows **paid→free** later but restricts **free→paid**. So £0.99 is a floor you can drop but not re-raise — don't launch free intending to charge later.

6. **Run the closed test** — upload a signed build to the closed-testing track, get your ≥12 testers opted in, and let the **14-day clock** run. Only after that can you apply for production access.

### What I'll prepare for you (just ask when you reach each)

- Store-listing copy — the honest pitch: _your presets and history never leave your device, no account ever, works offline_; voice uses the phone's built-in speech recognition (which may involve Google).
- Screenshots and the privacy-policy page content (kept consistent with the native `Privacy.tsx` copy from `07g`).
- The **Data Safety** form answers.
- The signing keystore + the signed-AAB build steps (`07h`). **You hold and back up the keystore secret** — password manager / offline backup, never in the repo. Losing it after first release means you can't update the app under the same listing.

### Tester recruitment (start now — this is the 14-day bottleneck)

Closed testing needs **≥12 testers opted in for 14 continuous days** before you can apply for production. Aim for **~14–15** to absorb drop-off. You can't send the real join link until a build is on the closed-testing track, but line people up now and collect their Gmail addresses so the list is ready to paste in the moment the track exists.

**The ask (copy-paste to friends / family / gym contacts with an Android phone):**

> **Subject: Fancy helping me test a little app? (~2 min of effort)**
>
> Hi! I've built a small Android app — **Takt**, a dead-simple voice-driven interval timer I made for my rehab training — and I'm about to put it on the Google Play Store. Google makes new developers run a 2-week closed test first, and I need **at least 12 people** to opt in.
>
> What I'd need from you:
>
> - An **Android phone** and a **Google account** (the email you use on the phone).
> - Reply with that **Gmail address** so I can add you to the test list.
> - When I send a **join link** (in a week or so), tap it, install Takt, and just have it on your phone for a couple of weeks. A quick try is welcome but not essential.
>
> That's it — no cost, no spam, and you can remove it after. Reply "in" and send me your Gmail if you're up for it. 🙏

**Tester tracking list** (fill in as replies land; testers must stay opted in for 14 continuous days):

| #   | Name | Gmail address | Confirmed "in"? | Opted in to test? |
| --- | ---- | ------------- | --------------- | ----------------- |
| 1   |      |               |                 |                   |
| 2   |      |               |                 |                   |
| 3   |      |               |                 |                   |
| 4   |      |               |                 |                   |
| 5   |      |               |                 |                   |
| 6   |      |               |                 |                   |
| 7   |      |               |                 |                   |
| 8   |      |               |                 |                   |
| 9   |      |               |                 |                   |
| 10  |      |               |                 |                   |
| 11  |      |               |                 |                   |
| 12  |      |               |                 |                   |
| 13  |      |               |                 |                   |
| 14  |      |               |                 |                   |
| 15  |      |               |                 |                   |

---

## Part 2 — Local Android dev environment (macOS)

This unblocks the code track — the full macOS setup, in order. Node/pnpm are already fine.

The `07a` spikes need a **real Android phone** (the specs require real-hardware validation, not an emulator), so the phone-setup step at the end matters.

### Ordered checklist

1. **Install Android Studio** — [developer.android.com/studio](https://developer.android.com/studio). Multi-GB download; this is the big one. Open it once and let the first-run wizard install the default SDK (this also lays down `~/Library/Android/sdk` and `adb`).

2. **Install a standalone JDK 21 (LTS)** — do this even though Android Studio ships its own JDK. Two reasons the bundled one isn't enough for our command-line workflow (`npx cap sync`, `gradlew`):
   - Android Studio's JDK lives _inside the app bundle_ (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`) and is **not registered with macOS**, so `/usr/libexec/java_home` can't find it — which is what the `JAVA_HOME` line below relies on.
   - It also tends to track a **very new JDK** (25 at time of writing), ahead of what the Gradle version Capacitor scaffolds officially supports. A standalone **JDK 21 LTS** is the safe, supported target.

   Install via Homebrew (may prompt for your password):

   ```bash
   brew install --cask temurin@21
   ```

   Verify: `/usr/libexec/java_home -v 21` now prints a path (it installs under `/Library/Java/JavaVirtualMachines/temurin-21.jdk/…`).

3. **Install SDK components** via Android Studio's **SDK Manager** (Settings → Languages & Frameworks → Android SDK):
   - **SDK Platform** for a recent, _stable_ API level (e.g. Android 15 / API 35 — the exact `compileSdk`/`targetSdk` gets pinned when `07b` scaffolds the project).
   - **Android SDK Platform-Tools** (provides `adb` — usually already installed by the first-run wizard).
   - **Android SDK Build-Tools** and, on the **SDK Tools** tab, **Android SDK Command-line Tools (latest)** — the latter provides `sdkmanager`, needed to accept SDK licences (Gradle refuses to build without them).

4. **Set environment variables** (add to `~/.zshrc`):

   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
   export PATH="$PATH:$ANDROID_HOME/platform-tools"
   ```

   **Finding your JDK:** `/usr/libexec/java_home -V` (capital V) lists every JDK macOS knows about. If it says _"Unable to locate a Java Runtime"_, no standalone JDK is installed yet — do step 2. The `-v 21` form above picks the version-21 entry from that list.

   Then `source ~/.zshrc`. Verify: `adb version` prints a version, `echo $ANDROID_HOME` is set, `echo $JAVA_HOME` points at temurin-21.

5. **Accept SDK licences:** `sdkmanager --licenses` (accept all), or do it through Android Studio's SDK Manager.

6. **Prepare your phone:**
   - **Enable Developer Options:** Settings → About phone → tap **Build number** seven times.
   - **Enable USB debugging:** Settings → System → Developer options → **USB debugging** on.
   - Connect the phone by USB, accept the **"Allow USB debugging?"** RSA prompt on the phone.
   - Verify from the Mac: `adb devices` should list your device (as `device`, not `unauthorized`).

Once `adb devices` shows your phone, the toolchain is ready and we can scaffold a minimal Capacitor shell for the `07a` keep-awake spike.

### Sanity check — you're ready when all of these pass

- [ ] `java -version` → 17 or 21
- [ ] `adb version` → prints a version
- [ ] `echo $ANDROID_HOME` → a real path
- [ ] `sdkmanager --list` → runs without a licence error
- [ ] `adb devices` → your phone listed as `device`

---

## Part 3 — Building the app locally (from 07b)

The Capacitor scaffold lives in `android/` (checked in; build artefacts are gitignored). The app runs from the **native Vite build variant** — self-hosted fonts, no analytics, a scoped CSP, no service worker, and three **build-time module aliases** (`virtual:pwa-register` → a no-op stub; `@/lib/presets` → `presets-local`, so presets are device-local and `/api/presets` never reaches the native bundle; `@/lib/wakeLock-platform` → `wakeLock-platform-native`, backing the screen wake lock with `@capacitor-community/keep-awake` and keeping the plugin out of the web bundle) — kept separate from the web build so "Takt's own process makes zero network calls" is structural, not observed. Native Capacitor plugins (e.g. keep-awake) are added with `pnpm add` and wired into `android/` by `npx cap sync android`, which updates the generated `capacitor.build.gradle`/`capacitor.settings.gradle` include entries; re-run `pnpm android:check` after any plugin install, since manifest-merge is where a dependency could reintroduce `INTERNET`. WebView origin is locked to `https://localhost` and the application ID to `org.hultberg.takt` — both immutable after first release.

### The pnpm scripts

| Command                      | What it does                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build:native`          | Vite build in native mode → `dist-native/` (fonts self-hosted, no analytics, scoped CSP, SW disabled).                                                                                                                                                                                                                                                              |
| `pnpm cap:sync`              | `build:native` then `cap sync android` — copies the native bundle into the Android project. Run this before any Gradle build.                                                                                                                                                                                                                                       |
| `pnpm android:check`         | Asserts the **built APK's merged manifest** has **no `INTERNET`** permission, **and** keeps the speech-recogniser surface: `RECORD_AUDIO` + the `RecognitionService` `<queries>` block (both contributed by the speech plugin's manifest merge, 07f). The durable guard behind `tools:node="remove"` and the "voice silently unavailable without `<queries>`" trap. |
| `pnpm fonts:copy`            | Refreshes the bundled variable `woff2` in `public/fonts/` from the `@fontsource-variable/*` packages (only after bumping them).                                                                                                                                                                                                                                     |
| `node scripts/gen-icons.mjs` | Regenerates web + Android launcher icons and the splash logo from the "takt" wordmark SVG — no external artwork.                                                                                                                                                                                                                                                    |

### Build + verify a debug APK

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

pnpm cap:sync                       # build native bundle + copy into android/
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
cd .. && pnpm android:check         # confirm no INTERNET in the merged manifest
```

### Install + launch on a connected phone

```bash
cd android && ./gradlew installDebug        # or: adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p org.hultberg.takt -c android.intent.category.LAUNCHER 1
```

If `adb devices` is empty, the phone isn't in debugging mode / the USB cable is charge-only — see the Part 2 sanity check.

---

## Part 4 — Native voice (on-device recogniser + local parser, from 07f)

On native, the web voice pipeline (`MicButton` → `useVoiceMachine` → `POST /api/voice/parse`, Whisper + Llama) is swapped, via a build-time alias (`@/lib/voice/useVoiceMachine` → `useVoiceMachine-native.ts`), for an **on-device pipeline**: Android's system speech recogniser → a local **English-only deterministic parser** → `{ sets, workSec, restSec }`. `MicButton`/`VoiceOverlay` stay shared. See [ADR 2026-07-26 (+ 2026-08-02 addendum)](./decisions/2026-07-26-android-on-device-voice-parsing.md) for the why.

**Takt still makes no network call** — the recogniser runs in a separate Google process (which _may_ go online to transcribe), reached without `INTERNET`. Two plugins back this: `@capacitor-community/speech-recognition` (capture + transcription; contributes `RECORD_AUDIO` and the `RecognitionService` `<queries>` block via manifest merge) and `capacitor-native-settings` (deep link to the app settings page when the mic is permanently denied).

**Fail-safe by design:** every low-confidence/failed parse, unavailable recogniser, or denied permission routes to the manual/Interpretation screen (`/configure`) — **never a silent or wrong auto-configuration**. The parser never guesses a missing field. A _confident_ parse also carries the heard transcript through to Configure, which renders it as a read-only "Heard: …" hint — the mitigation for a confident-but-_misheard_ parse ("fifty" heard as "fifteen"), the one gap the missing-field fallback can't catch. Native-only: the web pipeline already flashes the transcript in its transient parsing overlay, so the web path passes only the session.

**English-only UI follows from English-only voice.** Because the recogniser and parser only handle English, the whole native app is forced to English: `I18nProvider` pins `lang` to `'en'` on `isNativePlatform()` (ignoring stored and device-detected language — a Swedish phone reports `sv-SE` via `navigator.language` in the WebView, which would otherwise strand the user in a Swedish UI), and the Settings language toggle is hidden. The web app keeps full Swedish. See [i18n.md](./i18n.md) "Language detection and persistence" for the startup priority.

**Two device-confirmed recogniser quirks (workarounds live in `recognizer.ts` / the native hook):**

- **Service-rebind race — the "second tap fails" bug.** Android tears down the speech service after each recognition, and `@capacitor-community/speech-recognition` reuses one cached `SpeechRecognizer` without recreating it. So the first `start()` after a completed recognition can lose the service binding and fail in ~20 ms — before the mic opens — surfaced as a generic "Didn't understand" (logcat: `RemoteSpeechRecognitionService: Connection to speech recognition service lost` / `Service is unbinding`). A real result or no-match only happens after seconds of listening, so `recognizeOnce()` treats a sub-1s failure as the race and **retries once after a 250 ms settle**. Do not remove this without re-testing repeated back-to-back voice sessions on device.
- **Online-only recognition on many devices.** The plugin doesn't set `EXTRA_PREFER_OFFLINE`, so even a device with an on-device pack (the test OnePlus does) uses Google's network recogniser. In airplane mode `start()` rejects with "Network error"; the native hook maps that to the **offline** sheet ("you're offline, Configure manually") rather than the retry sheet, since retrying offline can't succeed. This is consistent with the accepted "voice may use the online path" decision — the core timer is still fully offline; only voice needs a connection here.

### Supported parser grammar (v1, `src/lib/voice-local/parser.ts`)

Conservative closed grammar — returns a confident `{ sets, workSec, restSec }` **only when all three are present**, otherwise falls back:

- **Set count:** `<number> sets|rounds` ("three sets", "5 rounds"). `reps` is deliberately **not** accepted (rep-based work is Timer mode's job).
- **Durations:** `<number> minute(s)|min|second(s)|sec`, or `mm:ss` ("90 seconds", "2 min", "1:30"). A compound merges only when joined by "and" ("one minute **and** thirty seconds"). A bare number with no unit is never a duration.
- **Numbers:** digits, or English words 0–99 incl. compounds ("forty five"); "a"/"an" = 1 before a unit.
- **Work markers:** `of` / `for` / `on` / `work`. **Rest markers:** `rest` / `break` / `off` / `between` / `in between`, plus explicit `no rest` / `without rest` / `no break` → `restSec: 0`. Rest wins when a duration carries both.
- **Rejected (fall back, never guess):** decimals / thousands separators ("2.5 minutes"), an `mm:ss` seconds component ≥ 60, sets outside 1–99, durations outside 1–3600 s.
- **Known safe limits:** recogniser homophones ("for"→"four", "to"→"two") are **not** mapped to numbers, so they fall back rather than mis-configure.

The pinned validation corpus lives in `src/lib/voice-local/fixtures/phrase-corpus.ts`; real-hardware transcript validation (spoken aloud, not typed) is where the corpus earns its acceptance tick.

---

## Part 5 — Native app lifecycle & hardware back button (from 07g)

`@capacitor/app` is wrapped behind an aliased seam (`@/lib/app-lifecycle` → `app-lifecycle-native.ts`), keeping the plugin out of the web bundle. It backs two things:

- **Background-pause via `appStateChange`.** `useTimerMachine` drives its `visibilityHidden`/`visibilityVisible` events off the seam. On web that's DOM `visibilitychange` (unchanged); on native it's `appStateChange`, which 07a Spike 2 confirmed fires reliably on both app-background and screen-lock — the WebView's `visibilitychange` is the signal we deliberately route around. Only one signal is used per platform (no double-dispatch); the machine's `visibilityHidden` is idempotent when already paused as a safety net.
- **Hardware back button** (`NativeBackButton`, one listener, app-level). Decision is made from the **router location**, not the plugin's `canGoBack` (which reflects WebView history and can disagree with React Router):
  - An **active interval session** (running or paused, published by `RunInner` via the `interval-active` context) → confirm dialog before leaving. A running timer is **paused while the dialog is up** (so it doesn't advance or beep behind an overlay the user can't see) and resumed on "Keep going" — but only if the dialog was the thing that paused it, never un-pausing a timer the user had already paused. Wins over the stopwatch in the concurrent case.
  - **Root (`/`)** → `exitApp()` (a running stopwatch persists in `localStorage` and resumes on relaunch — the intentional silent-exit).
  - **Deeper screens** (incl. `/timer` with a running stopwatch) → `navigate(-1)`, so exiting from `/timer` is a two-press gesture (`/timer` → Home → exit). A deliberate consequence of deciding from the router rather than special-casing screens; standard Android sub-screen behaviour.
  - Back while the confirm dialog is open dismisses the dialog (and resumes the timer if the dialog paused it).

Honest limits (documented, not bugs): the confirm guards only the literal back gesture — HOME/app-switch already pauses an interval session silently, and the interval session is not persisted, so OS process-eviction while backgrounded loses it regardless.

---

## Part 6 — Signing & release (signed AAB, from 07h)

Google Play requires a **signed Android App Bundle (`.aab`)**, not the debug APK. Signing is driven by a **gitignored** `android/keystore.properties` that points at a keystore file (also gitignored) — so no signing secret ever enters the repo. When the file is absent (fresh clone, CI, debug work), release builds fall back to unsigned and the project still builds.

### One-way doors (read first)

- **The upload keystore is unrecoverable.** After the first Play release, every update must be signed with the **same** key. Lose the `.jks` or its passwords and you can never update the app under this listing — you'd have to publish a brand-new listing under a new application ID. **Back it up outside the repo** (password manager + an offline copy).
- **`versionCode` only ever goes up.** Play rejects an upload whose `versionCode` is ≤ the highest already uploaded to any track. Bump it every upload (see below).
- **`android:allowBackup="false"`** is set deliberately (`AndroidManifest.xml`) so uninstall/reinstall returns to zero state. Don't flip it without re-checking the "reinstall wipes data" criterion.

### One-time: generate the keystore (Magnus runs this — you hold the password)

The password is **yours**; run this yourself so I never see it. It prompts for a store password (choose a strong one, save it to your password manager), then some identity fields (any sensible values), then the key password (press Enter to reuse the store password — simplest):

```bash
keytool -genkeypair -v \
  -keystore android/takt-release.jks \
  -alias takt \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

Then create `android/keystore.properties` from the template and fill in your passwords:

```bash
cp android/keystore.properties.example android/keystore.properties
# then edit android/keystore.properties — set storePassword / keyPassword to what you chose
```

Both `android/takt-release.jks` and `android/keystore.properties` are gitignored. **Back both up now**, before building anything. They're gitignored but still inside the working tree, so a `git clean -xdf` would delete the unrecoverable upload key — the off-machine backup (password manager + offline copy) is what actually protects you. If you prefer, `storeFile` can point at an absolute path **outside** the repo (`rootProject.file()` resolves it as-is); the backup matters more than the location.

> **Play App Signing:** Google's default (recommended, on by default for new apps) is that Play holds the _app signing key_ and re-signs your uploads; the key you generate above is the _upload key_. If you ever lose the upload key, Google support can reset it — but only if Play App Signing is enabled, which is why we keep the default. Enrol when you first create the app on the console.

### Build a signed AAB

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"

pnpm build:aab
# → android/app/build/outputs/bundle/release/app-release.aab   (this is what you upload)
```

`build:aab` runs `cap:sync` (native Vite build + copy into `android/`) then Gradle's `bundleRelease`. If `keystore.properties` is present the AAB is signed; if not, it's unsigned (and Play will reject it).

### Verify before uploading

```bash
# Confirm the merged manifest is clean (no INTERNET, recogniser <queries> present).
# Runs against a debug APK, whose manifest merge is identical to release here (minify off):
pnpm cap:sync && cd android && ./gradlew assembleDebug && cd .. && pnpm android:check

# Confirm the AAB is actually signed:
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab | tail -3
```

### Bump the version for each upload

In `android/app/build.gradle` (`defaultConfig`): increment `versionCode` by 1 every upload; set `versionName` to the human-facing version (e.g. `"1.0"`, `"1.1"`). First release ships as `versionCode 1` / `versionName "1.0"` (already set).

### Upload to the closed-testing track

1. Play Console → **Takt** → **Testing → Closed testing** → create/enter a track → **Create new release**.
2. Enrol in **Play App Signing** when prompted (keep the default).
3. Upload `app-release.aab`, add release notes, roll out to the track.
4. Add testers (see Part 1), share the opt-in link, and the **14-day clock** starts once ≥12 are opted in.

---

## Cross-references

- [SPECIFICATIONS/07-android-app.md](../SPECIFICATIONS/07-android-app.md) — the umbrella spec (north star, architecture, risks).
- [SPECIFICATIONS/07b-capacitor-scaffold.md](../SPECIFICATIONS/07b-capacitor-scaffold.md) — the scaffold deliverable this build workflow comes from.
- [SPECIFICATIONS/07a-spikes.md](../SPECIFICATIONS/07a-spikes.md) — the first code work (keep-awake / lifecycle / speech-recognition), needs the dev environment above.
- [SPECIFICATIONS/07f-voice-pipeline.md](../SPECIFICATIONS/07f-voice-pipeline.md) — the native voice deliverable documented in Part 4 above.
- [SPECIFICATIONS/07h-publishing.md](../SPECIFICATIONS/07h-publishing.md) — the publishing deliverable, whose admin track is Part 1 above.
- [environment-setup.md](./environment-setup.md) — the _web_ app's Cloudflare/Wrangler environment (unrelated to Android, but the sibling setup doc).
