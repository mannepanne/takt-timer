// ABOUT: Lint-style guard over src/styles.css — keeps every colour behind a design token so the
// ABOUT: dark theme cannot silently rot, and catches tokens referenced but never defined.

import { describe, expect, it } from 'vitest';

// `?raw` hands over the stylesheet source untouched (typed as string by vite/client), so the test
// inspects exactly what ships rather than a processed copy — and needs no Node fs types under src/.
import css from './styles.css?raw';

// Selectors allowed to carry literal colours. Everything else must go through var(--…).
//  - the two token blocks are where literals belong;
//  - body / .app-shell paint the desktop canvas outside the phone frame, dark in both themes;
//  - .noscript-fallback is a standalone JS-off splash, deliberately independent of runtime theming.
const LITERAL_ALLOWED = new Set([
  ':root',
  ":root[data-theme='dark']",
  'html, body',
  '.app-shell',
  '.noscript-fallback',
  '.noscript-fallback-title',
  '.noscript-fallback-text',
]);

// Hex, functional and the named colours that show up in practice. `transparent` and `currentColor`
// are not leaks — they defer to a token somewhere else — so they are deliberately not matched.
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])(?:white|black)(?![\w-])/;

type Decl = { line: number; selector: string; text: string };

// A declaration starts with a property name and a colon ("--paper: …", "-webkit-x: …",
// "box-shadow:"); a selector never does (".chip:hover {", "::after,").
const DECL_START = /^-{0,2}[a-z][\w-]*\s*:/i;

/** Walk a stylesheet line by line, attributing each declaration (and its continuation lines,
 *  e.g. a multi-line box-shadow list) to its enclosing selector. Single-line rules
 *  (".x { color: red; }") are split into their declarations too, so a hand-edit that dodges
 *  prettier's formatting cannot dodge the check. */
function declarations(source: string): Decl[] {
  const out: Decl[] = [];
  const stack: string[] = [];
  let pending = '';
  let inDecl = false;
  const lines = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const top = stack[stack.length - 1] ?? '(top level)';
    if (inDecl) {
      out.push({ line: i + 1, selector: top, text: line });
      if (line.endsWith(';')) inDecl = false;
      return;
    }
    const oneLiner = line.match(/^(.*?)\{(.*)\}$/);
    if (oneLiner) {
      const selector = `${pending} ${oneLiner[1]}`.replace(/\s+/g, ' ').trim();
      pending = '';
      for (const decl of oneLiner[2].split(';')) {
        if (decl.trim()) out.push({ line: i + 1, selector, text: decl.trim() });
      }
      return;
    }
    if (line.endsWith('{')) {
      stack.push(`${pending} ${line.slice(0, -1)}`.replace(/\s+/g, ' ').trim());
      pending = '';
      return;
    }
    if (line === '}') {
      stack.pop();
      return;
    }
    if (stack.length > 0 && DECL_START.test(line)) {
      out.push({ line: i + 1, selector: top, text: line });
      inDecl = !line.endsWith(';');
      return;
    }
    // A multi-line selector list ("html,\nbody {") accumulates until its brace.
    pending = `${pending} ${line}`;
  });
  return out;
}

function literalViolations(source: string): string[] {
  return declarations(source)
    .filter((d) => COLOUR_LITERAL.test(d.text) && !LITERAL_ALLOWED.has(d.selector))
    .map((d) => `line ${d.line} (${d.selector}): ${d.text}`);
}

describe('the colour-literal parser itself', () => {
  it('attributes a multi-line declaration list to its selector', () => {
    const src = `.a {\n  box-shadow:\n    0 1px 2px rgba(0, 0, 0, 0.1),\n    0 2px 4px #000;\n}\n`;
    expect(literalViolations(src)).toEqual([
      'line 3 (.a): 0 1px 2px rgba(0, 0, 0, 0.1),',
      'line 4 (.a): 0 2px 4px #000;',
    ]);
  });

  it('catches a single-line rule', () => {
    expect(literalViolations('.a { color: #fff; }\n')).toEqual(['line 1 (.a): color: #fff']);
  });

  it('catches named colours', () => {
    expect(literalViolations('.a {\n  color: white;\n}\n')).toEqual(['line 2 (.a): color: white;']);
    expect(literalViolations('.a {\n  color: transparent;\n}\n')).toEqual([]);
  });

  it('does not mistake a pseudo-selector line for a declaration', () => {
    const src = `@media (x) {\n  .a::after,\n  .b {\n    color: #fff;\n  }\n}\n`;
    expect(literalViolations(src)).toEqual(['line 4 (.a::after, .b): color: #fff;']);
  });

  it('lets an allow-listed selector carry literals', () => {
    expect(literalViolations(':root {\n  --x: #fff;\n}\n')).toEqual([]);
  });
});

function tokenBlock(selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`token block not found: ${selector}`);
  const tokens = new Map<string, string>();
  for (const m of match[1].matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) tokens.set(m[1], m[2].trim());
  return tokens;
}

describe('styles.css colour discipline', () => {
  it('has no colour literal outside the token blocks and the allow-listed selectors', () => {
    const violations = literalViolations(css);
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('defines every custom property it references in :root', () => {
    const light = tokenBlock(':root');
    // Set at runtime, not in the stylesheet: the accent swatch colour comes from AccentPicker.
    const runtimeDefined = new Set(['--swatch-color']);
    const missing = new Set<string>();
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!light.has(m[1]) && !runtimeDefined.has(m[1])) missing.add(m[1]);
    }
    expect([...missing]).toEqual([]);
  });

  it('only overrides tokens in the dark block that :root already defines', () => {
    const light = tokenBlock(':root');
    const dark = tokenBlock(":root[data-theme='dark']");
    const orphans = [...dark.keys()].filter((k) => !light.has(k));
    expect(orphans).toEqual([]);
  });

  it('never leaves a var() fallback in place — fallbacks hide undefined tokens', () => {
    const fallbacks = [...css.matchAll(/var\(\s*--[\w-]+\s*,/g)].map((m) => m[0]);
    expect(fallbacks).toEqual([]);
  });
});
