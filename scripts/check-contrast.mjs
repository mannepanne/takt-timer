// ABOUT: WCAG contrast report for the light and dark token palettes in src/styles.css.
// ABOUT: Every listed pair must pass in both appearances — 4.5:1 for text, 3:1 for an icon or
// ABOUT: control on a filled shape — and no pair may pass in light yet fail in dark.
//
// Run: pnpm contrast:check   (exit 1 on any failure; the table is the PR artefact)
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

// Accent palette: `main`, the hand-authored light `deep` and `soft` come from accents.ts. The dark
// `deep` and `soft` are the values the theme resolver (applyAccentCss()) is contracted to write
// inline — color-mix(in srgb, main 72%, white) and color-mix(in srgb, main 24%, transparent) — so
// the dark columns check that contract, not the DOM.
const accents = [
  ...accentsTs.matchAll(
    /id: '(\w+)', main: '(#[0-9a-f]{6})', deep: '(#[0-9a-f]{6})', soft: '(rgba\([^)]*\))'/g,
  ),
].map(([, id, main, deep, soft]) => ({ id, main, deep, soft }));
if (accents.length !== 6) throw new Error(`expected 6 accents in accents.ts, found ${accents.length}`);

// ── Colour maths ──────────────────────────────────────────────────────────────

function parseColour(value, tokens) {
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return parseColour(tokens[ref[1]], tokens);
  if (v === 'white') return [255, 255, 255, 1];
  if (v === 'black') return [0, 0, 0, 1];
  if (v === 'transparent') return [0, 0, 0, 0];
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], rgba[4] === undefined ? 1 : +rgba[4]];
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+?)\)$/);
  if (mix) {
    // Premultiplied interpolation, as the spec defines for srgb — so mixing with `transparent`
    // keeps the colour and scales the alpha.
    const a = parseColour(mix[1], tokens);
    const b = parseColour(mix[3], tokens);
    const p = +mix[2] / 100;
    const alpha = a[3] * p + b[3] * (1 - p);
    if (alpha === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (a[i] * a[3] * p + b[i] * b[3] * (1 - p)) / alpha).concat([alpha]);
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
// [label, foreground, background, kind]. kind: 'text' → 4.5:1 (WCAG 1.4.3);
// 'ui' → 3:1 (1.4.11, an icon or control on a filled shape).

const TOKEN_PAIRS = [
  ['ink on paper', '--ink', '--paper', 'text'],
  ['ink on paper-2', '--ink', '--paper-2', 'text'],
  ['ink on surface', '--ink', '--surface', 'text'],
  ['ink-2 on paper', '--ink-2', '--paper', 'text'],
  ['ink-2 on surface', '--ink-2', '--surface', 'text'],
  ['ink-3 on paper', '--ink-3', '--paper', 'text'],
  ['ink-3 on paper-2', '--ink-3', '--paper-2', 'text'],
  ['ink-3 on surface', '--ink-3', '--surface', 'text'],
  ['mute on paper', '--mute', '--paper', 'text'],
  ['mute on paper-2', '--mute', '--paper-2', 'text'],
  ['mute on surface', '--mute', '--surface', 'text'],
  ['on-fill on fill', '--on-fill', '--fill', 'text'],
  ['danger on paper', '--danger', '--paper', 'text'],
  ['danger icon on paper-2', '--danger', '--paper-2', 'ui'],
  ['on-accent on danger', '--on-accent', '--danger', 'ui'],
  ['on-accent on danger-deep', '--on-accent', '--danger-deep', 'ui'],
];

// Per-accent pairs. accent-deep is text on paper (labels, links), on paper-2 (the rest-phase
// label), on surface (the pinned star) and on accent-soft (the active stepper pill, the rest cue
// chip); on-accent is an icon on the accent-filled mic button.
const ACCENT_PAIRS = (a) => [
  [`${a.id}: on-accent on accent`, '--on-accent', a.main, 'ui'],
  [`${a.id}: accent-deep on paper`, a.deep, '--paper', 'text'],
  [`${a.id}: accent-deep on paper-2`, a.deep, '--paper-2', 'text'],
  [`${a.id}: accent-deep on surface`, a.deep, '--surface', 'text'],
  [`${a.id}: accent-deep on accent-soft`, a.deep, a.soft, 'text'],
];

// ── Report ────────────────────────────────────────────────────────────────────

function evaluate(tokens, accentValues) {
  const paper = parseColour(tokens['--paper'], tokens);
  const resolveOn = (name, base) => {
    const c = parseColour(name.startsWith('--') ? tokens[name] : name, tokens);
    return c[3] < 1 ? over(c, base) : c;
  };
  const rows = {};
  const pairs = [...TOKEN_PAIRS, ...accentValues.flatMap(ACCENT_PAIRS)];
  for (const [label, fg, bg, kind] of pairs) {
    const bgC = resolveOn(bg, paper);
    const fgC = resolveOn(fg, bgC);
    rows[label] = { ratio: ratio(fgC, bgC), threshold: kind === 'ui' ? 3 : 4.5 };
  }
  return rows;
}

const darkAccents = accents.map((a) => ({
  ...a,
  deep: `color-mix(in srgb, ${a.main} 72%, white)`,
  soft: `color-mix(in srgb, ${a.main} 24%, transparent)`,
}));

const L = evaluate(light, accents);
const D = evaluate(dark, darkAccents);

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('pair', 36)} ${pad('light', 8)} ${pad('dark', 8)} verdict`);
console.log('-'.repeat(72));
for (const label of Object.keys(L)) {
  const { ratio: l, threshold: t } = L[label];
  const d = D[label].ratio;
  const lightOk = l >= t;
  const darkOk = d >= t;
  let verdict = `${lightOk ? 'pass' : 'FAIL'} → ${darkOk ? 'pass' : 'FAIL'} @ ${t}:1`;
  if (!lightOk || !darkOk) {
    verdict += lightOk ? '  ⚠ REGRESSION' : '  ⚠ below threshold';
    failures += 1;
  }
  console.log(`${pad(label, 36)} ${pad(l.toFixed(2), 8)} ${pad(d.toFixed(2), 8)} ${verdict}`);
}
console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} pair(s) below threshold.`);
  process.exit(1);
}
console.log('All pairs pass in both appearances.');
