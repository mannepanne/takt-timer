// ABOUT: Workers AI Llama wrapper. Sends transcript → structured session JSON.
// ABOUT: One-shot zod-validated call; retries once with a repair prompt at a bumped temperature
// ABOUT: if the first attempt fails schema.

import { z } from 'zod';

const MODEL = '@cf/meta/llama-3.2-3b-instruct';

const SessionSchema = z.object({
  sets: z.number().int().min(1).max(99),
  workSec: z.number().int().min(5).max(3600),
  restSec: z.number().int().min(0).max(3600),
});

const ErrorSchema = z.object({
  error: z.string().min(1),
});

const ResponseSchema = z.union([SessionSchema, ErrorSchema]);

export type ParsedSession = z.infer<typeof SessionSchema>;
export type ParseError = z.infer<typeof ErrorSchema>;

export type LlamaResult =
  | { ok: true; session: ParsedSession; latencyMs: number; rawOutput: string }
  | {
      ok: false;
      reason: 'model-error' | 'not-a-session' | 'schema-failed';
      message: string;
      latencyMs: number;
      rawOutput?: string;
    };

type AiRunner = { run: (model: string, input: unknown) => Promise<unknown> };

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `You convert interval-timer session commands to JSON.

Output ONLY a JSON object — no prose, no markdown, no code fences, no explanation.

For a valid interval session command, output:
{"sets": <integer 1-99>, "workSec": <integer 5-3600>, "restSec": <integer 0-3600>}

If the input doesn't describe a valid interval session, output:
{"error": "not-a-session"}

Rules:
- workSec is the work duration of each set in SECONDS (convert minutes, "one minute" = 60).
- restSec is the REST between sets in seconds (0 if none mentioned).
- "half a minute" = 30 seconds, "quarter of a minute" = 15.
- Swedish numerals: ett=1, två=2, tre=3, fyra=4, fem=5, sex=6, sju=7, åtta=8, nio=9, tio=10, tjugo=20, trettio=30, fyrtio=40, femtio=50, sextio=60, sjuttio=70, åttio=80, nittio=90. Compounds: trettiofem=35, fyrtiofem=45, etc.
- Swedish units: minut/minuter=minutes, sekund/sekunder=seconds, vila/paus=rest, set/omgång(ar)=sets.

Examples:
Input: "Three sets of one minute each, thirty seconds rest between each"
Output: {"sets":3,"workSec":60,"restSec":30}

Input: "5 rounds of 45 seconds with 15 seconds rest"
Output: {"sets":5,"workSec":45,"restSec":15}

Input: "Give me three rounds at a minute with half a minute rest"
Output: {"sets":3,"workSec":60,"restSec":30}

Input: "Tre set om en minut vardera, trettio sekunders vila mellan varje"
Output: {"sets":3,"workSec":60,"restSec":30}

Input: "Fem set om fyrtiofem sekunder och femton sekunder vila"
Output: {"sets":5,"workSec":45,"restSec":15}

Input: "banana kayak helicopter"
Output: {"error":"not-a-session"}`;

/** Extract the first balanced JSON object from a string. Exported for direct unit testing. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

type AiChatResponse = { response?: string } | string;

async function runLlama(
  ai: Ai,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<{ rawOutput: string; latencyMs: number }> {
  const started = performance.now();
  const raw = await (ai as unknown as AiRunner).run(MODEL, {
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 128,
  });
  const latencyMs = Math.round(performance.now() - started);
  const response = raw as AiChatResponse;
  const text = typeof response === 'string' ? response : (response.response ?? '');
  return { rawOutput: text, latencyMs };
}

function validate(rawOutput: string): z.infer<typeof ResponseSchema> | null {
  const jsonText = extractJsonObject(rawOutput);
  if (!jsonText) return null;
  try {
    const obj = JSON.parse(jsonText);
    const result = ResponseSchema.safeParse(obj);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function parseWithLlama(ai: Ai, transcript: string): Promise<LlamaResult> {
  // First attempt: temperature 0, plain prompt.
  const firstMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: transcript },
  ];

  let firstCall;
  try {
    firstCall = await runLlama(ai, firstMessages, { temperature: 0 });
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { ok: false, reason: 'model-error', message, latencyMs: 0 };
  }

  const firstValid = validate(firstCall.rawOutput);
  if (firstValid) {
    if ('error' in firstValid) {
      return {
        ok: false,
        reason: 'not-a-session',
        message: firstValid.error,
        latencyMs: firstCall.latencyMs,
        rawOutput: firstCall.rawOutput,
      };
    }
    return {
      ok: true,
      session: firstValid,
      latencyMs: firstCall.latencyMs,
      rawOutput: firstCall.rawOutput,
    };
  }

  // Retry with a repair-style prompt + bumped temperature.
  const retryMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: transcript },
    { role: 'assistant', content: firstCall.rawOutput },
    {
      role: 'user',
      content:
        'Your previous reply was not valid JSON matching the schema. Respond with ONLY the JSON object, nothing else.',
    },
  ];

  let secondCall;
  try {
    secondCall = await runLlama(ai, retryMessages, { temperature: 0.3 });
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return {
      ok: false,
      reason: 'model-error',
      message,
      latencyMs: firstCall.latencyMs,
      rawOutput: firstCall.rawOutput,
    };
  }

  const secondValid = validate(secondCall.rawOutput);
  const totalMs = firstCall.latencyMs + secondCall.latencyMs;
  if (secondValid) {
    if ('error' in secondValid) {
      return {
        ok: false,
        reason: 'not-a-session',
        message: secondValid.error,
        latencyMs: totalMs,
        rawOutput: secondCall.rawOutput,
      };
    }
    return {
      ok: true,
      session: secondValid,
      latencyMs: totalMs,
      rawOutput: secondCall.rawOutput,
    };
  }

  return {
    ok: false,
    reason: 'schema-failed',
    message: 'Llama output did not validate after retry',
    latencyMs: totalMs,
    rawOutput: secondCall.rawOutput,
  };
}
