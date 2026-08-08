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
   - You'll later fill: store listing (copy + screenshots — I'll draft these), **privacy policy URL**, **Data Safety** form, content rating questionnaire, target audience.
   - The **Data Safety** form is a legal attestation. It must say: no account/personal data collected; and that **voice input may be processed by Google's speech-recognition service** (pending a policy check on whether a user-invoked system recogniser counts as app-collected data — declare conservatively if unclear). I'll prep the exact answers under `07h`.

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

## Cross-references

- [SPECIFICATIONS/07-android-app.md](../SPECIFICATIONS/07-android-app.md) — the umbrella spec (north star, architecture, risks).
- [SPECIFICATIONS/07a-spikes.md](../SPECIFICATIONS/07a-spikes.md) — the first code work (keep-awake / lifecycle / speech-recognition), needs the dev environment above.
- [SPECIFICATIONS/07h-publishing.md](../SPECIFICATIONS/07h-publishing.md) — the publishing deliverable, whose admin track is Part 1 above.
- [environment-setup.md](./environment-setup.md) — the _web_ app's Cloudflare/Wrangler environment (unrelated to Android, but the sibling setup doc).
