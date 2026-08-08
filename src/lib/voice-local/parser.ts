// ABOUT: On-device English intent parser — turns a speech transcript into a ParsedSession.
// ABOUT: Closed-grammar, conservative: only reports a confident parse when sets, work and rest
// ABOUT: are all present; anything missing or ambiguous falls back to manual entry (never a guess).

import type { ParsedSession } from '@/lib/voice/types';

// Why a discriminated result rather than always returning a session (as the rejected
// prototype did): on native the parse result feeds the Configure screen, which is a
// confirmation step — a confident-looking *wrong* pre-fill is more dangerous than no
// pre-fill, because it gets tapped through. So we only claim `ok` when we are sure.
export type ParseFailureReason =
  | 'empty' // nothing but whitespace
  | 'no-numbers' // no digits or number words at all
  | 'unparseable' // a number word appeared but no usable structure formed
  | 'no-sets' // set count missing
  | 'no-work' // work duration missing
  | 'no-rest' // rest duration missing (and no explicit "no rest")
  | 'out-of-range'; // a field parsed but sits outside sane bounds

export type ParseResult =
  | { ok: true; session: ParsedSession }
  | { ok: false; reason: ParseFailureReason };

// Sane bounds. Deliberately generous — the goal is to reject nonsense (a mis-heard
// "200 sets"), not to police what a real session may contain.
const MAX_SETS = 99;
const MAX_DURATION_SEC = 3600;

// Number words. 'a'/'an' count as 1 *for reading a value* (so "a minute" is 60), but
// are excluded from STRICT_NUMBER_WORDS below, which decides whether a transcript
// contained a real number at all (an article shouldn't make "start a workout" look numeric).
const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  a: 1,
  an: 1,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const STRICT_NUMBER_WORDS = new Set([
  ...Object.keys(ONES).filter((w) => w !== 'a' && w !== 'an'),
  ...Object.keys(TENS),
]);

type Unit = 'min' | 'sec';

function unitAt(tok: string | undefined): Unit | null {
  if (!tok) return null;
  if (/^min(ute)?s?$/.test(tok)) return 'min';
  if (/^sec(ond)?s?$/.test(tok)) return 'sec';
  return null;
}

// Reads a (possibly compound, e.g. "forty five") number starting at index i.
function readNumberAt(tokens: string[], i: number): { value: number; next: number } | null {
  const t = tokens[i];
  if (t == null) return null;
  if (/^\d+$/.test(t)) return { value: parseInt(t, 10), next: i + 1 };
  if (t in TENS) {
    let value = TENS[t];
    const unit = tokens[i + 1];
    if (unit != null && unit in ONES && ONES[unit] >= 1 && ONES[unit] <= 9) {
      value += ONES[unit];
      return { value, next: i + 2 };
    }
    return { value, next: i + 1 };
  }
  if (t in ONES) return { value: ONES[t], next: i + 1 };
  return null;
}

type Duration = { seconds: number; start: number; end: number };

// Parses a duration at index i: `mm:ss`, or a number + unit, optionally extended by
// "and" + number + unit ("one minute and thirty seconds"). Requires an explicit unit
// (or mm:ss) — a bare number is never treated as a duration, to avoid silent guessing.
function parseDurationAt(tokens: string[], i: number): Duration | null {
  const t = tokens[i];
  if (t == null) return null;

  if (/^\d{1,2}:\d{1,2}$/.test(t)) {
    const [m, s] = t.split(':').map(Number);
    return { seconds: m * 60 + s, start: i, end: i + 1 };
  }

  const num = readNumberAt(tokens, i);
  if (!num) return null;
  const unit = unitAt(tokens[num.next]);
  if (!unit) return null;

  let seconds = unit === 'min' ? num.value * 60 : num.value;
  let end = num.next + 1;

  // Only merge a second component when joined by "and" — otherwise "one minute thirty
  // seconds rest" would greedily swallow the rest value into the work duration.
  if (tokens[end] === 'and') {
    const num2 = readNumberAt(tokens, end + 1);
    if (num2) {
      const unit2 = unitAt(tokens[num2.next]);
      if (unit2) {
        seconds += unit2 === 'min' ? num2.value * 60 : num2.value;
        end = num2.next + 1;
      }
    }
  }

  return { seconds, start: i, end };
}

function normalise(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^a-z0-9:\s]/g, ' ') // strip punctuation, keep digits/letters/colon
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function findSets(tokens: string[]): number | undefined {
  for (let k = 0; k < tokens.length; k++) {
    const num = readNumberAt(tokens, k);
    // Deliberately NOT matching "rep"/"reps": rep-based work is Timer mode's job
    // (the count-up stopwatch), explicitly out of this parser's scope.
    if (num && /^(set|sets|round|rounds)$/.test(tokens[num.next] ?? '')) {
      return num.value;
    }
  }
  return undefined;
}

function collectDurations(tokens: string[]): Duration[] {
  const durations: Duration[] = [];
  let i = 0;
  while (i < tokens.length) {
    const d = parseDurationAt(tokens, i);
    if (d) {
      durations.push(d);
      i = d.end;
    } else {
      i++;
    }
  }
  return durations;
}

const WORK_MARKERS = new Set(['of', 'for', 'on', 'work']);

function isRestDuration(tokens: string[], d: Duration): boolean {
  const before1 = tokens[d.start - 1];
  const before2 = tokens[d.start - 2];
  const after1 = tokens[d.end];
  const after2 = tokens[d.end + 1];
  return (
    before1 === 'rest' ||
    before1 === 'break' ||
    before1 === 'between' ||
    (before1 === 'of' && before2 === 'rest') || // "rest of thirty seconds"
    // "X rest" attaches rest to this duration — but NOT "X rest of Y", where the
    // rest modifies the following duration (handled by the before1/before2 rule above).
    (after1 === 'rest' && after2 !== 'of') ||
    (after1 === 'break' && after2 !== 'of') ||
    after1 === 'off' ||
    after1 === 'between' ||
    (after1 === 'in' && after2 === 'between') ||
    (after1 === 'of' && after2 === 'rest')
  );
}

function isWorkDuration(tokens: string[], d: Duration): boolean {
  return (
    WORK_MARKERS.has(tokens[d.start - 1] ?? '') || ['on', 'work'].includes(tokens[d.end] ?? '')
  );
}

const NO_REST_RE = /\bno rest\b|\bwithout rest\b|\bno break\b|\bwithout a break\b|\bno breaks\b/;

export function parseIntent(transcript: string): ParseResult {
  if (!transcript.trim()) return { ok: false, reason: 'empty' };

  const tokens = normalise(transcript);
  const normalised = tokens.join(' ');

  const sets = findSets(tokens);
  const durations = collectDurations(tokens);

  // Rest wins over work when a duration carries both markers (e.g. "for thirty seconds rest").
  const restDur = durations.find((d) => isRestDuration(tokens, d));
  const workDur =
    durations.find((d) => d !== restDur && isWorkDuration(tokens, d)) ??
    durations.find((d) => d !== restDur && !isRestDuration(tokens, d));

  const explicitNoRest = NO_REST_RE.test(normalised);

  const workSec = workDur?.seconds;
  // Rest is only taken from an explicitly marked duration or an explicit "no rest" —
  // never inferred from a leftover unmarked number.
  const restSec = restDur ? restDur.seconds : explicitNoRest ? 0 : undefined;

  const found = [sets !== undefined, workSec !== undefined, restSec !== undefined].filter(
    Boolean,
  ).length;

  if (found === 3) {
    if (
      sets! < 1 ||
      sets! > MAX_SETS ||
      workSec! < 1 ||
      workSec! > MAX_DURATION_SEC ||
      restSec! < 0 ||
      restSec! > MAX_DURATION_SEC
    ) {
      return { ok: false, reason: 'out-of-range' };
    }
    return { ok: true, session: { sets: sets!, workSec: workSec!, restSec: restSec! } };
  }

  if (found === 0) {
    const hasNumber = tokens.some((t) => /^\d+$/.test(t) || STRICT_NUMBER_WORDS.has(t));
    return { ok: false, reason: hasNumber ? 'unparseable' : 'no-numbers' };
  }

  // 1–2 fields present: report the first missing one, in sets → work → rest order.
  if (sets === undefined) return { ok: false, reason: 'no-sets' };
  if (workSec === undefined) return { ok: false, reason: 'no-work' };
  return { ok: false, reason: 'no-rest' };
}
