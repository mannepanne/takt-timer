// ABOUT: Accent colour palette for Takt.
// ABOUT: Names are the canonical D1 accent_colour IDs — do not rename without a migration.

export type AccentId = 'lichen' | 'coral' | 'ocean' | 'amber' | 'iris' | 'slate';

export type Accent = {
  id: AccentId;
  main: string;
  deep: string;
  soft: string;
};

// `deep` is the light-mode text/icon shade of each accent and is tuned to clear WCAG AA 4.5:1 on
// every surface it sits on — paper, paper-2, the white surface, and the accent-soft tint
// (scripts/check-contrast.mjs verifies all four). `main` is the fill colour and is never used
// as text.
export const ACCENTS: Accent[] = [
  { id: 'lichen', main: '#4ea47a', deep: '#216f49', soft: 'rgba(78,164,122,0.14)' },
  { id: 'coral', main: '#e05c5c', deep: '#ab3636', soft: 'rgba(224,92,92,0.14)' },
  { id: 'ocean', main: '#4a8eff', deep: '#1e5bcd', soft: 'rgba(74,142,255,0.14)' },
  { id: 'amber', main: '#d97c2a', deep: '#944f0e', soft: 'rgba(217,124,42,0.14)' },
  { id: 'iris', main: '#7c6ef3', deep: '#5246c8', soft: 'rgba(124,110,243,0.14)' },
  { id: 'slate', main: '#5a7fa8', deep: '#3a5f88', soft: 'rgba(90,127,168,0.14)' },
];

export const DEFAULT_ACCENT_ID: AccentId = 'lichen';

export function findAccent(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
