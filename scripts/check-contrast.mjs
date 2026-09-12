// ABOUT: WCAG contrast report for the light and dark token palettes in src/styles.css.
// ABOUT: A no-regression check (dark must not score worse than light), not an absolute AA gate —
// ABOUT: the light palette carries pre-existing sub-AA pairs, listed as exemptions below.
//
// Run: node scripts/check-contrast.mjs   (exit 1 on a regression; the table is the PR artefact)
//
// The pair list is hand-maintained. It will drift if nobody keeps it in step with the stylesheet,
// which is exactly why this is a PR artefact and not a CI gate.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
const accentsTs = readFileSync(resolve(root, 'src/lib/settings/accents.ts'), 'utf8');

// ── Token parsing ─────────────────────────────────────────────────────────────

function tokenBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`token block not found: ${selector}`);
  const tokens = {};
  for (const m of match[1].matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) tokens[m[1]] = m[2].trim();
  return tokens;
}

const light = tokenBlock(':root');
const dark = { ...light, ...tokenBlock(":root[data-theme='dark']") };

// Accent palette: `main` and the hand-authored light `deep` come from accents.ts; the dark `deep`
// is what applyAccentCss() derives inline — color-mix(in srgb, main 72%, white).
const accents = [...accentsTs.matchAll(/id: '(\w+)', main: '(#[0-9a-f]{6})', deep: '(#[0-9a-f]{6})'/g)].map(
  ([, id, main, deep]) => ({ id, main, deep }),
);
if (accents.length !== 6) throw new Error(`expected 6 accents in accents.ts, found ${accents.length}`);

// ── Colour maths ──────────────────────────────────────────────────────────────

function parseColour(value, tokens) {
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return parseColour(tokens[ref[1]], tokens);
  if (v === 'white') return [255, 255, 255, 1];
  if (v === 'black') return [0, 0, 0, 1];
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], rgba[4] === undefined ? 1 : +rgba[4]];
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+?)\)$/);
  if (mix) {
    const a = parseColour(mix[1], tokens);
    const b = parseColour(mix[3], tokens);
    const p = +mix[2] / 100;
    return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat([1]);
  }
  throw new Error(`cannot parse colour: ${value}`);
}

/** Composite an rgba colour over an opaque base. */
function over(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat([1]);
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── Pairs actually used in the app (hand-listed) ─────────────────────────────
// [label, foreground, background]. Foreground/background are token names or literal colours.

const TEXT_PAIRS = [
  ['ink on paper', '--ink', '--paper'],
  ['ink on paper-2', '--ink', '--paper-2'],
  ['ink on surface', '--ink', '--surface'],
  ['ink-2 on paper', '--ink-2', '--paper'],
  ['ink-2 on surface', '--ink-2', '--surface'],
  ['ink-3 on paper', '--ink-3', '--paper'],
  ['ink-3 on paper-2', '--ink-3', '--paper-2'],
  ['ink-3 on surface', '--ink-3', '--surface'],
  ['mute on paper', '--mute', '--paper'],
  ['mute on surface', '--mute', '--surface'],
  ['on-fill on fill', '--on-fill', '--fill'],
  ['danger on paper', '--danger', '--paper'],
  ['danger on paper-2', '--danger', '--paper-2'],
  ['warn on paper', '--warn', '--paper'],
  ['success on paper', '--success', '--paper'],
  ['on-accent on danger', '--on-accent', '--danger'],
];

// Pre-existing sub-AA pairs in the shipped light palette. Reported, never regressed, not fixed here.
// `accent on paper` is the accent-coloured link text (.settings-link, .privacy-link).
const EXEMPT_FROM_AA = new Set([
  'mute on paper',
  'mute on surface',
  'warn on paper',
  'success on paper',
  'danger on paper-2',
  ...accents.map((a) => `${a.id}: on-accent on accent`),
  ...accents.map((a) => `${a.id}: accent on paper`),
]);

// ── Report ────────────────────────────────────────────────────────────────────

function evaluate(theme, tokens, accentValues) {
  const rows = [];
  const resolve = (name, base) => {
    const c = parseColour(name.startsWith('--') ? tokens[name] : name, tokens);
    return c[3] < 1 ? over(c, base) : c;
  };
  for (const [label, fg, bg] of TEXT_PAIRS) {
    const bgC = resolve(bg, parseColour(tokens['--paper'], tokens));
    const fgC = resolve(fg, bgC);
    rows.push({ label, ratio: ratio(fgC, bgC) });
  }
  for (const a of accentValues) {
    const paper = parseColour(tokens['--paper'], tokens);
    const surface = parseColour(tokens['--surface'], tokens);
    const main = parseColour(a.main, tokens);
    const deep = parseColour(a.deep, tokens);
    rows.push({ label: `${a.id}: on-accent on accent`, ratio: ratio(parseColour(tokens['--on-accent'], tokens), main) });
    rows.push({ label: `${a.id}: accent-deep on paper`, ratio: ratio(deep, paper) });
    rows.push({ label: `${a.id}: accent-deep on surface`, ratio: ratio(deep, surface) });
    rows.push({ label: `${a.id}: accent on paper`, ratio: ratio(main, paper) });
  }
  return Object.fromEntries(rows.map((r) => [r.label, r.ratio]));
}

const lightAccents = accents;
const darkAccents = accents.map((a) => ({ ...a, deep: `color-mix(in srgb, ${a.main} 72%, white)` }));

const L = evaluate('light', light, lightAccents);
const D = evaluate('dark', dark, darkAccents);

// Each pair is judged against the WCAG threshold that applies to how it is used: 4.5:1 for text
// (1.4.3), 3:1 for an icon or control drawn on a filled shape (1.4.11 non-text contrast). The only
// white-on-accent and white-on-danger uses are icon buttons, so they are UI pairs. A pair regresses
// when light passes its threshold and dark does not; a drop that stays above the threshold
// (17:1 → 15:1) is not a legibility change and is reported, not failed.
const UI_PAIRS = /on-accent on (accent|danger)$/;
const threshold = (label) => (UI_PAIRS.test(label) ? 3 : 4.5);
let regressions = 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('pair', 34)} ${pad('light', 8)} ${pad('dark', 8)} verdict`);
console.log('-'.repeat(70));
for (const label of Object.keys(L)) {
  const l = L[label];
  const d = D[label];
  const t = threshold(label);
  const lightOk = l >= t;
  const darkOk = d >= t;
  let verdict = `${lightOk ? 'pass' : 'FAIL'} → ${darkOk ? 'pass' : 'FAIL'} @ ${t}:1`;
  if (lightOk && !darkOk) {
    verdict += '  ⚠ REGRESSION';
    regressions += 1;
  } else if (!lightOk && !EXEMPT_FROM_AA.has(label)) {
    verdict += '  ⚠ light fails and is not an exemption';
    regressions += 1;
  } else if (!lightOk) {
    verdict += darkOk ? '  (exempt: pre-existing; dark passes)' : '  (exempt: pre-existing)';
  }
  console.log(`${pad(label, 34)} ${pad(l.toFixed(2), 8)} ${pad(d.toFixed(2), 8)} ${verdict}`);
}
console.log('-'.repeat(70));
if (regressions > 0) {
  console.log(`${regressions} regression(s) / unexempted failure(s).`);
  process.exit(1);
}
console.log('No regressions: every pair that passes in light also passes in dark.');
