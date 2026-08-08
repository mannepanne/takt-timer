// ABOUT: Pinned validation corpus for the on-device English intent parser.
// ABOUT: PROVISIONAL — author-authored phrasings, not yet validated against real ASR output.

import type { ParsedSession } from '@/lib/voice/types';
import type { ParseFailureReason } from '../parser';

// A corpus entry pins one transcript to its expected parse outcome.
//
// `kind` classifies the expected outcome so the tests — and any future product
// decision — can treat the classes differently:
//   - 'ok'        → a confident parse; assert the exact ParsedSession.
//   - 'near-miss' → recognisable structure but at least one of sets/work/rest
//                   missing or out of range; falls back to manual entry.
//   - 'no-parse'  → nothing usable; falls back to manual entry.
// Both fallback classes return `{ ok: false }`; the split is deliberate so that
// if the product later decides (say) a missing rest should default rather than
// fall back, that is a one-line rule change, not a corpus rewrite.
export type CorpusEntry =
  | { transcript: string; kind: 'ok'; session: ParsedSession; note?: string }
  | { transcript: string; kind: 'near-miss'; reason: ParseFailureReason; note?: string }
  | { transcript: string; kind: 'no-parse'; reason: ParseFailureReason; note?: string };

// NOTE ON PROVENANCE: every phrase below was written by hand while authoring the
// grammar, so it inevitably reflects what the grammar already handles. That makes
// this a test of the *grammar*, not of the *recogniser*. The 2026-04-20 spike
// failed on transcription variance, not phrasing variance — so the real
// acceptance bar (07f) is a second corpus of transcripts captured from the
// system recogniser on real hardware (Spike 3), appended here as
// `realDeviceTranscripts` when it exists. Do NOT tick 07f's "usable corpus"
// acceptance criterion off this provisional set.
export const PHRASE_CORPUS: CorpusEntry[] = [
  // ---- Confident parses (all three fields present) ----
  {
    transcript: 'three sets of one minute each, thirty seconds rest in between',
    kind: 'ok',
    session: { sets: 3, workSec: 60, restSec: 30 },
    note: 'canonical phrasing',
  },
  {
    transcript: 'five rounds of ninety seconds with thirty seconds rest',
    kind: 'ok',
    session: { sets: 5, workSec: 90, restSec: 30 },
  },
  {
    transcript: 'ten sets of thirty seconds work, fifteen seconds rest',
    kind: 'ok',
    session: { sets: 10, workSec: 30, restSec: 15 },
  },
  {
    transcript: 'four sets of two minutes, one minute rest',
    kind: 'ok',
    session: { sets: 4, workSec: 120, restSec: 60 },
  },
  {
    transcript: 'eight rounds of forty five seconds, fifteen seconds break',
    kind: 'ok',
    session: { sets: 8, workSec: 45, restSec: 15 },
    note: 'compound number word (forty five), "break" as rest synonym',
  },
  {
    transcript: 'three sets of 1:30 with 0:30 rest',
    kind: 'ok',
    session: { sets: 3, workSec: 90, restSec: 30 },
    note: 'mm:ss durations',
  },
  {
    transcript: '6 sets of 45 seconds, 20 seconds rest',
    kind: 'ok',
    session: { sets: 6, workSec: 45, restSec: 20 },
    note: 'digits instead of number words',
  },
  {
    transcript: '10 rounds of 45 sec with 15 sec rest',
    kind: 'ok',
    session: { sets: 10, workSec: 45, restSec: 15 },
    note: 'abbreviated units (sec)',
  },
  {
    transcript: '3 sets of 1 minute, 30 second rest',
    kind: 'ok',
    session: { sets: 3, workSec: 60, restSec: 30 },
    note: 'singular unit (second)',
  },
  {
    transcript: 'two sets of one minute and thirty seconds, thirty seconds rest',
    kind: 'ok',
    session: { sets: 2, workSec: 90, restSec: 30 },
    note: '"and" merges minute+second into a single work duration',
  },
  {
    transcript: 'twelve rounds of twenty seconds on, ten seconds off',
    kind: 'ok',
    session: { sets: 12, workSec: 20, restSec: 10 },
    note: 'on/off interval phrasing',
  },
  {
    transcript: 'four sets of ninety seconds forty five seconds rest',
    kind: 'ok',
    session: { sets: 4, workSec: 90, restSec: 45 },
    note: 'no punctuation at all',
  },
  {
    transcript: 'um okay, three sets of one minute, thirty seconds rest',
    kind: 'ok',
    session: { sets: 3, workSec: 60, restSec: 30 },
    note: 'leading filler',
  },
  {
    transcript: 'five sets of one minute with no rest',
    kind: 'ok',
    session: { sets: 5, workSec: 60, restSec: 0 },
    note: 'explicit "no rest" is a confident zero, not a missing field',
  },

  // ---- Near-misses (structure recognised, incomplete or out of range) ----
  {
    transcript: 'three sets of one minute',
    kind: 'near-miss',
    reason: 'no-rest',
    note: 'rest omitted — do not silently default it',
  },
  {
    transcript: '3 sets of 1 minute 30 seconds',
    kind: 'near-miss',
    reason: 'no-rest',
    note: 'without "and", minute and second are separate; the trailing 30s is unmarked so rest stays unknown',
  },
  {
    transcript: 'sets of two minutes with thirty seconds rest',
    kind: 'near-miss',
    reason: 'no-sets',
    note: 'set count missing',
  },
  {
    transcript: 'for sets of two minutes, thirty seconds rest',
    kind: 'near-miss',
    reason: 'no-sets',
    note: 'HOMOPHONE: "four" mis-transcribed as "for" — we do NOT map it to 4, we fall back safely',
  },
  {
    transcript: 'three sets, thirty seconds rest',
    kind: 'near-miss',
    reason: 'no-work',
    note: 'work duration missing',
  },
  {
    transcript: '200 sets of 30 seconds, 10 seconds rest',
    kind: 'near-miss',
    reason: 'out-of-range',
    note: 'set count above the sane ceiling',
  },
  {
    transcript: 'three sets of ninety minutes, thirty seconds rest',
    kind: 'near-miss',
    reason: 'out-of-range',
    note: 'work duration above the sane ceiling',
  },

  // ---- No-parse (nothing usable) ----
  { transcript: '', kind: 'no-parse', reason: 'empty' },
  { transcript: '   ', kind: 'no-parse', reason: 'empty', note: 'whitespace only' },
  { transcript: 'start a workout', kind: 'no-parse', reason: 'no-numbers' },
  { transcript: 'do some intervals please', kind: 'no-parse', reason: 'no-numbers' },
  { transcript: "let's get going", kind: 'no-parse', reason: 'no-numbers' },
  {
    transcript: 'banana thirty purple',
    kind: 'no-parse',
    reason: 'unparseable',
    note: 'a bare number word with no unit and no structure',
  },
  {
    transcript: 'to sets of won minute',
    kind: 'no-parse',
    reason: 'no-numbers',
    note: 'HOMOPHONES: "two"->"to", "one"->"won" — neither maps to a number, so we fall back safely',
  },
  {
    transcript: 'three sets of 2.5 minutes, thirty seconds rest',
    kind: 'no-parse',
    reason: 'unparseable',
    note: 'decimal number — normalise() would drop the separator and mis-bind the digits, so we refuse',
  },
  {
    transcript: 'three sets of 1,500 seconds, thirty seconds rest',
    kind: 'no-parse',
    reason: 'unparseable',
    note: 'thousands separator — same class as the decimal case; refuse rather than silently mis-parse',
  },
];
