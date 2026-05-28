// ABOUT: Accent colour palette for Takt.
// ABOUT: Names are the canonical D1 accent_colour IDs — do not rename without a migration.

export type AccentId = 'lichen' | 'coral' | 'ocean' | 'amber' | 'iris' | 'slate';

export type Accent = {
  id: AccentId;
  main: string;
  deep: string;
  soft: string;
};

export const ACCENTS: Accent[] = [
  { id: 'lichen', main: '#4ea47a', deep: '#23764e', soft: 'rgba(78,164,122,0.14)' },
  { id: 'coral', main: '#e05c5c', deep: '#b83a3a', soft: 'rgba(224,92,92,0.14)' },
  { id: 'ocean', main: '#4a8eff', deep: '#1f5fd6', soft: 'rgba(74,142,255,0.14)' },
  { id: 'amber', main: '#d97c2a', deep: '#a85a10', soft: 'rgba(217,124,42,0.14)' },
  { id: 'iris', main: '#7c6ef3', deep: '#5246c8', soft: 'rgba(124,110,243,0.14)' },
  { id: 'slate', main: '#5a7fa8', deep: '#3a5f88', soft: 'rgba(90,127,168,0.14)' },
];

export const DEFAULT_ACCENT_ID: AccentId = 'lichen';

export function findAccent(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
