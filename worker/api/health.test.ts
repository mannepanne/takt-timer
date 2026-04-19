import { describe, expect, it } from 'vitest';

import { health } from './health';

describe('GET /api/health', () => {
  it('returns a JSON payload with ok=true', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('takt');
  });
});
