import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { VoiceOverlay } from './VoiceOverlay';
import type { VoiceState } from '@/lib/voice/types';

function renderOverlay(state: VoiceState) {
  const onUserStop = vi.fn();
  const onCancel = vi.fn();
  const onRetry = vi.fn();
  const utils = render(
    <MemoryRouter>
      <VoiceOverlay state={state} onUserStop={onUserStop} onCancel={onCancel} onRetry={onRetry} />
    </MemoryRouter>,
  );
  return { ...utils, onUserStop, onCancel, onRetry };
}

describe('VoiceOverlay', () => {
  it('renders nothing when idle', () => {
    const { container } = renderOverlay({ phase: 'idle' });
    expect(container.firstChild).toBeNull();
  });

  it('requesting-permission shows the requesting copy and a pulse indicator', () => {
    renderOverlay({ phase: 'requesting-permission' });
    expect(screen.getByText(/requesting microphone/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('listening state shows a stop button that fires onUserStop', async () => {
    const { onUserStop } = renderOverlay({ phase: 'listening', startedAtMs: 0 });
    const stopBtn = screen.getByRole('button', { name: /stop recording/i });
    await userEvent.click(stopBtn);
    expect(onUserStop).toHaveBeenCalled();
  });

  it('parsing state displays the transcript with an aria-live region', () => {
    renderOverlay({ phase: 'parsing', transcript: 'three sets of one minute', language: 'en' });
    const transcript = screen.getByText(/three sets of one minute/);
    expect(transcript).toBeInTheDocument();
    expect(transcript.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });

  it('language-mismatch shows the documented copy and a Configure CTA', () => {
    renderOverlay({ phase: 'language-mismatch', detected: 'fr' });
    expect(screen.getByText(/takt currently understands english and swedish/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configure manually/i })).toHaveAttribute(
      'href',
      '/configure',
    );
  });

  it('language-mismatch echoes transcript when one is present', () => {
    renderOverlay({ phase: 'language-mismatch', detected: 'fr', transcript: 'bonjour le monde' });
    expect(screen.getByText(/bonjour le monde/)).toBeInTheDocument();
  });

  it('rate-limited shows the UTC-safe copy (no "tomorrow")', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 3600 });
    expect(screen.getByText(/today\u2019s voice allowance/i)).toBeInTheDocument();
    expect(screen.queryByText(/tomorrow/i)).not.toBeInTheDocument();
  });

  it('rate-limited formats retryAfterSec \u2265 2h as hours', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 4 * 3600 });
    expect(screen.getByText(/try again in 4 hours/i)).toBeInTheDocument();
  });

  it('rate-limited formats sub-hour retryAfterSec as minutes', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 12 * 60 });
    expect(screen.getByText(/try again in 12 minutes/i)).toBeInTheDocument();
  });

  it('rate-limited uses singular "minute" when totalMinutes === 1', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 60 });
    expect(screen.getByText(/try again in 1 minute\b/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 minutes/i)).not.toBeInTheDocument();
  });

  it('rate-limited formats 61\u2013119min as minutes, not "2 hours" (avoids over-promise)', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 75 * 60 });
    expect(screen.getByText(/try again in 75 minutes/i)).toBeInTheDocument();
    expect(screen.queryByText(/try again in 2 hours/i)).not.toBeInTheDocument();
  });

  it('rate-limited handles retryAfterSec=0 without a misleading time hint', () => {
    renderOverlay({ phase: 'rate-limited', retryAfterSec: 0 });
    expect(screen.getByText(/today\u2019s voice allowance/i)).toBeInTheDocument();
    expect(screen.queryByText(/try again in/i)).not.toBeInTheDocument();
  });

  it('parse-error with reason=not-a-session shows the distinct copy', () => {
    renderOverlay({ phase: 'parse-error', reason: 'not-a-session', transcript: 'banana kayak' });
    expect(screen.getByText(/couldn\u2019t make a session from that/i)).toBeInTheDocument();
    // Transcript is echoed so the user sees what Whisper heard
    expect(screen.getByText(/banana kayak/)).toBeInTheDocument();
  });

  // Exhaustive over the fall-through arm of `parseErrorCopy` so the switch's
  // case-label branches are all hit at runtime. Adding a new ErrorReason
  // forces a switch update; this list catches the test-side companion drift.
  it.each([
    'upload-empty',
    'upload-too-large',
    'origin-not-allowed',
    'empty-transcript',
    'language-unsupported',
    'whisper-error',
    'llama-error',
    'schema-failed',
    'method-not-allowed',
    'rate-limited',
    'network-error',
    'malformed-stream',
  ] as const)('parse-error with reason=%s shows the generic couldn\u2019t build copy', (reason) => {
    renderOverlay({ phase: 'parse-error', reason });
    expect(screen.getByText(/couldn\u2019t build a session from that/i)).toBeInTheDocument();
  });

  it('parse-error with reason=cold-start-timeout shows the distinct timeout copy', () => {
    renderOverlay({ phase: 'parse-error', reason: 'cold-start-timeout' });
    expect(screen.getByText(/voice took longer than expected/i)).toBeInTheDocument();
  });

  it('error-state dialog has aria-describedby pointing at the body paragraph', () => {
    renderOverlay({ phase: 'offline' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'voice-overlay-body');
    expect(document.getElementById('voice-overlay-body')).toBeInTheDocument();
  });

  it('non-error dialog does not carry aria-describedby', () => {
    renderOverlay({ phase: 'listening', startedAtMs: 0 });
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('clicking retry from an error state fires onRetry', async () => {
    const { onRetry } = renderOverlay({ phase: 'offline' });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('Cancel button fires onCancel from any active state', async () => {
    const { onCancel } = renderOverlay({ phase: 'listening', startedAtMs: 0 });
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('browser-unsupported shows the documented copy', () => {
    renderOverlay({ phase: 'browser-unsupported' });
    expect(screen.getByText(/this browser doesn\u2019t support voice input/i)).toBeInTheDocument();
  });

  it('permission-denied shows the single uniform copy (no browser-settings instructions)', () => {
    renderOverlay({ phase: 'permission-denied' });
    expect(screen.getByText(/microphone access is blocked/i)).toBeInTheDocument();
    expect(screen.queryByText(/browser settings/i)).not.toBeInTheDocument();
  });

  it('transcribing and uploading states show spinners (no transcript yet)', () => {
    const { rerender } = renderOverlay({ phase: 'uploading', blob: new Blob() });
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <VoiceOverlay
          state={{ phase: 'transcribing' }}
          onUserStop={vi.fn()}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
  });

  it('focuses the Cancel button when an error state arrives', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <VoiceOverlay
          state={{ phase: 'listening', startedAtMs: 0 }}
          onUserStop={vi.fn()}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <VoiceOverlay
          state={{ phase: 'parse-error', reason: 'not-a-session' }}
          onUserStop={vi.fn()}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    expect(document.activeElement).toBe(cancelBtn);
  });
});
