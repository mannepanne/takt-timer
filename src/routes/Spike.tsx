// ABOUT: Temporary `/spike` route for the Phase 3 spike.
// ABOUT: Records audio on a phone, POSTs to /api/voice/parse, reads the streaming NDJSON
// ABOUT: response — shows the Whisper transcript as soon as it arrives, then updates with
// ABOUT: the Llama-parsed session (or error) when the second event lands. Used to measure
// ABOUT: perceived latency and accuracy on real phrasings. NOT part of the shipped app
// ABOUT: surface — removed when Phase 3 proper lands the real voice UI.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { TopBar } from '@/components/TopBar';

type WhisperEvent = {
  kind: 'whisper';
  transcript: string;
  language?: string;
  whisperMs: number;
};

type ParsedEvent = {
  kind: 'parsed';
  session: { sets: number; workSec: number; restSec: number };
  llamaMs: number;
  totalMs: number;
  rawOutput?: string;
};

type ErrorEvent = {
  kind: 'error';
  reason: string;
  message?: string;
  totalMs?: number;
};

type StreamEvent = WhisperEvent | ParsedEvent | ErrorEvent;

type Attempt = {
  id: number;
  durationMs: number;
  uploadBytes: number;
  mimeType: string;
  whisper?: WhisperEvent;
  parsed?: ParsedEvent;
  error?: ErrorEvent;
  clientError?: string;
  perceivedTranscriptMs?: number;
  perceivedParsedMs?: number;
};

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function mediaRecorderAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

function supportedMimeTypes(): string[] {
  if (!mediaRecorderAvailable()) return [];
  return MIME_CANDIDATES.filter((c) => {
    try {
      return MediaRecorder.isTypeSupported(c);
    } catch {
      return false;
    }
  });
}

function bestMime(): string {
  const supported = supportedMimeTypes();
  return supported[0] ?? '';
}

export function Spike() {
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'uploading'>('idle');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [counter, setCounter] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mrAvailable = mediaRecorderAvailable();
  const supported = supportedMimeTypes();
  const mimeType = bestMime();

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const start = async () => {
    setErrorBanner(null);
    if (!mimeType) {
      setErrorBanner('No supported MediaRecorder MIME type — try a different browser.');
      return;
    }
    setState('requesting');

    // iOS: if audioSession is in a playback-only mode (Phase 2's 'ambient' default), the
    // subsequent getUserMedia call fails with InvalidStateError. Switch to a category
    // that permits capture before asking for the mic.
    type NavAudioSession = { type: 'ambient' | 'playback' | 'play-and-record' | 'auto' };
    const nav = navigator as Navigator & { audioSession?: NavAudioSession };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'play-and-record';
      } catch {
        // Non-fatal; some platforms ignore the assignment.
      }
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setErrorBanner(`getUserMedia failed — ${msg}`);
      setState('idle');
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setErrorBanner(`MediaRecorder construction failed — ${msg}`);
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setState('idle');
      return;
    }

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onerror = (e) => {
      const err = (e as unknown as { error?: Error }).error;
      const msg = err ? `${err.name}: ${err.message}` : 'MediaRecorder error';
      setErrorBanner(msg);
    };
    rec.onstop = () => {
      void finishUpload();
    };
    recorderRef.current = rec;
    recordStartRef.current = performance.now();
    rec.start();
    setState('recording');
    timeoutRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    }, 8000);
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

    const id = counter;
    setCounter((c) => c + 1);
    setAttempts((prev) => [{ id, durationMs, uploadBytes: blob.size, mimeType }, ...prev]);

    const uploadStarted = performance.now();

    try {
      const res = await fetch('/api/voice/parse', {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': mimeType || 'application/octet-stream' },
      });

      if (!res.body) {
        patchAttempt(id, { clientError: `HTTP ${res.status}: no response body` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          let newlineAt = buffer.indexOf('\n');
          while (newlineAt !== -1) {
            const line = buffer.slice(0, newlineAt).trim();
            buffer = buffer.slice(newlineAt + 1);
            if (line) {
              applyStreamLine(id, line, uploadStarted);
            }
            newlineAt = buffer.indexOf('\n');
          }
        }
      }
      const tail = buffer.trim();
      if (tail) applyStreamLine(id, tail, uploadStarted);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      patchAttempt(id, { clientError: msg });
    } finally {
      setState('idle');
    }
  };

  const patchAttempt = (id: number, patch: Partial<Attempt>) => {
    setAttempts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const applyStreamLine = (id: number, line: string, uploadStarted: number) => {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      patchAttempt(id, { clientError: `Malformed stream line: ${line.slice(0, 120)}` });
      return;
    }
    const elapsed = Math.round(performance.now() - uploadStarted);
    if (event.kind === 'whisper') {
      patchAttempt(id, { whisper: event, perceivedTranscriptMs: elapsed });
    } else if (event.kind === 'parsed') {
      patchAttempt(id, { parsed: event, perceivedParsedMs: elapsed });
    } else {
      patchAttempt(id, { error: event, perceivedParsedMs: elapsed });
    }
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
        <h1 className="spike-title">Voice bake-off (streaming)</h1>
        <p className="spike-subtitle">
          Tap the button and speak a session command. We&rsquo;ll record up to 8 seconds, stream
          through Whisper → Llama, and show the transcript the moment it arrives, then the parsed
          session a beat later.
        </p>

        <details className="spike-diag">
          <summary>Browser diagnostics</summary>
          <dl className="spike-kv">
            <dt>MediaRecorder</dt>
            <dd>{mrAvailable ? 'available' : 'NOT available'}</dd>
            <dt>Chosen MIME</dt>
            <dd>{mimeType || '(none)'}</dd>
            <dt>All supported</dt>
            <dd>{supported.length ? supported.join(', ') : '(none)'}</dd>
            <dt>User-Agent</dt>
            <dd>{typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}</dd>
          </dl>
        </details>

        {!mrAvailable && (
          <p className="spike-warning">
            Your browser doesn&rsquo;t expose <code>MediaRecorder</code>. Try Chrome on Android or
            Safari 14.5+ on iOS.
          </p>
        )}
        {mrAvailable && !mimeType && (
          <p className="spike-warning">
            <code>MediaRecorder</code> exists but none of our audio MIME candidates are supported.
            Try a different browser.
          </p>
        )}
        {errorBanner && <p className="spike-warning">{errorBanner}</p>}

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
                <span>{(a.uploadBytes / 1024).toFixed(1)} KB</span>
                <span>{a.mimeType}</span>
              </header>
              <AttemptBody attempt={a} />
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function AttemptBody({ attempt }: { attempt: Attempt }) {
  const { whisper, parsed, error, clientError, perceivedTranscriptMs, perceivedParsedMs } = attempt;

  return (
    <>
      {whisper && (
        <p className="spike-transcript">
          &ldquo;{whisper.transcript || '(empty)'}&rdquo;{' '}
          {whisper.language && <span className="spike-lang">({whisper.language})</span>}
        </p>
      )}

      {!whisper && !error && !clientError && (
        <p className="spike-hint">Listening for transcript…</p>
      )}

      {parsed && (
        <dl className="spike-kv">
          <dt>sets</dt>
          <dd>{parsed.session.sets}</dd>
          <dt>work</dt>
          <dd>{parsed.session.workSec}s</dd>
          <dt>rest</dt>
          <dd>{parsed.session.restSec}s</dd>
          <dt>Whisper</dt>
          <dd>{whisper?.whisperMs ?? '?'} ms</dd>
          <dt>Llama</dt>
          <dd>{parsed.llamaMs} ms</dd>
          <dt>server total</dt>
          <dd>{parsed.totalMs} ms</dd>
          <dt>time-to-transcript</dt>
          <dd>{perceivedTranscriptMs ?? '?'} ms</dd>
          <dt>time-to-session</dt>
          <dd>{perceivedParsedMs ?? '?'} ms</dd>
        </dl>
      )}

      {error && (
        <>
          <p className="spike-error">Failed: {error.reason}</p>
          {error.message && <p className="spike-error-detail">{error.message}</p>}
          {(whisper || error.totalMs !== undefined) && (
            <dl className="spike-kv">
              {whisper && (
                <>
                  <dt>Whisper</dt>
                  <dd>{whisper.whisperMs} ms</dd>
                </>
              )}
              {error.totalMs !== undefined && (
                <>
                  <dt>server total</dt>
                  <dd>{error.totalMs} ms</dd>
                </>
              )}
            </dl>
          )}
        </>
      )}

      {clientError && <p className="spike-error-detail">Client error: {clientError}</p>}
    </>
  );
}
