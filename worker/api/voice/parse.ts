// ABOUT: POST /api/voice/parse — spike-scope endpoint.
// ABOUT: Accepts audio bytes → Whisper → parser → { session, transcript, language, source, latencies }.
// ABOUT: No Llama fallback and no rate limiting yet — those land with Phase 3 proper.

import type { Env } from '../../index';

import { parseSession, type ParsedSession } from './parse-session';
import { transcribe } from './whisper';

type SpikeResponse =
  | {
      ok: true;
      session: { sets: number; workSec: number; restSec: number };
      transcript: string;
      language?: string;
      source: 'parser' | 'llama' | 'none';
      confidence: ParsedSession['confidence'];
      latencies: {
        whisperMs: number;
        parserMs: number;
        totalMs: number;
      };
    }
  | {
      ok: false;
      reason: 'empty-transcript' | 'language-unsupported' | 'parser-miss' | 'upload-empty';
      transcript?: string;
      language?: string;
      latencies?: { whisperMs: number; parserMs: number; totalMs: number };
    };

const SUPPORTED_LANGUAGES = new Set(['en', 'sv']);

export async function parseVoice(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, reason: 'method-not-allowed' }, { status: 405 });
  }

  const startedAt = performance.now();
  const audioBytes = new Uint8Array(await request.arrayBuffer());
  if (audioBytes.byteLength < 500) {
    const body: SpikeResponse = { ok: false, reason: 'upload-empty' };
    return Response.json(body, { status: 400 });
  }

  const whisper = await transcribe(env.AI, audioBytes);
  const transcript = whisper.text;
  const language = whisper.language?.toLowerCase();

  if (!transcript) {
    const body: SpikeResponse = {
      ok: false,
      reason: 'empty-transcript',
      language,
      latencies: {
        whisperMs: whisper.latencyMs,
        parserMs: 0,
        totalMs: Math.round(performance.now() - startedAt),
      },
    };
    return Response.json(body, { status: 422 });
  }

  if (language && !SUPPORTED_LANGUAGES.has(language)) {
    const body: SpikeResponse = {
      ok: false,
      reason: 'language-unsupported',
      transcript,
      language,
      latencies: {
        whisperMs: whisper.latencyMs,
        parserMs: 0,
        totalMs: Math.round(performance.now() - startedAt),
      },
    };
    return Response.json(body, { status: 422 });
  }

  const parserStarted = performance.now();
  const parsed = parseSession(transcript);
  const parserMs = Math.round(performance.now() - parserStarted);

  if (parsed.confidence === 'none') {
    // Spike scope: no Llama fallback wired yet. Report the miss.
    const body: SpikeResponse = {
      ok: false,
      reason: 'parser-miss',
      transcript,
      language,
      latencies: {
        whisperMs: whisper.latencyMs,
        parserMs,
        totalMs: Math.round(performance.now() - startedAt),
      },
    };
    return Response.json(body, { status: 422 });
  }

  const body: SpikeResponse = {
    ok: true,
    session: {
      sets: parsed.sets,
      workSec: parsed.workSec,
      restSec: parsed.restSec,
    },
    transcript,
    language,
    source: 'parser',
    confidence: parsed.confidence,
    latencies: {
      whisperMs: whisper.latencyMs,
      parserMs,
      totalMs: Math.round(performance.now() - startedAt),
    },
  };
  return Response.json(body);
}
