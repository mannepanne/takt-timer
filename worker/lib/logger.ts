// ABOUT: Structured request logging for Cloudflare Workers.
// ABOUT: Emits JSON lines via console.log — picked up by Cloudflare Logs / Logpush.

export interface RequestLog {
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  authenticated?: boolean;
  rateLimited?: boolean;
  errorKind?: string;
  whisperMs?: number;
  llamaMs?: number;
}

export function logRequest(fields: RequestLog): void {
  try {
    console.log(JSON.stringify({ ts: Date.now(), ...fields }));
  } catch {
    // Never let logging blow up a request.
  }
}
