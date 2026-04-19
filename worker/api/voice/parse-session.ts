// ABOUT: Deterministic parser for voice-transcribed session commands.
// ABOUT: TypeScript port of SPECIFICATIONS/prototype-design-files/voice.js
// ABOUT: extended with Swedish word-numerals and unit lexicon.

export type ParsedSession = {
  sets: number;
  workSec: number;
  restSec: number;
  /** 'high' = all three fields resolved from text; 'low' = inferred from partial; 'none' = could not resolve. */
  confidence: 'high' | 'low' | 'none';
};

const WORD_NUM: Record<string, number> = {
  // English 0–20
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
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  a: 1,
  an: 1,
  half: 0.5, // "half a minute" → 30s

  // Swedish 0–20
  noll: 0,
  ett: 1,
  en: 1,
  två: 2,
  tre: 3,
  fyra: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  åtta: 8,
  atta: 8, // ascii fallback
  nio: 9,
  tio: 10,
  elva: 11,
  tolv: 12,
  tretton: 13,
  fjorton: 14,
  femton: 15,
  sexton: 16,
  sjutton: 17,
  arton: 18,
  aderton: 18,
  nitton: 19,
  tjugo: 20,
  trettio: 30,
  fyrtio: 40,
  femtio: 50,
  sextio: 60,
  sjuttio: 70,
  åttio: 80,
  attio: 80, // ascii fallback
  nittio: 90,
};

/** Detect the kind of unit at token index; null if not a unit token. */
function unitAt(tokens: readonly string[], i: number): 'sec' | 'min' | 'hr' | null {
  const t = tokens[i]?.toLowerCase();
  if (!t) return null;
  // seconds: English sec/second(s), Swedish sek(und/under) with optional Swedish genitive -s
  if (/^sec(ond)?s?$|^s$|^sek(und(er|s|ers)?)?s?$/.test(t)) return 'sec';
  // minutes: English min/minute(s), Swedish minut(er) with optional Swedish genitive -s
  if (/^min(ute)?s?$|^minut(er|s|ers)?$/.test(t)) return 'min';
  // hours: English hr/hour(s), Swedish timm(ar) / h
  if (/^hrs?$|^hour(s)?$|^h$|^timm(ar)?$|^timme$/.test(t)) return 'hr';
  return null;
}

/** Parse a numeric token — digit, word-numeral (en or sv), or NaN. */
function parseNumber(tok: string | undefined): number {
  if (tok == null) return NaN;
  const n = Number.parseInt(tok, 10);
  if (!Number.isNaN(n)) return n;
  const word = WORD_NUM[tok.toLowerCase()];
  return word ?? NaN;
}

type Duration = { seconds: number; next: number };

/** Parse a duration clause starting at tokens[i]. Returns NaN seconds if no duration found. */
function parseDurationAt(tokens: readonly string[], i: number): Duration {
  const tok = tokens[i];
  if (!tok) return { seconds: NaN, next: i };

  // mm:ss — "1:30"
  if (/^\d+:\d+$/.test(tok)) {
    const [m, s] = tok.split(':').map(Number);
    return { seconds: m * 60 + s, next: i + 1 };
  }

  const n = parseNumber(tok);
  if (Number.isNaN(n)) return { seconds: NaN, next: i };

  let j = i + 1;
  let seconds = 0;

  const unit = unitAt(tokens, j);
  if (!unit) return { seconds: NaN, next: i };

  j++;
  if (unit === 'min') seconds += n * 60;
  else if (unit === 'sec') seconds += n;
  else if (unit === 'hr') seconds += n * 3600;

  // Compound durations — only when an explicit "and"/"och" connects them.
  // "one minute AND thirty seconds" is a compound; "20 seconds, 10 seconds" is two
  // separate durations (comma stripping removed the separator but the tokens are
  // grammatically distinct — the caller iterates multiple durations).
  if (['and', 'och'].includes(tokens[j]?.toLowerCase() ?? '')) {
    j++;
    const m = parseNumber(tokens[j]);
    if (!Number.isNaN(m)) {
      const u2 = unitAt(tokens, j + 1);
      if (u2 && u2 !== unit) {
        if (u2 === 'sec') seconds += m;
        else if (u2 === 'min') seconds += m * 60;
        j += 2;
      }
    }
  }

  return { seconds, next: j };
}

const SET_WORDS = /^sets?$|^rounds?$|^reps?$|^omgång(ar)?$|^omgangar?$/;
const REST_WORDS = /^rest$|^break$|^off$|^vila$|^paus$/;

/** Strip punctuation, collapse whitespace, lower-case. */
function tokenise(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[,.?!—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter(Boolean);
}

/**
 * Parse a session command. Returns `{ sets, workSec, restSec, confidence }`.
 * Callers should invoke Llama fallback when `confidence === 'none'`.
 */
export function parseSession(text: string): ParsedSession {
  const tokens = tokenise(text);

  let sets: number | null = null;
  let work: number | null = null;
  let rest: number | null = null;

  // Sets: look for "<n> sets|rounds|reps|omgångar"
  for (let i = 0; i < tokens.length - 1; i++) {
    if (SET_WORDS.test(tokens[i + 1])) {
      const n = parseNumber(tokens[i]);
      if (!Number.isNaN(n) && n >= 1 && n <= 99) {
        sets = Math.floor(n);
        break;
      }
    }
  }

  // Work duration: prefer after "of" / "for" / "om" (SV "om" = "of")
  const workPrepositions = new Set(['of', 'for', 'om']);
  for (let i = 0; i < tokens.length; i++) {
    if (workPrepositions.has(tokens[i])) {
      const r = parseDurationAt(tokens, i + 1);
      if (!Number.isNaN(r.seconds)) {
        work = r.seconds;
        break;
      }
    }
  }
  // Fallback: first non-rest duration in the string.
  if (work == null) {
    for (let i = 0; i < tokens.length; i++) {
      const r = parseDurationAt(tokens, i);
      if (!Number.isNaN(r.seconds)) {
        work = r.seconds;
        break;
      }
    }
  }

  // Rest duration: look for a duration near a rest word. Prefer durations to the LEFT
  // of the rest word ("30 seconds rest"), fall back to the RIGHT ("rest for 30 seconds").
  for (let i = 0; i < tokens.length; i++) {
    if (!REST_WORDS.test(tokens[i])) continue;
    // Left side first.
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const r = parseDurationAt(tokens, j);
      if (!Number.isNaN(r.seconds)) {
        rest = r.seconds;
        break;
      }
    }
    // Right side fallback.
    if (rest == null) {
      for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
        const r = parseDurationAt(tokens, j);
        if (!Number.isNaN(r.seconds)) {
          rest = r.seconds;
          break;
        }
      }
    }
    if (rest != null) break;
  }

  // Confidence scoring.
  // High: sets AND work both explicitly found. Rest may default to 0 (a valid session).
  // Low: one of sets / work found, the other inferred from a sensible default.
  // None: neither sets nor work could be resolved.
  const haveSets = sets != null;
  const haveWork = work != null;

  let confidence: ParsedSession['confidence'];
  if (haveSets && haveWork) {
    confidence = 'high';
  } else if (haveSets || haveWork) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }

  // Clamp to phase-2 Stepper bounds. Parser should never emit out-of-bounds values.
  const clampedSets = Math.max(1, Math.min(99, sets ?? 3));
  const clampedWork = Math.max(5, Math.min(3600, work ?? 60));
  const clampedRest = Math.max(0, Math.min(3600, rest ?? 0));

  return {
    sets: clampedSets,
    workSec: clampedWork,
    restSec: clampedRest,
    confidence,
  };
}
