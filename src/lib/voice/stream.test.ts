import { describe, expect, it } from 'vitest';

import { readNdjsonStream } from './stream';

function streamFromChunks(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect<T>(stream: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const line of readNdjsonStream<T>(stream)) out.push(line);
  return out;
}

describe('readNdjsonStream', () => {
  it('yields a single parsed line from a single chunk', async () => {
    const lines = await collect<{ kind: string }>(streamFromChunks('{"kind":"whisper"}\n'));
    expect(lines).toEqual([{ ok: true, value: { kind: 'whisper' } }]);
  });

  it('yields multiple lines from one chunk', async () => {
    const lines = await collect<{ n: number }>(streamFromChunks('{"n":1}\n{"n":2}\n{"n":3}\n'));
    expect(lines.map((l) => (l.ok ? l.value.n : null))).toEqual([1, 2, 3]);
  });

  it('handles a chunk boundary that splits a JSON object mid-line', async () => {
    // "one":" | "1"}\n{"two":2}\n  — split inside the string value.
    const lines = await collect<{ one?: string; two?: number }>(
      streamFromChunks('{"one":"', '1"}\n{"two":2}\n'),
    );
    expect(lines.map((l) => l.ok && l.value)).toEqual([{ one: '1' }, { two: 2 }]);
  });

  it('handles a chunk boundary exactly on the newline', async () => {
    const lines = await collect<{ a: number }>(streamFromChunks('{"a":1}', '\n{"a":2}\n'));
    expect(lines.map((l) => l.ok && l.value)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('yields the trailing line when the final newline is missing', async () => {
    const lines = await collect<{ kind: string }>(
      streamFromChunks('{"kind":"whisper"}\n{"kind":"parsed"}'),
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ ok: true, value: { kind: 'parsed' } });
  });

  it('ignores empty and whitespace-only lines between events', async () => {
    const lines = await collect<{ kind: string }>(
      streamFromChunks('{"kind":"a"}\n\n  \n{"kind":"b"}\n'),
    );
    expect(lines.map((l) => l.ok && l.value)).toEqual([{ kind: 'a' }, { kind: 'b' }]);
  });

  it('yields a parse-failure result for malformed JSON without throwing', async () => {
    const lines = await collect(streamFromChunks('{"broken":\n{"good":true}\n'));
    expect(lines[0].ok).toBe(false);
    expect(lines[1].ok).toBe(true);
  });

  it('yields nothing for an empty body', async () => {
    const lines = await collect(streamFromChunks());
    expect(lines).toEqual([]);
  });

  it('handles multi-byte characters split across chunks (TextDecoder stream mode)', async () => {
    // "ö" is 0xC3 0xB6 in UTF-8 — split between two chunks.
    const encoder = new TextEncoder();
    const firstHalf = encoder.encode('{"t":"'); // up to opening quote of the string
    const oBytes = encoder.encode('ö'); // 2 bytes
    const second = new Uint8Array([oBytes[0]]);
    const third = new Uint8Array([oBytes[1], ...encoder.encode('"}\n')]);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(firstHalf);
        controller.enqueue(second);
        controller.enqueue(third);
        controller.close();
      },
    });
    const lines = [];
    for await (const line of readNdjsonStream<{ t: string }>(stream)) lines.push(line);
    expect(lines[0]).toEqual({ ok: true, value: { t: 'ö' } });
  });
});
