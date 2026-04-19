// ABOUT: Temporary `/spike` route for the Phase 3 spike.
// ABOUT: Records audio on a phone, POSTs to /api/voice/parse, shows transcript + parser
// ABOUT: result + latency timings. Used to measure Whisper cold/warm latency and parser
// ABOUT: coverage on real phrasings. NOT part of the shipped app surface — removed when
// ABOUT: Phase 3 proper lands the real voice UI.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { TopBar } from '@/components/TopBar';

type SpikeOk = {
  ok: true;
  session: { sets: number; workSec: number; restSec: number };
  transcript: string;
  language?: string;
  source: 'parser' | 'llama' | 'none';
  confidence: 'high' | 'low' | 'none';
  latencies: { whisperMs: number; parserMs: number; totalMs: number };
};

type SpikeErr = {
  ok: false;
  reason: string;
  transcript?: string;
  language?: string;
  latencies?: { whisperMs: number; parserMs: number; totalMs: number };
};

type SpikeResponse = SpikeOk | SpikeErr;

type Attempt = {
  id: number;
  durationMs: number;
  uploadBytes: number;
  result: SpikeResponse | { ok: false; reason: 'network'; message: string };
};

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

export function Spike() {
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'uploading'>('idle');
  const [mimeType] = useState<string>(() => pickMime());
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [counter, setCounter] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const start = async () => {
    if (!mimeType) return;
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void finishUpload();
      };
      recorderRef.current = rec;
      recordStartRef.current = performance.now();
      rec.start();
      setState('recording');
      // Hard 8s cap.
      timeoutRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }, 8000);
    } catch {
      setState('idle');
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const finishUpload = async () => {
    setState('uploading');
    const durationMs = Math.round(performance.now() - recordStartRef.current);
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    let result: Attempt['result'];
    try {
      const res = await fetch('/api/voice/parse', { method: 'POST', body: blob });
      result = (await res.json()) as SpikeResponse;
    } catch (err) {
      result = {
        ok: false,
        reason: 'network',
        message: err instanceof Error ? err.message : 'unknown',
      };
    }

    setAttempts((prev) => [{ id: counter, durationMs, uploadBytes: blob.size, result }, ...prev]);
    setCounter((c) => c + 1);
    setState('idle');
  };

  const label =
    state === 'idle'
      ? 'Start recording'
      : state === 'requesting'
        ? 'Requesting mic…'
        : state === 'recording'
          ? 'Stop recording'
          : 'Uploading…';

  return (
    <div className="screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label="Back to Home">
            ‹
          </Link>
        }
      />

      <main className="spike-body">
        <div className="eyebrow spike-eyebrow">Phase 3 spike</div>
        <h1 className="spike-title">Voice parser bake-off</h1>
        <p className="spike-subtitle">
          Tap the button and speak a session command. We&rsquo;ll record 8 seconds, send it to
          Whisper, run the deterministic parser, and show the transcript + parser result +
          latencies.
        </p>

        {!mimeType && (
          <p className="spike-warning">
            Your browser doesn&rsquo;t support <code>MediaRecorder</code>. Try Chrome, or Safari
            14.5+.
          </p>
        )}

        <div className="spike-controls">
          <button
            type="button"
            className="btn btn-primary spike-button"
            onClick={state === 'recording' ? stop : start}
            disabled={!mimeType || state === 'requesting' || state === 'uploading'}
          >
            {label}
          </button>
        </div>

        <div className="spike-log">
          {attempts.length === 0 && <p className="spike-hint">No attempts yet.</p>}
          {attempts.map((a) => (
            <article key={a.id} className="spike-attempt">
              <header className="spike-attempt-header">
                <span>#{a.id + 1}</span>
                <span>{a.durationMs} ms recorded</span>
                <span>{(a.uploadBytes / 1024).toFixed(1)} KB uploaded</span>
              </header>
              <AttemptBody result={a.result} />
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function AttemptBody({ result }: { result: Attempt['result'] }) {
  if (result.ok) {
    return (
      <>
        <p className="spike-transcript">
          &ldquo;{result.transcript}&rdquo;{' '}
          {result.language && <span className="spike-lang">({result.language})</span>}
        </p>
        <dl className="spike-kv">
          <dt>sets</dt>
          <dd>{result.session.sets}</dd>
          <dt>work</dt>
          <dd>{result.session.workSec}s</dd>
          <dt>rest</dt>
          <dd>{result.session.restSec}s</dd>
          <dt>source</dt>
          <dd>
            {result.source} ({result.confidence})
          </dd>
          <dt>Whisper</dt>
          <dd>{result.latencies.whisperMs} ms</dd>
          <dt>parser</dt>
          <dd>{result.latencies.parserMs} ms</dd>
          <dt>total</dt>
          <dd>{result.latencies.totalMs} ms</dd>
        </dl>
      </>
    );
  }
  const transcript = 'transcript' in result && result.transcript ? result.transcript : '';
  const language = 'language' in result ? result.language : undefined;
  return (
    <>
      {transcript && (
        <p className="spike-transcript">
          &ldquo;{transcript}&rdquo; {language && <span className="spike-lang">({language})</span>}
        </p>
      )}
      <p className="spike-error">Failed: {result.reason}</p>
      {'latencies' in result && result.latencies && (
        <dl className="spike-kv">
          <dt>Whisper</dt>
          <dd>{result.latencies.whisperMs} ms</dd>
          <dt>parser</dt>
          <dd>{result.latencies.parserMs} ms</dd>
          <dt>total</dt>
          <dd>{result.latencies.totalMs} ms</dd>
        </dl>
      )}
    </>
  );
}
