# ADR: On-device, English-only voice parsing for the Android release

**Date:** 2026-07-26
**Status:** Active — see the 2026-08-02 addendum, which supersedes the "zero network, ever" framing for the recogniser (the local parser decision stands).

---

## Decision

The Phase 7 Android app parses voice-driven session setup entirely on-device: Android's on-device (offline-only) speech recognizer produces a transcript, which a new deterministic English-only parser turns into `{ sets, workSec, restSec }`. No audio, transcript, or request of any kind is sent to a server. Low-confidence or failed parses fall back to the existing manual/Interpretation configuration screen rather than guessing. This applies only to the Android build — the web app's Whisper + Llama pipeline on Workers AI is unchanged.

## Context

Phase 7's Android app is required to make zero network requests, for any feature, under any condition — a hard product requirement Magnus set for this release, distinct from anything the web app promises. Voice-driven setup is the one feature that can't trivially satisfy that requirement, since the web app's voice pipeline is a network call by construction (Whisper transcription + Llama intent parsing on Cloudflare Workers AI).

This is not a fresh decision made in a vacuum. [ADR 2026-04-20](./2026-04-20-llama-primary-ndjson-streaming.md) documents a half-day spike, during Phase 3, that built and rejected almost exactly this shape: a deterministic parser fed by speech-recognition transcripts. That spike found the parser fell through to a Llama fallback on roughly 50% of Swedish phrases, because Whisper's transcription variance ("sätt" for "sett", Icelandic-phonology misdetection of Swedish on iOS, compound-numeral spelling drift) broke the closed-grammar rules faster than they could be patched. The ADR's stated conclusion was that "the product vision rejects per-phrase rule-chasing."

This ADR exists to address that precedent directly rather than quietly re-running a rejected experiment. The short version: the constraint has changed (zero network is now a hard requirement for this specific surface, which it never was for the web app), the scope has narrowed (English only, not English + Nordic-cousins), and the safety design is different (explicit low-confidence fallback rather than an implicit assumption the parser would just work). Those differences are real, but the underlying failure mode — transcript noise defeating a closed-grammar parser — has not been disproven for this narrower case, only left untested. This decision is made with that risk open-eyed, not on the assumption it's been solved.

## Alternatives considered

- **Keep calling Workers AI (Whisper + Llama) over the network when online, cut voice when offline.** The option this replaces from the original Phase 7 draft.
  - Why not: violates the zero-network-ever requirement outright — even "only when online" is still a network call, and the whole point of this constraint is that the app never depends on connectivity for anything, including knowing whether it has connectivity for an optional feature.

- **An on-device LLM instead of a rule-based parser**, to get Llama-like robustness without a server call.
  - Why not: disproportionate cost (hundreds of MB–GB of model weights, native ML runtime integration, real battery/CPU impact) for what is, in English, a genuinely narrow closed-grammar problem — set counts, durations, rest periods, a handful of connecting words. A rule-based parser is a better fit for the actual problem shape once a single language is in play.

- **Reuse the archived prototype parser** (`SPECIFICATIONS/prototype-design-files/voice.js`) unchanged.
  - Why not: that file is literally the design 2026-04-20 rejected. Reusing it unchanged would repeat the same mistake rather than apply what was learned from it.

- **Cut voice-driven setup from the Android app entirely, manual configuration only.**
  - Why not: viable and genuinely the fallback if on-device parsing proves unreliable in testing (see Trade-offs below), but not chosen as the starting point — voice-first is core to Takt's product identity, and it's worth a scoped, honestly-validated attempt before giving up on it for this platform.

- **Chosen: on-device recognizer + new English-only deterministic parser, with an explicit low-confidence fallback to manual entry.**

## Reasoning

Three things differ from the 2026-04-20 spike's conditions, and together they're enough to justify trying this again rather than treating the prior finding as final for every future context:

1. **Different constraint.** The web app never needed zero network; this Android build does. The prior ADR's "why not a parser" reasoning was weighed against a context where a network fallback was always available and cheap (a few hundred milliseconds of Llama latency). Here, network isn't an option at all, so the comparison is "local parser vs. no voice feature," not "local parser vs. a proven network alternative."

2. **Narrower scope.** English only, not English + five Nordic-cousin tags. The specific failure pattern the spike measured — Swedish transcription variance and Icelandic misdetection — doesn't apply to an English-only build. English still has its own variance (accents, "ninety second" vs "ninety seconds", background noise), so this is not assumed to be risk-free, just a materially different and untested risk profile.

3. **Different failure handling.** The spike's parser-first design apparently expected the parser to mostly work, with Llama catching the tail. This design inverts that: the parser is expected to fail sometimes, and every failure or low-confidence result routes to the manual/Interpretation screen that already exists in the product. A wrong guess is not an acceptable outcome under this design; an honest "couldn't parse that, please adjust manually" is.

Given those differences, proceeding is a reasonable bet — but it is a bet, not a resolved question, and the acceptance bar reflects that: "usable," validated against a pinned phrase corpus and real speech on real hardware, not "matches the web app's accuracy."

## Trade-offs accepted

**Voice accuracy will likely not match the web app.** This is accepted explicitly and communicated honestly rather than papered over — the Android app's voice feature is a lower-fidelity sibling of the web app's, by design, in exchange for zero network dependency and zero inference cost.

**No graceful network fallback if local parsing fails.** Unlike the web app, there's no Llama to catch what the local parser misses — the fallback is always the manual configuration screen, never a silent retry over a connection that, by requirement, doesn't get used.

**Real risk the local parser is simply not good enough, even English-only.** If phrase-corpus and real-hardware validation shows the failure rate is too high to be a usable feature, the fallback is to cut voice-driven setup from the Android v1 release entirely — manual configuration only — rather than ship an unreliable parser dressed up as a real feature. This is a live possibility, not a hypothetical.

**On-device recognizer availability isn't guaranteed on every Android device.** Depends on the user having an offline language pack installed via the Google app. Handled the same way as a parser failure: fall back to manual entry, with a clear message.

## Implications

**Enables:**

- A genuine "works with the network off, permanently, by design" claim for the Android app — a real product differentiator and a clean privacy story (nothing to transcribe or log, because nothing leaves the device).
- A validated, from-scratch parser design that incorporates the specific lessons of 2026-04-20 (explicit confidence/failure signal, narrow single-language grammar) rather than repeating the prototype's mistakes.

**Prevents / complicates:**

- Cross-platform voice-quality parity — Android's voice feature is deliberately a different, lesser-fidelity thing than the web app's, and that difference needs to be communicated honestly in the app (not hidden as if it were equivalent).
- Adding more languages to the Android build later requires the same rule-authoring effort the 2026-04-20 ADR specifically rejected for the web app — this remains a real constraint on future scope, not solved by anything in this decision.

---

## Addendum: the recogniser may use Google's online path (2026-08-02)

**Decision changed:** the transcription step is no longer required to be strictly on-device/offline. The Android app uses the **system speech recogniser** (via a Capacitor plugin), preferring an on-device path where the platform provides one but **accepting an online transcription path where it doesn't** — we don't fight Google's own recogniser behaviour. The **local English-only deterministic parser, its low-confidence fallback, and the whole "parser vs. the 2026-04-20 precedent" reasoning above are unchanged.** Only the "zero network, ever, including transcription" premise in the original Context is superseded.

**Why:** building or bundling a guaranteed-offline recogniser is disproportionate for a lean £0.99 learning project. Delegating to the OS recogniser — the same one every Android voice-keyboard uses — is the lean choice. This was an explicit owner (Magnus) call: working, lean voice over an absolute privacy claim.

**What still holds — Takt's own process makes zero network calls.** Presets, history, timer, settings, fonts, analytics: none touch a server, and `INTERNET` is removed from Takt's manifest. The recogniser runs in a **separate Google process** with its own permissions, so Takt can invoke it without `INTERNET` (to be confirmed in a spike) and the removal still holds for everything Takt itself does.

**Consequences (recorded so they aren't rediscovered late):**

- The store listing **cannot** claim "nothing ever leaves the device, ever." It claims instead: your presets and history never leave the device, no account ever, and voice input uses the phone's built-in speech recognition (which may involve Google, like any Android mic button).
- The **Play Data Safety form** must reflect that voice audio may be processed by Google — pending a policy check on whether a user-invoked system recogniser counts as app-collected data or an OS service. Declare conservatively if unclear. This is a legal attestation, not just copy.
- The "Enables" bullet below ("nothing leaves the device, because nothing is transcribed off-device") is narrowed accordingly: it holds for everything Takt stores, not for the voice transcription path.

**Not superseded:** the parser accuracy risk, the English-only scope, the explicit-fallback safety design, and the "cut voice from v1 if it's not usable" contingency all stand exactly as written above.

**Implementation landed (07f, 2026-08-09):** the recogniser is `@capacitor-community/speech-recognition` (single-shot `start()` → best transcript; `available()`/`checkPermissions()`/`requestPermissions()` for the availability + `RECORD_AUDIO` gate), and the permanent-denial recovery deep-link is `capacitor-native-settings`. Confirmed on a built APK: the speech plugin contributes both `RECORD_AUDIO` **and** the `RecognitionService` `<queries>` block via manifest merge (no manual manifest edit), and — the spike's open question — the merged manifest still has **no `INTERNET`**, so Takt invokes the recogniser without it. `scripts/check-android-manifest.mjs` now asserts all three (INTERNET absent; RECORD_AUDIO + `<queries>` present) so a later `cap sync` can't silently drop them. The web build is unchanged (the swap is a build-time alias, invisible to the Vitest/web path). The parser's supported grammar is documented in [REFERENCE/android-app.md](../android-app.md) Part 4.

**Partial mitigation for the open parser-accuracy risk (07f follow-up, 2026-08-10, #134):** the "transcript noise defeating a closed-grammar parser" failure mode above has a subtype the fail-safe fallback can't catch — a _confident but misheard_ parse ("fifty" heard as "fifteen"), which parses cleanly and wrong. A confident native parse now carries the heard transcript to Configure, rendered as a read-only "Heard: …" hint so the user can sanity-check it against the editable numbers. This narrows, but does not close, the risk — it turns a silent wrong pre-fill into a visible one; the risk stays open-eyed as written above.

---

## References

- Related ADRs: [2026-04-20-llama-primary-ndjson-streaming.md](./2026-04-20-llama-primary-ndjson-streaming.md) — the precedent this decision directly addresses; [2026-07-26-capacitor-android-wrapper.md](./2026-07-26-capacitor-android-wrapper.md) — the platform this voice pipeline runs inside.
- Phase spec: [SPECIFICATIONS/07-android-app.md](../../SPECIFICATIONS/07-android-app.md)
- Rejected prior art: [SPECIFICATIONS/prototype-design-files/voice.js](../../SPECIFICATIONS/prototype-design-files/voice.js)
