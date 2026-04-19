// ABOUT: POST /api/voice/parse — streaming NDJSON endpoint.
// ABOUT: Accepts audio bytes. Streams back two (or more) newline-delimited JSON events:
// ABOUT:   {"kind":"whisper", transcript, language, whisperMs}
// ABOUT:   {"kind":"parsed", session, llamaMs, totalMs} | {"kind":"error", reason, ...}
// ABOUT: The client displays the transcript the moment the first event arrives, then updates
// ABOUT: once the second event arrives. No rate limiting in the spike — that lands with Phase 3 proper.

import type { Env } from '../../index';

import { parseWithLlama } from './llama';
import { transcribe } from './whisper';

// Whisper occasionally tags Swedish speech as Icelandic (shared Nordic phonology,
// especially open-back vowels: "åtta" → "ótta", "sekunder" → "sekundar"). Accepting the
// Nordic cousins prevents false rejects; Llama handles the spelling variance fine.
// Genuine French/German/etc. still get gated and don't burn Llama quota.
const SUPPORTED_LANGUAGES = new Set(['en', 'sv', 'is', 'no', 'nn', 'nb', 'da']);

type WhisperEvent = {
  kind: 'whisper';
  transcript: string;
  language?: string;
  whisperMs: number;
};

type ParsedEvent = {
  kind: 'parsed';
  session: { sets: number; workSec: number; restSec: number };
  llamaMs: number;
  totalMs: number;
  rawOutput?: string;
};

type ErrorEvent = {
  kind: 'error';
  reason:
    | 'upload-empty'
    | 'empty-transcript'
    | 'language-unsupported'
    | 'whisper-error'
    | 'llama-error'
    | 'not-a-session'
    | 'schema-failed'
    | 'method-not-allowed';
  message?: string;
  totalMs?: number;
};

type Event = WhisperEvent | ParsedEvent | ErrorEvent;

function jsonLine(event: Event): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + '\n');
}

function ndjsonResponse(readable: ReadableStream, status = 200): Response {
  return new Response(readable, {
    status,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function errorResponse(event: ErrorEvent, status: number): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(jsonLine(event));
      controller.close();
    },
  });
  return ndjsonResponse(stream, status);
}

export async function parseVoice(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse({ kind: 'error', reason: 'method-not-allowed' }, 405);
  }

  const startedAt = performance.now();
  const audioBytes = new Uint8Array(await request.arrayBuffer());
  if (audioBytes.byteLength < 500) {
    return errorResponse({ kind: 'error', reason: 'upload-empty' }, 400);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Detach the async pipeline; the response returns immediately with the streaming body.
  (async () => {
    try {
      let whisper;
      try {
        whisper = await transcribe(env.AI, audioBytes);
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        await writer.write(jsonLine({ kind: 'error', reason: 'whisper-error', message }));
        return;
      }

      const transcript = whisper.text;
      const language = whisper.language?.toLowerCase();

      await writer.write(
        jsonLine({
          kind: 'whisper',
          transcript,
          language,
          whisperMs: whisper.latencyMs,
        }),
      );

      if (!transcript) {
        await writer.write(jsonLine({ kind: 'error', reason: 'empty-transcript' }));
        return;
      }

      if (language && !SUPPORTED_LANGUAGES.has(language)) {
        await writer.write(
          jsonLine({
            kind: 'error',
            reason: 'language-unsupported',
            message: language,
          }),
        );
        return;
      }

      const llama = await parseWithLlama(env.AI, transcript);
      const totalMs = Math.round(performance.now() - startedAt);

      if (!llama.ok) {
        if (llama.reason === 'not-a-session') {
          await writer.write(
            jsonLine({
              kind: 'error',
              reason: 'not-a-session',
              message: llama.message,
              totalMs,
            }),
          );
        } else if (llama.reason === 'model-error') {
          await writer.write(
            jsonLine({
              kind: 'error',
              reason: 'llama-error',
              message: llama.message,
              totalMs,
            }),
          );
        } else {
          await writer.write(
            jsonLine({
              kind: 'error',
              reason: 'schema-failed',
              message: llama.message,
              totalMs,
            }),
          );
        }
        return;
      }

      await writer.write(
        jsonLine({
          kind: 'parsed',
          session: llama.session,
          llamaMs: llama.latencyMs,
          totalMs,
          rawOutput: llama.rawOutput,
        }),
      );
    } catch (err) {
      // Final safety net — shouldn't happen, but we never want to leave the stream hanging.
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      try {
        await writer.write(jsonLine({ kind: 'error', reason: 'llama-error', message }));
      } catch {
        // If the writer is already closed, swallow.
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Best effort.
      }
    }
  })();

  return ndjsonResponse(readable);
}
