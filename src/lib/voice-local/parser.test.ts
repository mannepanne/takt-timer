// ABOUT: Tests for the on-device English intent parser.
// ABOUT: Drives the pinned phrase corpus plus targeted edge cases for the rejection paths.

import { describe, it, expect } from 'vitest';
import { parseIntent } from './parser';
import { PHRASE_CORPUS } from './fixtures/phrase-corpus';

describe('parseIntent — phrase corpus', () => {
  for (const entry of PHRASE_CORPUS) {
    const label = entry.transcript === '' ? '(empty string)' : entry.transcript;
    it(`${entry.kind}: "${label}"${entry.note ? ` — ${entry.note}` : ''}`, () => {
      const result = parseIntent(entry.transcript);
      if (entry.kind === 'ok') {
        expect(result).toEqual({ ok: true, session: entry.session });
      } else {
        // Both 'near-miss' and 'no-parse' fall back; the split is a corpus-level
        // classification (see phrase-corpus.ts). We assert ok=false and the reason.
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe(entry.reason);
      }
    });
  }
});

describe('parseIntent — confidence contract', () => {
  it('treats explicit "no rest" as a confident zero, not a missing field', () => {
    expect(parseIntent('four sets of thirty seconds no rest')).toEqual({
      ok: true,
      session: { sets: 4, workSec: 30, restSec: 0 },
    });
  });

  it('does not infer rest from a leftover unmarked duration', () => {
    // "45 seconds" after the work value is unmarked — must NOT become rest.
    const result = parseIntent('three sets of one minute 45 seconds');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-rest');
  });

  it('lets rest win when a duration carries both work and rest markers', () => {
    // "for thirty seconds rest" — "for" (work) and "rest" both touch the duration.
    const result = parseIntent('five sets of two minutes for thirty seconds rest');
    expect(result).toEqual({ ok: true, session: { sets: 5, workSec: 120, restSec: 30 } });
  });
});

describe('parseIntent — number handling', () => {
  it('reads compound tens+unit number words', () => {
    expect(parseIntent('three sets of forty five seconds, ten seconds rest')).toEqual({
      ok: true,
      session: { sets: 3, workSec: 45, restSec: 10 },
    });
  });

  it('reads "a"/"an" as one when a unit follows', () => {
    expect(parseIntent('two sets of a minute, thirty seconds rest')).toEqual({
      ok: true,
      session: { sets: 2, workSec: 60, restSec: 30 },
    });
  });

  it('merges minute+second only when joined by "and"', () => {
    expect(parseIntent('two sets of one minute and thirty seconds, ten seconds rest')).toEqual({
      ok: true,
      session: { sets: 2, workSec: 90, restSec: 10 },
    });
  });

  it('parses mm:ss durations', () => {
    expect(parseIntent('four sets of 2:00 with 0:45 rest')).toEqual({
      ok: true,
      session: { sets: 4, workSec: 120, restSec: 45 },
    });
  });
});

describe('parseIntent — tokeniser does not out-guess the grammar', () => {
  it('refuses a decimal number rather than mis-binding it', () => {
    // "2.5 minutes" must NOT become 5 minutes (300s) — the leading digit would be dropped.
    expect(parseIntent('three sets of 2.5 minutes, thirty seconds rest')).toEqual({
      ok: false,
      reason: 'unparseable',
    });
  });

  it('refuses a thousands-separated number', () => {
    expect(parseIntent('three sets of 1,500 seconds, thirty seconds rest')).toEqual({
      ok: false,
      reason: 'unparseable',
    });
  });

  it('does not let "a" extend a tens word into a compound', () => {
    // "twenty a seconds" must NOT read as 21 seconds; the article does not continue a compound.
    const result = parseIntent('four sets of twenty a seconds, ten seconds rest');
    if (result.ok) expect(result.session.workSec).not.toBe(21);
  });

  it('rejects an out-of-range mm:ss seconds component', () => {
    // "2:75" is not a real duration; work becomes unknown → fall back.
    const result = parseIntent('four sets of 2:75 with thirty seconds rest');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-work');
  });
});

describe('parseIntent — scope guard', () => {
  it('does NOT treat "reps" as a set count (that is Timer mode territory)', () => {
    // "ten reps" must not become a confident interval; sets stays unknown.
    const result = parseIntent('ten reps of thirty seconds, ten seconds rest');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-sets');
  });
});

describe('parseIntent — rest marker phrasings', () => {
  const cases: Array<[string, number]> = [
    ['four sets of two minutes rest of thirty seconds', 30], // "rest of X" attaches forward
    ['three sets of one minute with thirty seconds of rest', 30], // "X of rest"
    ['three sets of one minute, thirty seconds between', 30], // "between" after
    ['three sets of one minute thirty seconds in between', 30], // "in between" after
  ];
  for (const [transcript, restSec] of cases) {
    it(`recognises rest in: "${transcript}"`, () => {
      const result = parseIntent(transcript);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.session.restSec).toBe(restSec);
    });
  }

  it('falls back when "rest"/"break" sits ambiguously between two durations', () => {
    // "one minute rest thirty seconds" — cannot tell which duration "rest" binds to,
    // so we do not guess. (This still exercises the before-duration rest/break markers.)
    for (const t of [
      'three sets of one minute rest thirty seconds',
      'three sets of one minute break thirty seconds',
    ]) {
      expect(parseIntent(t).ok).toBe(false);
    }
  });
});

describe('parseIntent — "and" that does not complete a compound', () => {
  it('ignores a trailing "and <number>" with no unit', () => {
    // "one minute and five" — "five" has no unit, so it must not merge into work.
    expect(parseIntent('two sets of one minute and five, ten seconds rest')).toEqual({
      ok: true,
      session: { sets: 2, workSec: 60, restSec: 10 },
    });
  });
});

describe('parseIntent — range guards', () => {
  it('rejects a set count above the ceiling', () => {
    const result = parseIntent('150 sets of 30 seconds, 10 seconds rest');
    expect(result).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('rejects a work duration above the ceiling', () => {
    const result = parseIntent('three sets of 70 minutes, 30 seconds rest');
    expect(result).toEqual({ ok: false, reason: 'out-of-range' });
  });

  it('accepts a zero-set edge as out-of-range, not a valid session', () => {
    const result = parseIntent('zero sets of 30 seconds, 10 seconds rest');
    expect(result).toEqual({ ok: false, reason: 'out-of-range' });
  });
});

describe('parseIntent — no-parse classification', () => {
  it('reports empty on whitespace-only input', () => {
    expect(parseIntent('    ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('reports no-numbers when nothing numeric is present', () => {
    expect(parseIntent('please start my workout now')).toEqual({
      ok: false,
      reason: 'no-numbers',
    });
  });

  it('reports unparseable when a number word appears but no structure forms', () => {
    expect(parseIntent('thirty something or other')).toEqual({
      ok: false,
      reason: 'unparseable',
    });
  });

  it('does not count the article "a" as a number for classification', () => {
    // Only "a" is numeric-ish here; it must fall to no-numbers, not unparseable.
    expect(parseIntent('have a go')).toEqual({ ok: false, reason: 'no-numbers' });
  });
});
