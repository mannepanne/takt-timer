// ABOUT: POSTs audio to /api/voice/parse and streams NDJSON events back as voice-machine events.
// ABOUT: Translates server-side event shapes ({kind:'whisper'|'parsed'|'error'}) into the
// ABOUT: machine's VoiceEvent shapes (transcriptArrived / sessionArrived / errorArrived).

import { readNdjsonStream, type StreamLine } from './stream';
import type { ErrorReason, ParsedSession, VoiceEvent } from './types';

const ERROR_REASONS: ReadonlySet<ErrorReason> = new Set<ErrorReason>([
  'upload-empty',
  'upload-too-large',
  'origin-not-allowed',
  'empty-transcript',
  'language-unsupported',
  'whisper-error',
  'llama-error',
  'not-a-session',
  'schema-failed',
  'method-not-allowed',
  'rate-limited',
  'network-error',
  'malformed-stream',
]);

function isErrorReason(value: unknown): value is ErrorReason {
  return typeof value === 'string' && ERROR_REASONS.has(value as ErrorReason);
}

type ServerWhisperEvent = {
  kind: 'whisper';
  transcript?: string;
  language?: string;
  whisperMs?: number;
};

type ServerParsedEvent = {
  kind: 'parsed';
  session: ParsedSession;
  llamaMs?: number;
  totalMs?: number;
};

type ServerErrorEvent = {
  kind: 'error';
  reason: ErrorReason;
  message?: string;
  retryAfterSec?: number;
  totalMs?: number;
};

type ServerEvent = ServerWhisperEvent | ServerParsedEvent | ServerErrorEvent;

export type VoiceDispatch = (event: VoiceEvent) => void;

export type VoiceRequestOptions = {
  /** Override the default '/api/voice/parse' endpoint — used by tests. */
  endpoint?: string;
  /** AbortController signal for cancellation (hooked up by the voice machine). */
  signal?: AbortSignal;
  /** Optional fetch replacement — defaults to global fetch. */
  fetchFn?: typeof fetch;
};

/**
 * Sends the audio blob and dispatches VoiceEvents as the NDJSON stream arrives.
 * Returns when the stream closes. Throws only for programmer errors — network/server
 * failures are dispatched as `errorArrived` events and resolve normally.
 */
export async function postVoice(
  blob: Blob,
  dispatch: VoiceDispatch,
  options: VoiceRequestOptions = {},
): Promise<void> {
  const endpoint = options.endpoint ?? '/api/voice/parse';
  const fetchFn = options.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      signal: options.signal,
    });
  } catch (err) {
    if (isAbortError(err)) return; // Caller cancelled; do not dispatch.
    dispatch({ type: 'errorArrived', reason: 'network-error' });
    return;
  }

  if (!response.ok) {
    const reason = await extractErrorReason(response);
    dispatch({ type: 'errorArrived', reason: reason.reason, retryAfterSec: reason.retryAfterSec });
    return;
  }

  if (!response.body) {
    dispatch({ type: 'errorArrived', reason: 'malformed-stream' });
    return;
  }

  try {
    for await (const line of readNdjsonStream<ServerEvent>(response.body)) {
      const dispatched = dispatchLine(line, dispatch);
      if (!dispatched) {
        // Malformed JSON or unknown event shape — treat as stream corruption.
        dispatch({ type: 'errorArrived', reason: 'malformed-stream' });
        return;
      }
    }
  } catch (err) {
    if (isAbortError(err)) return;
    dispatch({ type: 'errorArrived', reason: 'network-error' });
  }
}

function dispatchLine(line: StreamLine<ServerEvent>, dispatch: VoiceDispatch): boolean {
  if (!line.ok) return false;
  const event = line.value;
  if (event.kind === 'whisper') {
    dispatch({
      type: 'transcriptArrived',
      transcript: event.transcript ?? '',
      language: event.language,
    });
    return true;
  }
  if (event.kind === 'parsed') {
    dispatch({ type: 'sessionArrived', session: event.session });
    return true;
  }
  if (event.kind === 'error') {
    if (!isErrorReason(event.reason)) return false;
    dispatch({
      type: 'errorArrived',
      reason: event.reason,
      retryAfterSec: event.retryAfterSec,
      detectedLanguage: event.reason === 'language-unsupported' ? event.message : undefined,
    });
    return true;
  }
  return false;
}

async function extractErrorReason(
  response: Response,
): Promise<{ reason: ErrorReason; retryAfterSec?: number }> {
  try {
    const text = await response.text();
    const firstLine = text.split('\n').find((line) => line.trim());
    if (firstLine) {
      const parsed = JSON.parse(firstLine) as Partial<ServerErrorEvent> & {
        [k: string]: unknown;
      };
      if (parsed.kind === 'error' && isErrorReason(parsed.reason)) {
        const retryAfterSec =
          typeof parsed.retryAfterSec === 'number' ? parsed.retryAfterSec : undefined;
        return { reason: parsed.reason, retryAfterSec };
      }
    }
  } catch {
    // fall through
  }
  // Map known HTTP statuses to a best-guess reason.
  if (response.status === 429) return { reason: 'rate-limited' };
  if (response.status === 413) return { reason: 'upload-too-large' };
  if (response.status === 403) return { reason: 'origin-not-allowed' };
  if (response.status === 405) return { reason: 'method-not-allowed' };
  if (response.status === 400) return { reason: 'upload-empty' };
  return { reason: 'network-error' };
}

function isAbortError(err: unknown): boolean {
  // DOMException in some runtimes doesn't extend Error; check by shape.
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError';
}
