// ABOUT: Sanitises caught errors for the client-facing NDJSON error event body.
// ABOUT: Client sees fixed reason codes only; the detail goes to server logs.
// ABOUT: Contract documented in REFERENCE/decisions/2026-04-20-llama-primary-ndjson-streaming.md.

type LogContext = Record<string, string | number | undefined>;

export function toSafeErrorMessage(err: unknown, reason: string, context: LogContext = {}): void {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const entry = { reason, detail, ...context };
  // Workers runtime surfaces console.error in wrangler tail and the Cloudflare dashboard.
  console.error('[voice]', JSON.stringify(entry));
}
