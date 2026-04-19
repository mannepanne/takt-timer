// ABOUT: navigator.vibrate wrapper. Feature-detected — no-op on iOS (no Vibration API).

import type { HapticKind } from '@/lib/timer/types';

const PATTERNS: Record<HapticKind, number | number[]> = {
  start: 20,
  phase: 15,
  repeat: [10, 40, 10],
  resume: 10,
  complete: [30, 80, 30],
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw in iframes; silently ignore.
  }
}
