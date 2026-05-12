// ABOUT: Shared language-gate set for the voice pipeline.
// ABOUT: Whisper occasionally tags Swedish speech as Icelandic (shared Nordic phonology,
// ABOUT: especially open-back vowels: "åtta" → "ótta", "sekunder" → "sekundar"). Accepting
// ABOUT: the Nordic cousins prevents false rejects; Llama handles the spelling variance.
// ABOUT: Phase 5's language-hint work will reuse this set when narrowing Whisper.

export const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  'en',
  'sv',
  'is',
  'no',
  'nn',
  'nb',
  'da',
]);
