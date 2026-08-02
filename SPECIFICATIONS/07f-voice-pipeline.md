# Phase 7f: Native voice pipeline

> Part of [Phase 7: Android app](./07-android-app.md). Read the umbrella first, plus the voice architecture decision and [ADR 2026-07-26 (+ 2026-08-02 addendum)](../REFERENCE/decisions/2026-07-26-android-on-device-voice-parsing.md). **Living spec — detail firms up after [07a](./07a-spikes.md) Spike 3.** The parser is the one place a bug could silently misconfigure a user's session, so it carries the highest per-line risk in the phase.

**Depends on:** 07a Spike 3 (go/no-go), 07b (native build, manifest).
**Gates:** nothing downstream.
**Shippable?** Yes — after this, native voice-driven setup works (or cleanly falls back to manual). Can also be _cut_ from v1 if real-hardware validation shows the parser isn't usable (manual entry is fully faithful).

---

## Goal

Replace the web capture-and-parse path (`MicButton` → `useVoiceMachine` → `POST /api/voice/parse`, Whisper + Llama) with an **on-device pipeline**: Android's system speech recogniser → a new **English-only deterministic intent parser** → `{ sets, workSec, restSec }`, with every low-confidence/failed parse routed to the existing manual/Interpretation screen — **never a silent misconfiguration.**

## Scope (firms up post-spike)

- [ ] **`src/lib/voice-local/recognizer.ts`** — wrapper over a Capacitor speech-recognition plugin (e.g. `@capacitor-community/speech-recognition`), preferring on-device where the platform offers it, **accepting an online transcription path where it doesn't** (we don't fight Google's recogniser). Reports unavailability so the manual fallback triggers.
- [ ] **`src/lib/voice-local/parser.ts`** — deterministic English-only intent parser, closed-grammar ("three sets of one minute, thirty seconds rest"). Emits either an exact `{ sets, workSec, restSec }` or an explicit **low-confidence → fall back** signal. Never guesses.
- [ ] **`src/lib/voice-local/fixtures/phrase-corpus.ts`** — pinned validation phrases (same methodology as the Phase 3 spike), each asserting an exact expected parse or an explicit fallback.
- [ ] **Capture UI on native** — `MicButton`, `VoiceOverlay`, `useVoiceMachine` change because the plugin does its own capture (a different mechanism from the web `MediaRecorder`). Whatever live level/waveform feedback `VoiceOverlay` drives off the web analyser goes **dead on native** and needs a substitute affordance (plugin partial-results callback, or a simple listening animation) so native doesn't look broken mid-capture.
- [ ] **Manifest `<queries>` block for `RecognitionService`** — on Android 11+, `isRecognitionAvailable()` returns `false` without `<queries><intent><action android:name="android.speech.RecognitionService"/></intent></queries>`. Without it, voice silently _always_ falls back to manual on modern devices, reading as "the parser is broken". **Present and verified in the merged manifest**, alongside 07b's `INTERNET`-absent check. Note the manifest tension: durably _remove_ one permission and durably _keep_ this queries block, both across `cap sync`.
- [ ] **`RECORD_AUDIO` runtime permission** — first-denial re-prompt **and** a permanently-denied recovery path (deep link to the app's Android settings page — needs a native-settings/app-launcher plugin; `@capacitor/app` doesn't expose this). The existing web permission-denied copy assumes a browser and needs an Android variant.

## Scope notes

- **Timer mode is out of the parser's scope entirely** — the stopwatch is touch-launched, nothing to parse. The parser only ever produces interval-session config.
- **English-only is a _parser_ constraint, not a recogniser one** — the recogniser could transcribe other languages, but the parser is English-only for v1. Swedish-speaking users use manual entry (fully faithful) or English voice.

## Parser precedent — proceed open-eyed (not a resolved question)

[ADR 2026-04-20](../REFERENCE/decisions/2026-04-20-llama-primary-ndjson-streaming.md) built and rejected exactly this shape — a deterministic parser fed by recognition transcripts — because transcription variance broke it on ~50% of Swedish phrases. That's about transcript noise defeating a closed grammar, not a Whisper quirk, so it doesn't vanish with a new engine. This phase differs: (1) **English only**, removing the Nordic-misdetection driver — but English-only accuracy was never separately measured, so it's _untested, not disproven_; (2) the parser fails **loudly and safely**; (3) the bar is "usable", not "matches Llama". If real-hardware validation shows it's unusable even for English, **cut voice from v1** (manual-only) rather than ship something that guesses wrong.

## Acceptance criteria

- [ ] Voice-driven creation correctly parses a representative English corpus with results Magnus judges **usable** (understanding it won't match the web app's Llama accuracy).
- [ ] Every low-confidence/failed parse, and every recognition-unavailable case, lands on the **manual/Interpretation screen** — never a silent or wrong auto-configuration.
- [ ] `isRecognitionAvailable()` returns `true` on a modern device with the `<queries>` block present (verified in the merged manifest).
- [ ] `RECORD_AUDIO`: first denial re-prompts; permanent denial routes to the app settings page with Android-appropriate copy.
- [ ] Native capture shows a working listening affordance (no dead waveform).
- [ ] Takt's own process still makes **no** network call — the recogniser subprocess is the only audio egress, disclosed in 07h's Data Safety form.
- [ ] Web voice pipeline unchanged; existing Vitest suite passes.

## Testing

- Parser tested against the pinned corpus — every entry asserts an exact parse or explicit fallback.
- Manual (real hardware): speak the corpus aloud (not typed transcripts); force a low-confidence parse and confirm the manual fallback; force recognition-unavailable and confirm the fallback.
- Merged-manifest check: `<queries>` present (and `INTERNET` still absent).

## Risks specific to this deliverable

- **Local parser accuracy is an open empirical question** — bounded by English-only scope + corpus validation, not eliminated. Cut-to-manual is the honest fallback.
- **Voice silently unavailable without `<queries>`** — presents as "parser never works"; the manifest check guards it.
- **Voice audio egress vs the Data Safety form** — audio may reach Google; the declaration (07h) must reflect this. An inaccurate legal attestation, not a copy nit.
- **Recognition availability varies by device** (language-pack dependent) — detect and route to manual with a clear message.

## PR workflow

Branch `feature/phase-7f-voice-pipeline`. New client logic where a bug silently misconfigures a session — `/review-pr-team` recommended (the umbrella singles this out).
