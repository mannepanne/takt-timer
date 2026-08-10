// ABOUT: Shared language-gate set for the voice pipeline.
// ABOUT: Whisper occasionally tags Swedish speech as Icelandic (shared Nordic phonology,
// ABOUT: especially open-back vowels: "åtta" → "ótta", "sekunder" → "sekundar"). The X-Takt-Lang
// ABOUT: hint (client UI language → Whisper input.language) fixed the misclassification at source,
// ABOUT: so this happy-path is now sv-tagged. The Nordic cousins stay accepted as a safety net:
// ABOUT: if a clip ever slips the hint, a wrong-but-editable parse beats a hard "unsupported" reject.

export const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  'en',
  'sv',
  'is',
  'no',
  'nn',
  'nb',
  'da',
]);
