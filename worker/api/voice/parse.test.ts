import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../../index';

import { parseVoice } from './parse';

type AiCallStub = {
  whisper?: { text?: string; language?: string };
  llamaResponses?: string[]; // In order: first call, retry if any.
  llamaShouldThrow?: boolean;
};

function makeEnv(stub: AiCallStub): Env {
  const responses = stub.llamaResponses ? [...stub.llamaResponses] : [];
  return {
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    AI: {
      run: vi.fn(async (model: string) => {
        if (model.includes('whisper')) {
          return stub.whisper ?? {};
        }
        if (stub.llamaShouldThrow) {
          throw new Error('AI error');
        }
        return { response: responses.shift() ?? '' };
      }),
    } as unknown as Ai,
  };
}

function makeRequest(body: BodyInit = new Uint8Array(2048), method: string = 'POST') {
  return new Request('https://takt.hultberg.org/api/voice/parse', {
    method,
    body: method === 'POST' ? body : undefined,
  });
}

async function readNdjson(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('POST /api/voice/parse (streaming)', () => {
  it('rejects non-POST requests', async () => {
    const env = makeEnv({});
    const res = await parseVoice(makeRequest(new Uint8Array(), 'GET'), env);
    expect(res.status).toBe(405);
    const events = await readNdjson(res);
    expect(events).toEqual([{ kind: 'error', reason: 'method-not-allowed' }]);
  });

  it('returns upload-empty when the audio payload is too small', async () => {
    const env = makeEnv({});
    const res = await parseVoice(makeRequest(new Uint8Array(50)), env);
    expect(res.status).toBe(400);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'error', reason: 'upload-empty' });
  });

  it('emits whisper then parsed for a canonical English phrase', async () => {
    const env = makeEnv({
      whisper: { text: 'Three sets of one minute, 30 seconds rest', language: 'en' },
      llamaResponses: ['{"sets":3,"workSec":60,"restSec":30}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);

    expect(events[0]).toMatchObject({
      kind: 'whisper',
      transcript: 'Three sets of one minute, 30 seconds rest',
      language: 'en',
    });
    expect(events[1]).toMatchObject({
      kind: 'parsed',
      session: { sets: 3, workSec: 60, restSec: 30 },
    });
  });

  it('emits the whisper event BEFORE the parsed event (streaming order)', async () => {
    const env = makeEnv({
      whisper: { text: 'five rounds of 45 seconds with 15 seconds rest', language: 'en' },
      llamaResponses: ['{"sets":5,"workSec":45,"restSec":15}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events.map((e) => e.kind)).toEqual(['whisper', 'parsed']);
  });

  it('stops at the language gate for non-en/sv transcripts', async () => {
    const env = makeEnv({
      whisper: { text: "trois séries d'une minute", language: 'fr' },
      llamaResponses: ['{"sets":3,"workSec":60,"restSec":0}'], // should never be called
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'whisper', language: 'fr' });
    expect(events[1]).toMatchObject({ kind: 'error', reason: 'language-unsupported' });
    expect(events).toHaveLength(2);
    // Verify Llama was never invoked.
    const run = (env.AI as unknown as { run: ReturnType<typeof vi.fn> }).run;
    const llamaCalls = run.mock.calls.filter((c) => !String(c[0]).includes('whisper'));
    expect(llamaCalls).toHaveLength(0);
  });

  it('emits empty-transcript when Whisper returns no text', async () => {
    const env = makeEnv({ whisper: { text: '', language: 'en' } });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'whisper', transcript: '' });
    expect(events[1]).toMatchObject({ kind: 'error', reason: 'empty-transcript' });
  });

  it('emits not-a-session when Llama decides the transcript is nonsense', async () => {
    const env = makeEnv({
      whisper: { text: 'banana kayak helicopter', language: 'en' },
      llamaResponses: ['{"error":"not-a-session"}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[1]).toMatchObject({ kind: 'error', reason: 'not-a-session' });
  });

  it('emits schema-failed when Llama output fails validation after retry', async () => {
    const env = makeEnv({
      whisper: { text: 'something the model will flub', language: 'en' },
      llamaResponses: ['this is not json', 'still not json'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[1]).toMatchObject({ kind: 'error', reason: 'schema-failed' });
  });

  it('recovers on retry when the first Llama output is malformed but the second is valid', async () => {
    const env = makeEnv({
      whisper: { text: 'three sets of 1 minute 30 sec rest', language: 'en' },
      llamaResponses: ['here is the JSON: {not valid', '{"sets":3,"workSec":60,"restSec":30}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[1]).toMatchObject({
      kind: 'parsed',
      session: { sets: 3, workSec: 60, restSec: 30 },
    });
  });

  it('emits whisper-error when transcription throws', async () => {
    const env = {
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      AI: {
        run: vi.fn(async () => {
          throw new Error('Whisper boom');
        }),
      } as unknown as Ai,
    };
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'error', reason: 'whisper-error' });
  });

  it('emits llama-error when the model call throws', async () => {
    const env = makeEnv({
      whisper: { text: 'three sets of 1 minute', language: 'en' },
      llamaShouldThrow: true,
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'whisper' });
    expect(events[1]).toMatchObject({ kind: 'error', reason: 'llama-error' });
  });

  it('accepts Icelandic through the gate (Whisper sometimes misclassifies Swedish as Icelandic)', async () => {
    const env = makeEnv({
      whisper: { text: 'Fem sett om fyrtífem sekundar og femtón sekundar vela', language: 'is' },
      llamaResponses: ['{"sets":5,"workSec":45,"restSec":15}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ kind: 'whisper', language: 'is' });
    expect(events[1]).toMatchObject({
      kind: 'parsed',
      session: { sets: 5, workSec: 45, restSec: 15 },
    });
  });

  it('accepts Swedish transcripts through the language gate', async () => {
    const env = makeEnv({
      whisper: {
        text: 'Tre set om en minut vardera, trettio sekunders vila mellan varje',
        language: 'sv',
      },
      llamaResponses: ['{"sets":3,"workSec":60,"restSec":30}'],
    });
    const res = await parseVoice(makeRequest(), env);
    const events = await readNdjson(res);
    expect(events[0]).toMatchObject({ language: 'sv' });
    expect(events[1]).toMatchObject({
      kind: 'parsed',
      session: { sets: 3, workSec: 60, restSec: 30 },
    });
  });
});
