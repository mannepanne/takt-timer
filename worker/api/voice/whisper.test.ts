import { describe, expect, it, vi } from 'vitest';

import { transcribe } from './whisper';

function makeAi(response: unknown) {
  return { run: vi.fn(async () => response) } as unknown as Ai;
}

describe('whisper.transcribe', () => {
  it('returns trimmed text and language when the model returns both', async () => {
    const ai = makeAi({ text: '  three sets of one minute  ', language: 'en' });
    const result = await transcribe(ai, new Uint8Array([1, 2, 3, 4]));
    expect(result.text).toBe('three sets of one minute');
    expect(result.language).toBe('en');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('falls back to transcription_info.language when language is absent', async () => {
    const ai = makeAi({ text: 'hello', transcription_info: { language: 'sv' } });
    const result = await transcribe(ai, new Uint8Array([1]));
    expect(result.language).toBe('sv');
  });

  it('returns empty text and undefined language when the model returns nothing', async () => {
    const ai = makeAi({});
    const result = await transcribe(ai, new Uint8Array([1]));
    expect(result.text).toBe('');
    expect(result.language).toBeUndefined();
  });

  it('base64-encodes the audio bytes before calling the model', async () => {
    const runFn = vi.fn(async (_model: string, _input: unknown) => ({ text: '' }));
    const ai = { run: runFn } as unknown as Ai;
    await transcribe(ai, new Uint8Array([72, 105])); // "Hi"
    const [, inputArg] = runFn.mock.calls[0];
    const input = inputArg as { audio: string };
    expect(input.audio).toBe('SGk=');
  });
});
