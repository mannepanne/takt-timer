// ABOUT: NDJSON line reader over a ReadableStream of bytes.
// ABOUT: Yields one JSON-parsed object per newline-terminated line. Handles chunk boundaries
// ABOUT: that split lines, trailing lines without a final newline, and empty/whitespace lines.

export type StreamLine<T> = { ok: true; value: T } | { ok: false; raw: string; error: unknown };

/**
 * Reads an NDJSON stream line-by-line. Each successfully parsed line is yielded as
 * `{ ok: true, value }`; malformed lines as `{ ok: false, raw, error }` so the caller can
 * decide whether to ignore them or surface as a stream-level error.
 */
export async function* readNdjsonStream<T = unknown>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamLine<T>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let streamClosed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        streamClosed = true;
        break;
      }
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });

      let newlineAt = buffer.indexOf('\n');
      while (newlineAt !== -1) {
        const rawLine = buffer.slice(0, newlineAt).trim();
        buffer = buffer.slice(newlineAt + 1);
        if (rawLine) yield parseLine<T>(rawLine);
        newlineAt = buffer.indexOf('\n');
      }
    }
  } finally {
    // If the consumer bailed early (early return, throw), actively cancel the underlying
    // stream so the network layer stops buffering. If the stream closed naturally, just
    // release the lock.
    if (!streamClosed) {
      try {
        await reader.cancel();
      } catch {
        // best effort
      }
    }
    reader.releaseLock();
  }

  // Flush the decoder and any trailing line without a terminating newline.
  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail) yield parseLine<T>(tail);
}

function parseLine<T>(raw: string): StreamLine<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return { ok: false, raw, error };
  }
}
