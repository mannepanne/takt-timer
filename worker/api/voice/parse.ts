// ABOUT: POST /api/voice/parse — streaming NDJSON endpoint.
// ABOUT: Accepts audio bytes. Streams back two (or more) newline-delimited JSON events:
// ABOUT:   {"kind":"whisper", transcript, language, whisperMs}
// ABOUT:   {"kind":"parsed", session, llamaMs, totalMs} | {"kind":"error", reason, ...}
// ABOUT: The client displays the transcript the moment the first event arrives, then updates
// ABOUT: once the second event arrives.

import type { Env } from '../../index';
import { isAllowedOrigin } from '../../lib/isAllowedOrigin';
import { logRequest } from '../../lib/logger';
import { toSafeErrorMessage } from '../../lib/toSafeErrorMessage';
import { getSession } from '../../lib/sessionStore';
import { insertVoiceCall } from '../../db/queries';

import { SUPPORTED_LANGUAGES } from './languages';
import { parseWithLlama } from './llama';
import { checkAndIncrementRateLimit } from './rate-limit';
import { transcribe } from './whisper';

// Sub-500-byte uploads are below the floor for any plausible 8s-cap opus blob and indicate
// a zero-byte iOS first-grab or a truncated request. Reject before burning Workers AI quota.
export const MIN_AUDIO_BYTES = 500;
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

function isRateLimitBypassEnabled(flag: string | undefined): boolean {
  // Accept "1" or "true" (case-insensitive). Any other value, including unset, leaves the
  // limiter active. Cloudflare Worker [vars] always arrive as strings, so coerce explicitly.
  if (!flag) return false;
  const normalised = flag.toLowerCase();
  return normalised === '1' || normalised === 'true';
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

export async function parseVoice(
  request: Request,
  env: Env,
  ctx?: Pick<ExecutionContext, 'waitUntil'>,
): Promise<Response> {
  const t0 = performance.now();

  function logVoice(fields: Omit<Parameters<typeof logRequest>[0], 'method' | 'path'>): void {
    logRequest({ method: 'POST', path: '/api/voice/parse', ...fields });
  }

  if (request.method !== 'POST') {
    logVoice({ status: 405, latencyMs: Math.round(performance.now() - t0) });
    return errorResponse({ kind: 'error', reason: 'method-not-allowed' }, 405);
  }

  if (!isAllowedOrigin(request)) {
    logVoice({ status: 403, latencyMs: Math.round(performance.now() - t0) });
    return errorResponse({ kind: 'error', reason: 'origin-not-allowed' }, 403);
  }

  // Fast-fail on Content-Length before buffering the body. Attackers can omit or lie about
  // this header, so the belt-and-braces byteLength check below still runs.
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > MAX_AUDIO_BYTES) {
    logVoice({ status: 413, latencyMs: Math.round(performance.now() - t0) });
    return errorResponse({ kind: 'error', reason: 'upload-too-large' }, 413);
  }

  const startedAt = performance.now();
  const audioBytes = new Uint8Array(await request.arrayBuffer());
  if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
    logVoice({ status: 413, latencyMs: Math.round(performance.now() - t0) });
    return errorResponse({ kind: 'error', reason: 'upload-too-large' }, 413);
  }
  if (audioBytes.byteLength < MIN_AUDIO_BYTES) {
    logVoice({ status: 400, latencyMs: Math.round(performance.now() - t0) });
    return errorResponse({ kind: 'error', reason: 'upload-empty' }, 400);
  }

  // Resolve session first so authenticated users get the 30/day tier.
  // An invalid or expired cookie falls through to anonymous rate-limiting — not a 401.
  const session = await getSession(env, request.headers.get('Cookie'));
  const userId = session?.userHandle;

  const bypass = isRateLimitBypassEnabled(env.ALLOW_RATE_LIMIT_BYPASS) || session?.isAdmin === true;
  const rateCheck = await checkAndIncrementRateLimit(env.RATE_LIMITS, request, {
    bypass,
    userId,
  });
  if (!rateCheck.allowed) {
    logVoice({
      status: 429,
      latencyMs: Math.round(performance.now() - t0),
      authenticated: !!userId,
      rateLimited: true,
    });
    return errorResponse(
      { kind: 'error', reason: 'rate-limited', retryAfterSec: rateCheck.retryAfterSec },
      429,
    );
  }

  // Read the client's language hint (ISO 639-1, from X-Takt-Lang header).
  // Only forward values we actually support — unknown values are silently ignored.
  const langHeader = request.headers.get('X-Takt-Lang')?.toLowerCase();
  const whisperLang = langHeader && SUPPORTED_LANGUAGES.has(langHeader) ? langHeader : undefined;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Detach the async pipeline; the response returns immediately with the streaming body.
  (async () => {
    try {
      let whisper;
      try {
        whisper = await transcribe(env.AI, audioBytes, whisperLang);
      } catch (err) {
        logVoice({
          status: 200,
          latencyMs: Math.round(performance.now() - startedAt),
          authenticated: !!userId,
          rateLimited: false,
          errorKind: 'whisper-error',
        });
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
        logVoice({
          status: 200,
          latencyMs: Math.round(performance.now() - startedAt),
          authenticated: !!userId,
          rateLimited: false,
          errorKind: 'empty-transcript',
          whisperMs: whisper.latencyMs,
        });
        await writer.write(jsonLine({ kind: 'error', reason: 'empty-transcript' }));
        return;
      }

      if (language && !SUPPORTED_LANGUAGES.has(language)) {
        logVoice({
          status: 200,
          latencyMs: Math.round(performance.now() - startedAt),
          authenticated: !!userId,
          rateLimited: false,
          errorKind: 'language-unsupported',
          whisperMs: whisper.latencyMs,
        });
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
        const llamaErrorKind =
          llama.reason === 'not-a-session'
            ? 'not-a-session'
            : llama.reason === 'model-error'
              ? 'llama-error'
              : 'schema-failed';
        logVoice({
          status: 200,
          latencyMs: totalMs,
          authenticated: !!userId,
          rateLimited: false,
          errorKind: llamaErrorKind,
          whisperMs: whisper.latencyMs,
        });
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

      logVoice({
        status: 200,
        latencyMs: totalMs,
        authenticated: !!userId,
        rateLimited: false,
        whisperMs: whisper.latencyMs,
        llamaMs: llama.latencyMs,
      });
      await writer.write(
        jsonLine({
          kind: 'parsed',
          session: llama.session,
          llamaMs: llama.latencyMs,
          totalMs,
        }),
      );
      ctx?.waitUntil(insertVoiceCall(env.DB, userId ?? null, Date.now()));
    } catch (err) {
      // Final safety net — shouldn't happen, but we never want to leave the stream hanging.
      logVoice({
        status: 200,
        latencyMs: Math.round(performance.now() - startedAt),
        authenticated: !!userId,
        rateLimited: false,
        errorKind: 'unhandled',
      });
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
