import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VoiceEvent } from './types';
import { postVoice } from './voice-client';

const BLOB = new Blob(['audio-bytes'], { type: 'audio/webm' });

function ndjsonResponse(lines: string[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) controller.enqueue(encoder.encode(line + '\n'));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
    ...init,
  });
}

function makeDispatch() {
  const events: VoiceEvent[] = [];
  const dispatch = (event: VoiceEvent) => {
    events.push(event);
  };
  return { events, dispatch };
}

describe('postVoice', () => {
  it('dispatches transcriptArrived then sessionArrived on a happy-path stream', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"three sets","language":"en","whisperMs":900}',
        '{"kind":"parsed","session":{"sets":3,"workSec":60,"restSec":30}}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events).toEqual([
      { type: 'transcriptArrived', transcript: 'three sets', language: 'en' },
      {
        type: 'sessionArrived',
        session: { sets: 3, workSec: 60, restSec: 30 },
      },
    ]);
  });

  it('dispatches errorArrived(empty-transcript) when Whisper returns no text', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"","language":"en","whisperMs":820}',
        '{"kind":"error","reason":"empty-transcript"}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events[0]).toMatchObject({ type: 'transcriptArrived', transcript: '', language: 'en' });
    expect(events[1]).toMatchObject({ type: 'errorArrived', reason: 'empty-transcript' });
  });

  it('rejects streamed error events with unknown reason codes as malformed-stream', async () => {
    // Narrowing check in voice-client guards against the server contract widening silently —
    // an unknown reason string is treated as stream corruption, not passed through.
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"x"}',
        '{"kind":"error","reason":"some-future-reason"}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events.at(-1)).toEqual({ type: 'errorArrived', reason: 'malformed-stream' });
  });

  it('dispatches errorArrived when the server streams a parse error', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"banana kayak","language":"en"}',
        '{"kind":"error","reason":"not-a-session","totalMs":1200}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events[0]).toMatchObject({ type: 'transcriptArrived', transcript: 'banana kayak' });
    expect(events[1]).toMatchObject({ type: 'errorArrived', reason: 'not-a-session' });
  });

  it('extracts detectedLanguage from a language-unsupported error (message field)', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"bonjour","language":"fr"}',
        '{"kind":"error","reason":"language-unsupported","message":"fr"}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events[1]).toEqual({
      type: 'errorArrived',
      reason: 'language-unsupported',
      retryAfterSec: undefined,
      detectedLanguage: 'fr',
    });
  });

  it('maps HTTP 429 rate-limit response to errorArrived(rate-limited) with retryAfterSec', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(
      async () =>
        new Response('{"kind":"error","reason":"rate-limited","retryAfterSec":3600}\n', {
          status: 429,
          headers: { 'Content-Type': 'application/x-ndjson' },
        }),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events).toEqual([{ type: 'errorArrived', reason: 'rate-limited', retryAfterSec: 3600 }]);
  });

  it('maps HTTP 413 size-cap response to errorArrived(upload-too-large)', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(
      async () =>
        new Response('{"kind":"error","reason":"upload-too-large"}\n', {
          status: 413,
          headers: { 'Content-Type': 'application/x-ndjson' },
        }),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events[0]).toMatchObject({ reason: 'upload-too-large' });
  });

  it('falls back to status-based reason when the error body is unparseable', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () => new Response('not json', { status: 429 }));
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events[0]).toMatchObject({ reason: 'rate-limited' });
  });

  it('dispatches errorArrived(network-error) when fetch throws', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network error');
    });
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events).toEqual([{ type: 'errorArrived', reason: 'network-error' }]);
  });

  it('dispatches errorArrived(malformed-stream) when the server body has no ReadableStream', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () => {
      const r = new Response(null, { status: 200 });
      // Safari/older runtimes can omit body in this shape.
      return r;
    });
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events).toEqual([{ type: 'errorArrived', reason: 'malformed-stream' }]);
  });

  it('dispatches errorArrived(malformed-stream) when a line is not valid JSON', async () => {
    const { events, dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () => ndjsonResponse(['this is not json']));
    await postVoice(BLOB, dispatch, { fetchFn });
    expect(events.at(-1)).toEqual({ type: 'errorArrived', reason: 'malformed-stream' });
  });

  it('stays silent (no dispatch) when the request is aborted', async () => {
    const { events, dispatch } = makeDispatch();
    const controller = new AbortController();
    const fetchFn = vi.fn(async (_url, init: RequestInit = {}) => {
      const signal = init.signal;
      if (signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return ndjsonResponse(['{"kind":"whisper","transcript":"x"}']);
    });
    controller.abort();
    await postVoice(BLOB, dispatch, { fetchFn, signal: controller.signal });
    expect(events).toEqual([]);
  });

  describe('cold-start timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('aborts and dispatches cold-start-timeout when the worker is slow to respond', async () => {
      vi.useFakeTimers();
      const { events, dispatch } = makeDispatch();
      const fetchFn = vi.fn(
        (_url: unknown, init: RequestInit = {}) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );

      const promise = postVoice(BLOB, dispatch, { fetchFn, coldStartTimeoutMs: 30_000 });
      await vi.advanceTimersByTimeAsync(30_001);
      await promise;

      expect(events).toEqual([{ type: 'errorArrived', reason: 'cold-start-timeout' }]);
    });

    it('fires cold-start-timeout when headers arrive instantly but the body stream stalls', async () => {
      // TransformStream pattern in the Worker means response headers come back in ms while
      // the body waits on Workers AI — the timer must be tied to first body line, not headers.
      vi.useFakeTimers();
      const { events, dispatch } = makeDispatch();
      const fetchFn = vi.fn((_url: unknown, init: RequestInit = {}) => {
        const stalled = new ReadableStream<Uint8Array>({
          start(controller) {
            init.signal?.addEventListener('abort', () => {
              controller.error(new DOMException('aborted', 'AbortError'));
            });
          },
        });
        return Promise.resolve(
          new Response(stalled, {
            status: 200,
            headers: { 'Content-Type': 'application/x-ndjson' },
          }),
        );
      });

      const promise = postVoice(BLOB, dispatch, { fetchFn, coldStartTimeoutMs: 30_000 });
      await vi.advanceTimersByTimeAsync(30_001);
      await promise;

      expect(events).toEqual([{ type: 'errorArrived', reason: 'cold-start-timeout' }]);
    });

    it('does not fire the timeout once the first stream line arrives, even if the rest is slow', async () => {
      vi.useFakeTimers();
      const { events, dispatch } = makeDispatch();
      const fetchFn = vi.fn((_url: unknown, init: RequestInit = {}) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            // First line arrives quickly — this is what proves the worker is responsive.
            controller.enqueue(
              encoder.encode('{"kind":"whisper","transcript":"three sets","language":"en"}\n'),
            );
            // Then a long pause before the parsed event — must NOT trip the cold-start timer.
            setTimeout(() => {
              controller.enqueue(
                encoder.encode('{"kind":"parsed","session":{"sets":3,"workSec":60,"restSec":0}}\n'),
              );
              controller.close();
            }, 45_000);
            init.signal?.addEventListener('abort', () => {
              controller.error(new DOMException('aborted', 'AbortError'));
            });
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'application/x-ndjson' },
          }),
        );
      });

      const promise = postVoice(BLOB, dispatch, { fetchFn, coldStartTimeoutMs: 30_000 });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(60_000);
      await promise;

      expect(events.map((e) => e.type)).toEqual(['transcriptArrived', 'sessionArrived']);
    });

    it('user cancel during the cold-start window stays silent (no cold-start-timeout dispatch)', async () => {
      vi.useFakeTimers();
      const { events, dispatch } = makeDispatch();
      const controller = new AbortController();
      const fetchFn = vi.fn(
        (_url: unknown, init: RequestInit = {}) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );

      const promise = postVoice(BLOB, dispatch, {
        fetchFn,
        signal: controller.signal,
        coldStartTimeoutMs: 30_000,
      });
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(events).toEqual([]);
    });
  });

  it('sends the Content-Type from the blob', async () => {
    const { dispatch } = makeDispatch();
    const fetchFn = vi.fn(async () =>
      ndjsonResponse([
        '{"kind":"whisper","transcript":"x"}',
        '{"kind":"parsed","session":{"sets":1,"workSec":10,"restSec":0}}',
      ]),
    );
    await postVoice(BLOB, dispatch, { fetchFn });
    const firstCall = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const init = firstCall[1];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('audio/webm');
  });
});
