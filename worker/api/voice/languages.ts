// ABOUT: Shared language-gate set for the voice pipeline.
// ABOUT: Without a language hint, Whisper tags Swedish speech as Icelandic (shared Nordic phonology,
// ABOUT: especially open-back vowels: "åtta" → "ótta", "sekunder" → "sekundar"). The X-Takt-Lang
// ABOUT: hint (client UI language → Whisper input.language) tags the happy-path request as sv before
// ABOUT: Whisper runs. The Nordic cousins stay accepted as a safety net: on a clip that slips the
// ABOUT: hint the misclassification can still surface, and a wrong-but-editable parse beats a hard
// ABOUT: "unsupported" reject.

export const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  'en',
  'sv',
  'is',
  'no',
  'nn',
  'nb',
  'da',
]);
