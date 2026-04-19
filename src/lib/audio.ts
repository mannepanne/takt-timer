// ABOUT: Web Audio wrapper. Single entry point prepareAudio() is idempotent and
// ABOUT: handles lazy-create, resume-from-suspended, and audio-session ambient category.

import type { BeepKind } from '@/lib/timer/types';

type AudioSession = { type: 'ambient' | 'playback' | 'auto' | 'play-and-record' };
type NavigatorWithAudioSession = Navigator & { audioSession?: AudioSession };

let context: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  try {
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
}

/**
 * Idempotent — safe to call from any first-gesture path (Start, Resume, visibility-visible,
 * last-session quick-start). Creates-or-resumes the AudioContext and asserts `audioSession` as
 * 'ambient' so beeps coexist with background music on iOS 16.4+.
 */
export function prepareAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithAudioSession) : null;
  if (nav?.audioSession) {
    try {
      nav.audioSession.type = 'ambient';
    } catch {
      // Best-effort; failing to set is never fatal.
    }
  }
}

type BeepProfile = { freq: number; dur: number; type: OscillatorType; vol: number };

const PROFILES: Record<BeepKind, BeepProfile> = {
  count: { freq: 660, dur: 0.08, type: 'sine', vol: 0.18 },
  pip: { freq: 880, dur: 0.08, type: 'sine', vol: 0.16 },
  'phase-work': { freq: 523, dur: 0.18, type: 'sine', vol: 0.22 },
  'phase-rest': { freq: 440, dur: 0.22, type: 'sine', vol: 0.2 },
  complete: { freq: 784, dur: 0.3, type: 'sine', vol: 0.24 },
};

/** Schedule a beep. Fails silently if audio is unavailable or muted. */
export function beep(kind: BeepKind): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const { freq, dur, type, vol } = PROFILES[kind];
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** For tests only — reset module state so a subsequent prepareAudio() creates a fresh context. */
export function __resetAudioForTest(): void {
  context = null;
  muted = false;
}
