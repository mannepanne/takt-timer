// ABOUT: Whisper-turbo wrapper on Cloudflare Workers AI.
// ABOUT: Spike-scope shape: accepts raw audio bytes, returns { text, language, latencyMs }.

type WhisperResult = {
  text: string;
  language?: string;
  latencyMs: number;
};

type WhisperInput = {
  audio: number[];
};

type WhisperResponse = {
  text?: string;
  language?: string;
  transcription_info?: { language?: string };
};

type AiRunner = { run: (model: string, input: unknown) => Promise<unknown> };

export async function transcribe(ai: Ai, audio: Uint8Array): Promise<WhisperResult> {
  const input: WhisperInput = { audio: Array.from(audio) };
  const started = performance.now();
  const raw = await (ai as unknown as AiRunner).run('@cf/openai/whisper-large-v3-turbo', input);
  const latencyMs = Math.round(performance.now() - started);
  const response = (raw ?? {}) as WhisperResponse;
  const text = (response.text ?? '').trim();
  const language = response.language ?? response.transcription_info?.language ?? undefined;
  return { text, language, latencyMs };
}
