import { describe, expect, it } from 'vitest';

import { CANONICAL_ALL, CANONICAL_EN, CANONICAL_SV, NONSENSE, PARAPHRASES } from './corpus';
import { parseSession } from './parse-session';

describe('parseSession — canonical corpus', () => {
  for (const entry of CANONICAL_ALL) {
    it(`[${entry.id}] "${entry.text}"`, () => {
      const result = parseSession(entry.text);
      expect(result.sets).toBe(entry.expected.sets);
      expect(result.workSec).toBe(entry.expected.workSec);
      expect(result.restSec).toBe(entry.expected.restSec);
      expect(result.confidence).toBe('high');
    });
  }
});

describe('parseSession — paraphrases', () => {
  // Paraphrases may not all pass deterministically; track coverage.
  for (const entry of PARAPHRASES) {
    it(`[${entry.id}] parses or falls through to confidence < 'high'`, () => {
      const result = parseSession(entry.text);
      const matchesExpected =
        result.sets === entry.expected.sets &&
        result.workSec === entry.expected.workSec &&
        result.restSec === entry.expected.restSec;
      // Accept either an exact match (parser handles this paraphrase) or a downgrade in
      // confidence signalling Llama fallback is appropriate.
      expect(matchesExpected || result.confidence !== 'high').toBe(true);
    });
  }
});

describe('parseSession — nonsense input', () => {
  for (const entry of NONSENSE) {
    it(`[${entry.id}] returns confidence: 'none'`, () => {
      const result = parseSession(entry.text);
      expect(result.confidence).toBe('none');
    });
  }
});

describe('parseSession — language coverage', () => {
  it('all English canonical phrases parse with high confidence', () => {
    const misses = CANONICAL_EN.filter((entry) => {
      const r = parseSession(entry.text);
      return (
        r.sets !== entry.expected.sets ||
        r.workSec !== entry.expected.workSec ||
        r.restSec !== entry.expected.restSec ||
        r.confidence !== 'high'
      );
    });
    expect(misses.map((m) => m.id)).toEqual([]);
  });

  it('all Swedish canonical phrases parse with high confidence', () => {
    const misses = CANONICAL_SV.filter((entry) => {
      const r = parseSession(entry.text);
      return (
        r.sets !== entry.expected.sets ||
        r.workSec !== entry.expected.workSec ||
        r.restSec !== entry.expected.restSec ||
        r.confidence !== 'high'
      );
    });
    expect(misses.map((m) => m.id)).toEqual([]);
  });
});

describe('parseSession — edge cases', () => {
  it('clamps sets to ≤99', () => {
    const r = parseSession('1000 sets of 60 seconds');
    expect(r.sets).toBeLessThanOrEqual(99);
  });

  it('clamps workSec to [5, 3600]', () => {
    const r = parseSession('3 sets of 99999 seconds');
    expect(r.workSec).toBeLessThanOrEqual(3600);
  });

  it('returns confidence: none on empty string', () => {
    expect(parseSession('').confidence).toBe('none');
  });

  it('handles bare digit + unit without sets clause', () => {
    const r = parseSession('45 seconds of work');
    expect(r.workSec).toBe(45);
    // No sets, so confidence is 'low' (work-only).
    expect(r.confidence).toBe('low');
  });

  it('handles mm:ss format', () => {
    const r = parseSession('3 sets of 1:30 work, 30 second rest');
    expect(r.workSec).toBe(90);
  });
});
