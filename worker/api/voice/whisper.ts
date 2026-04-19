// ABOUT: Whisper-turbo wrapper on Cloudflare Workers AI.
// ABOUT: Spike-scope shape: accepts raw audio bytes, returns { text, language, latencyMs }.

type WhisperResult = {
  text: string;
  language?: string;
  latencyMs: number;
};

type WhisperResponse = {
  text?: string;
  language?: string;
  transcription_info?: { language?: string };
};

type AiRunner = { run: (model: string, input: unknown) => Promise<unknown> };

export async function transcribe(ai: Ai, audio: Uint8Array): Promise<WhisperResult> {
  // Workers AI's whisper-large-v3-turbo accepts `audio` as base64-encoded audio bytes
  // per the model's JSON-mode schema. `btoa` cannot take a Uint8Array directly, so we
  // build the binary string chunk-by-chunk to avoid stack overflow on large clips.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < audio.byteLength; i += chunkSize) {
    const chunk = audio.subarray(i, Math.min(i + chunkSize, audio.byteLength));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);
  const input = { audio: base64 };
  const started = performance.now();
  const raw = await (ai as unknown as AiRunner).run('@cf/openai/whisper-large-v3-turbo', input);
  const latencyMs = Math.round(performance.now() - started);
  const response = (raw ?? {}) as WhisperResponse;
  const text = (response.text ?? '').trim();
  const language = response.language ?? response.transcription_info?.language ?? undefined;
  return { text, language, latencyMs };
}
