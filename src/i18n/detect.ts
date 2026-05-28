// ABOUT: Detects the preferred UI language from the browser's navigator.language.
// ABOUT: Maps sv-* locales to Swedish; everything else defaults to English.

import type { Lang } from './strings';

export function detectLanguage(nav: Pick<Navigator, 'language'> = navigator): Lang {
  const tag = nav.language ?? '';
  return tag.toLowerCase().startsWith('sv') ? 'sv' : 'en';
}
