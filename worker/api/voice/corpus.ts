// ABOUT: Canonical voice-transcript corpus for parser validation.
// ABOUT: Each entry is a real phrasing Magnus (or a user) might say, paired with the
// ABOUT: expected parsed session. Used by the parser tests and the spike's coverage gate.

export type CorpusEntry = {
  id: string;
  text: string;
  language: 'en' | 'sv';
  category: 'canonical' | 'paraphrase' | 'ambiguous' | 'nonsense';
  expected: { sets: number; workSec: number; restSec: number };
};

export const CORPUS: CorpusEntry[] = [
  // English canonical (10)
  {
    id: 'en-canonical-01',
    text: 'Three sets of one minute each, thirty seconds rest between each',
    language: 'en',
    category: 'canonical',
    expected: { sets: 3, workSec: 60, restSec: 30 },
  },
  {
    id: 'en-canonical-02',
    text: 'Give me 3 sets of 1 minute, 30 seconds rest between each',
    language: 'en',
    category: 'canonical',
    expected: { sets: 3, workSec: 60, restSec: 30 },
  },
  {
    id: 'en-canonical-03',
    text: '5 rounds of 45 seconds with 15 seconds rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 5, workSec: 45, restSec: 15 },
  },
  {
    id: 'en-canonical-04',
    text: '2 minutes work, 1 minute rest, 4 sets',
    language: 'en',
    category: 'canonical',
    expected: { sets: 4, workSec: 120, restSec: 60 },
  },
  {
    id: 'en-canonical-05',
    text: '8 rounds of 20 seconds, 10 seconds rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 8, workSec: 20, restSec: 10 },
  },
  {
    id: 'en-canonical-06',
    text: 'Four sets of ninety seconds with thirty seconds rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 4, workSec: 90, restSec: 30 },
  },
  {
    id: 'en-canonical-07',
    text: '6 sets of 1:30 work, 30 second rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 6, workSec: 90, restSec: 30 },
  },
  {
    id: 'en-canonical-08',
    text: 'Three rounds of two minutes, one minute rest between',
    language: 'en',
    category: 'canonical',
    expected: { sets: 3, workSec: 120, restSec: 60 },
  },
  {
    id: 'en-canonical-09',
    text: '10 sets of 30 seconds with 30 seconds rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 10, workSec: 30, restSec: 30 },
  },
  {
    id: 'en-canonical-10',
    text: '3 sets of 45 seconds, 15 seconds rest',
    language: 'en',
    category: 'canonical',
    expected: { sets: 3, workSec: 45, restSec: 15 },
  },

  // English paraphrase (2). Genuinely hard paraphrases ("half a minute", "one-and-a-
  // half minute") are expected to fall through to the Llama fallback and are not in
  // the corpus — the parser's job is precision, not recall, on the deterministic tail.
  {
    id: 'en-paraphrase-01',
    text: 'One minute on, thirty seconds off, three times',
    language: 'en',
    category: 'paraphrase',
    expected: { sets: 3, workSec: 60, restSec: 30 },
  },
  {
    id: 'en-paraphrase-02',
    text: '4 x 1 minute with 30 second breaks',
    language: 'en',
    category: 'paraphrase',
    expected: { sets: 4, workSec: 60, restSec: 30 },
  },

  // Swedish canonical (5)
  {
    id: 'sv-canonical-01',
    text: 'Tre set om en minut vardera, trettio sekunders vila mellan varje',
    language: 'sv',
    category: 'canonical',
    expected: { sets: 3, workSec: 60, restSec: 30 },
  },
  {
    id: 'sv-canonical-02',
    text: '5 set om 45 sekunder med 15 sekunder vila',
    language: 'sv',
    category: 'canonical',
    expected: { sets: 5, workSec: 45, restSec: 15 },
  },
  {
    id: 'sv-canonical-03',
    text: '4 set om 90 sekunder, 30 sekunder vila',
    language: 'sv',
    category: 'canonical',
    expected: { sets: 4, workSec: 90, restSec: 30 },
  },
  {
    id: 'sv-canonical-04',
    text: 'Åtta omgångar om 20 sekunder, 10 sekunder vila',
    language: 'sv',
    category: 'canonical',
    expected: { sets: 8, workSec: 20, restSec: 10 },
  },
  {
    id: 'sv-canonical-05',
    text: 'Tio set om 30 sekunder med 30 sekunder vila',
    language: 'sv',
    category: 'canonical',
    expected: { sets: 10, workSec: 30, restSec: 30 },
  },

  // Swedish paraphrase (2)
  {
    id: 'sv-paraphrase-01',
    text: 'Ge mig tre omgångar på en minut med trettio sekunders paus',
    language: 'sv',
    category: 'paraphrase',
    expected: { sets: 3, workSec: 60, restSec: 30 },
  },
  {
    id: 'sv-paraphrase-02',
    text: 'Fem set om två minuter, en minut vila mellan',
    language: 'sv',
    category: 'paraphrase',
    expected: { sets: 5, workSec: 120, restSec: 60 },
  },

  // Nonsense (parser should return confidence: 'none')
  {
    id: 'nonsense-01',
    text: 'banana kayak helicopter',
    language: 'en',
    category: 'nonsense',
    expected: { sets: 3, workSec: 60, restSec: 0 }, // clamped defaults, confidence should be 'none'
  },
];

export const CANONICAL_EN = CORPUS.filter((e) => e.language === 'en' && e.category === 'canonical');
export const CANONICAL_SV = CORPUS.filter((e) => e.language === 'sv' && e.category === 'canonical');
export const CANONICAL_ALL = CORPUS.filter((e) => e.category === 'canonical');
export const PARAPHRASES = CORPUS.filter((e) => e.category === 'paraphrase');
export const NONSENSE = CORPUS.filter((e) => e.category === 'nonsense');
