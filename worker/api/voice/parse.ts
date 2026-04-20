// ABOUT: POST /api/voice/parse — streaming NDJSON endpoint.
// ABOUT: Accepts audio bytes. Streams back two (or more) newline-delimited JSON events:
// ABOUT:   {"kind":"whisper", transcript, language, whisperMs}
// ABOUT:   {"kind":"parsed", session, llamaMs, totalMs} | {"kind":"error", reason, ...}
// ABOUT: The client displays the transcript the moment the first event arrives, then updates
// ABOUT: once the second event arrives. No rate limiting in the spike — that lands with Phase 3 proper.

import type { Env } from '../../index';
import { isAllowedOrigin } from '../../lib/isAllowedOrigin';
import { toSafeErrorMessage } from '../../lib/toSafeErrorMessage';

import { parseWithLlama } from './llama';
import { transcribe } from './whisper';

// Whisper occasionally tags Swedish speech as Icelandic (shared Nordic phonology,
// especially open-back vowels: "åtta" → "ótta", "sekunder" → "sekundar"). Accepting the
// Nordic cousins prevents false rejects; Llama handles the spelling variance fine.
// Genuine French/German/etc. still get gated and don't burn Llama quota.
const SUPPORTED_LANGUAGES = new Set(['en', 'sv', 'is', 'no', 'nn', 'nb', 'da']);

const MIN_AUDIO_BYTES = 500;
// 3 MB is ~30× a typical 8-second opus blob (~100 KB). Generous headroom for any MediaRecorder
// MIME variant we accept, while capping the blast radius of unauthenticated abuse of the paid
// Workers AI inference path.
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

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
    | 'upload-too-large'
    | 'origin-not-allowed'
    | 'empty-transcript'
    | 'language-unsupported'
    | 'whisper-error'
    | 'llama-error'
    | 'not-a-session'
    | 'schema-failed'
    | 'method-not-allowed'
    | 'rate-limited';
  message?: string;
  totalMs?: number;
  retryAfterSec?: number;
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

  if (!isAllowedOrigin(request)) {
    return errorResponse({ kind: 'error', reason: 'origin-not-allowed' }, 403);
  }

  // Fast-fail on Content-Length before buffering the body. Attackers can omit or lie about
  // this header, so the belt-and-braces byteLength check below still runs.
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > MAX_AUDIO_BYTES) {
    return errorResponse({ kind: 'error', reason: 'upload-too-large' }, 413);
  }

  const startedAt = performance.now();
  const audioBytes = new Uint8Array(await request.arrayBuffer());
  if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
    return errorResponse({ kind: 'error', reason: 'upload-too-large' }, 413);
  }
  if (audioBytes.byteLength < MIN_AUDIO_BYTES) {
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
        toSafeErrorMessage(err, 'whisper-error');
        await writer.write(jsonLine({ kind: 'error', reason: 'whisper-error' }));
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
        // The detected-language tag is public info on the stream — safe to echo per the
        // error-content-safety contract (see ADR 2026-04-20).
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
          await writer.write(jsonLine({ kind: 'error', reason: 'not-a-session', totalMs }));
        } else if (llama.reason === 'model-error') {
          toSafeErrorMessage(llama.message, 'llama-error', { totalMs });
          await writer.write(jsonLine({ kind: 'error', reason: 'llama-error', totalMs }));
        } else {
          toSafeErrorMessage(llama.message, 'schema-failed', { totalMs });
          await writer.write(jsonLine({ kind: 'error', reason: 'schema-failed', totalMs }));
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
      toSafeErrorMessage(err, 'llama-error', { stage: 'unhandled' });
      try {
        await writer.write(jsonLine({ kind: 'error', reason: 'llama-error' }));
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
