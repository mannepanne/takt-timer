import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../../index';

import { parseVoice } from './parse';

function makeEnv(whisperResponse: unknown): Env {
  return {
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    AI: { run: vi.fn(async () => whisperResponse) } as unknown as Ai,
  };
}

function makeRequest(body: BodyInit = new Uint8Array(2048), method: string = 'POST') {
  return new Request('https://takt.hultberg.org/api/voice/parse', {
    method,
    body: method === 'POST' ? body : undefined,
  });
}

describe('POST /api/voice/parse (spike shape)', () => {
  it('rejects non-POST requests', async () => {
    const env = makeEnv({ text: '' });
    const res = await parseVoice(makeRequest(new Uint8Array(), 'GET'), env);
    expect(res.status).toBe(405);
  });

  it('returns upload-empty when the audio payload is too small', async () => {
    const env = makeEnv({ text: '' });
    const res = await parseVoice(makeRequest(new Uint8Array(50)), env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('upload-empty');
  });

  it('returns empty-transcript when Whisper returns no text', async () => {
    const env = makeEnv({ text: '', language: 'en' });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.reason).toBe('empty-transcript');
  });

  it('returns language-unsupported for non-en/sv transcripts', async () => {
    const env = makeEnv({ text: 'trois séries dune minute', language: 'fr' });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; reason: string; language: string };
    expect(body.reason).toBe('language-unsupported');
    expect(body.language).toBe('fr');
  });

  it('returns parser-miss when the parser cannot resolve the transcript', async () => {
    const env = makeEnv({ text: 'banana kayak helicopter', language: 'en' });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.reason).toBe('parser-miss');
  });

  it('returns a parsed session for a canonical English phrase', async () => {
    const env = makeEnv({
      text: 'Three sets of one minute each, thirty seconds rest between each',
      language: 'en',
    });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      session: { sets: number; workSec: number; restSec: number };
      source: string;
      confidence: string;
    };
    expect(body.ok).toBe(true);
    expect(body.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
    expect(body.source).toBe('parser');
    expect(body.confidence).toBe('high');
  });

  it('accepts Swedish transcripts through the parser', async () => {
    const env = makeEnv({
      text: 'Tre set om en minut vardera, trettio sekunders vila mellan varje',
      language: 'sv',
    });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: { sets: number; workSec: number; restSec: number };
      language: string;
    };
    expect(body.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
    expect(body.language).toBe('sv');
  });

  it('accepts transcripts when Whisper returns no language field', async () => {
    const env = makeEnv({ text: '5 rounds of 45 seconds with 15 seconds rest' });
    const res = await parseVoice(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: { sets: number; workSec: number; restSec: number };
    };
    expect(body.session).toEqual({ sets: 5, workSec: 45, restSec: 15 });
  });
});
