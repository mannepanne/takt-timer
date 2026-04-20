import { describe, expect, it, vi } from 'vitest';

import { extractJsonObject, parseWithLlama } from './llama';

function makeAi(responses: string[], opts: { throwOnCall?: number } = {}) {
  const queue = [...responses];
  let calls = 0;
  const run = vi.fn(async () => {
    calls += 1;
    if (opts.throwOnCall === calls) throw new Error(`AI error on call ${calls}`);
    const next = queue.shift();
    if (next === undefined) return { response: '' };
    return { response: next };
  });
  return { ai: { run } as unknown as Ai, getCallCount: () => calls };
}

describe('extractJsonObject', () => {
  it('returns null when no opening brace is present', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });

  it('extracts a simple object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('strips prose before and after the object', () => {
    expect(extractJsonObject('Here is the JSON: {"a":1} thanks!')).toBe('{"a":1}');
  });

  it('handles nested objects to the correct depth', () => {
    expect(extractJsonObject('{"outer":{"inner":2}}')).toBe('{"outer":{"inner":2}}');
  });

  it('ignores braces inside string values', () => {
    expect(extractJsonObject('{"msg":"hello { world }"}')).toBe('{"msg":"hello { world }"}');
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJsonObject('{"q":"she said \\"hi\\""}')).toBe('{"q":"she said \\"hi\\""}');
  });

  it('handles escaped backslashes before quotes', () => {
    // Path-like string: "C:\\folder\\"
    const input = '{"p":"C:\\\\folder\\\\"}';
    expect(extractJsonObject(input)).toBe(input);
  });

  it('returns null for unbalanced braces', () => {
    expect(extractJsonObject('{"broken":')).toBeNull();
    expect(extractJsonObject('{"a":{"b":1}')).toBeNull();
  });

  it('extracts only the first balanced object when multiple are concatenated', () => {
    expect(extractJsonObject('{"first":1}{"second":2}')).toBe('{"first":1}');
  });
});

describe('parseWithLlama', () => {
  it('returns ok on a valid first-call session', async () => {
    const { ai } = makeAi(['{"sets":3,"workSec":60,"restSec":30}']);
    const result = await parseWithLlama(ai, 'three sets of one minute, 30 seconds rest');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual({ sets: 3, workSec: 60, restSec: 30 });
    }
  });

  it('returns not-a-session on first-call error object (no retry)', async () => {
    const { ai, getCallCount } = makeAi(['{"error":"not-a-session"}']);
    const result = await parseWithLlama(ai, 'banana kayak');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-a-session');
    }
    expect(getCallCount()).toBe(1); // Fast path — no retry on a valid error object.
  });

  it('retries with repair prompt when first output is malformed, succeeds second', async () => {
    const { ai, getCallCount } = makeAi([
      'here is the json: {not valid',
      '{"sets":5,"workSec":45,"restSec":15}',
    ]);
    const result = await parseWithLlama(ai, 'five rounds of 45s with 15s rest');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual({ sets: 5, workSec: 45, restSec: 15 });
    }
    expect(getCallCount()).toBe(2);
  });

  it('returns schema-failed when both attempts fail validation', async () => {
    const { ai, getCallCount } = makeAi(['still not json', 'also not json']);
    const result = await parseWithLlama(ai, 'gibberish input');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema-failed');
    }
    expect(getCallCount()).toBe(2);
  });

  it('returns not-a-session when the retry produces a valid error object', async () => {
    const { ai, getCallCount } = makeAi(['garbage first output', '{"error":"not-a-session"}']);
    const result = await parseWithLlama(ai, 'still nonsense');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-a-session');
    }
    expect(getCallCount()).toBe(2);
  });

  it('returns model-error when the first Llama call throws', async () => {
    const { ai } = makeAi([], { throwOnCall: 1 });
    const result = await parseWithLlama(ai, 'anything');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('model-error');
    }
  });

  it('returns model-error when the retry Llama call throws', async () => {
    const { ai } = makeAi(['malformed'], { throwOnCall: 2 });
    const result = await parseWithLlama(ai, 'anything');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('model-error');
    }
  });

  it('clamps zod violations via schema (out-of-range sets rejected)', async () => {
    const { ai } = makeAi([
      '{"sets":9999,"workSec":60,"restSec":30}',
      '{"sets":9999,"workSec":60,"restSec":30}',
    ]);
    const result = await parseWithLlama(ai, 'adversarial transcript');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema-failed');
    }
  });

  it('calls the retry with bumped temperature and an assistant turn carrying the bad output', async () => {
    let call = 0;
    const runFn = vi.fn(async (_model: string, input: unknown) => {
      call += 1;
      if (call === 1) {
        expect((input as { temperature?: number }).temperature).toBe(0);
        return { response: 'bad output' };
      }
      expect((input as { temperature?: number }).temperature).toBe(0.3);
      const msgs =
        (input as { messages?: Array<{ role: string; content: string }> }).messages ?? [];
      const assistantTurn = msgs.find((m) => m.role === 'assistant');
      expect(assistantTurn?.content).toBe('bad output');
      return { response: '{"sets":3,"workSec":60,"restSec":30}' };
    });
    const ai = { run: runFn } as unknown as Ai;
    const result = await parseWithLlama(ai, 'transcript');
    expect(result.ok).toBe(true);
  });

  it('accepts the AI binding returning a bare string instead of { response }', async () => {
    const ai = {
      run: vi.fn(async () => '{"sets":2,"workSec":120,"restSec":60}'),
    } as unknown as Ai;
    const result = await parseWithLlama(ai, 'two sets of two minutes, one minute rest');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session).toEqual({ sets: 2, workSec: 120, restSec: 60 });
    }
  });
});
