// ABOUT: Tests for the native voice hook — the async capture orchestration (availability →
// ABOUT: permission → recognise) dispatched through the reducer, and the navigate/settings effects.
// ABOUT: recognizer.ts is mocked; the transcript → session routing itself lives in machine-native.

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const isRecognitionAvailable = vi.fn();
const ensurePermission = vi.fn();
const recognizeOnce = vi.fn();
const stopRecognition = vi.fn();
const openAppSettings = vi.fn();
vi.mock('@/lib/voice-local/recognizer', () => ({
  isRecognitionAvailable: () => isRecognitionAvailable(),
  ensurePermission: () => ensurePermission(),
  recognizeOnce: (lang: string) => recognizeOnce(lang),
  stopRecognition: () => stopRecognition(),
  openAppSettings: () => openAppSettings(),
}));

import { useVoiceMachine } from './useVoiceMachine-native';

beforeEach(() => {
  vi.clearAllMocks();
  isRecognitionAvailable.mockResolvedValue(true);
  ensurePermission.mockResolvedValue('granted');
  recognizeOnce.mockResolvedValue(null);
  stopRecognition.mockResolvedValue(undefined);
  openAppSettings.mockResolvedValue(undefined);
});

describe('useVoiceMachine (native)', () => {
  it('starts idle with no retry toast', () => {
    const { result } = renderHook(() => useVoiceMachine());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.retryToastVisible).toBe(false);
  });

  it('a confident utterance navigates to Configure with the parsed session', async () => {
    recognizeOnce.mockResolvedValue('three sets of one minute, thirty seconds rest');
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/configure', {
        state: { session: { sets: 3, workSec: 60, restSec: 30 } },
      }),
    );
    expect(recognizeOnce).toHaveBeenCalledWith('en-US');
    expect(result.current.state.phase).toBe('idle');
  });

  it('an unparseable utterance lands on the parse-error sheet, never navigating', async () => {
    recognizeOnce.mockResolvedValue('good morning');
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('parse-error'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('routes to the unsupported sheet when recognition is unavailable', async () => {
    isRecognitionAvailable.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('browser-unsupported'));
    expect(ensurePermission).not.toHaveBeenCalled();
  });

  it('routes to the permission sheet when the mic permission is not granted', async () => {
    ensurePermission.mockResolvedValue('permanently-denied');
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('permission-denied'));
    expect(recognizeOnce).not.toHaveBeenCalled();
  });

  it('openSettings deep-links from the permission sheet', async () => {
    ensurePermission.mockResolvedValue('permanently-denied');
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('permission-denied'));
    act(() => result.current.openSettings());
    await waitFor(() => expect(openAppSettings).toHaveBeenCalled());
  });

  it('cancelling mid-listen stops the recogniser and does not navigate on a late transcript', async () => {
    // Hold recognizeOnce open so we can cancel while listening.
    let resolveRec: (v: string | null) => void = () => {};
    recognizeOnce.mockReturnValue(new Promise<string | null>((r) => (resolveRec = r)));
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));

    act(() => result.current.cancel());
    expect(result.current.state.phase).toBe('idle');
    expect(stopRecognition).toHaveBeenCalled();

    // A transcript resolving after cancel must be ignored — no stale navigation.
    await act(async () => resolveRec('three sets of one minute thirty seconds rest'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('userStop stops the recogniser so the pending capture resolves', async () => {
    let resolveRec: (v: string | null) => void = () => {};
    recognizeOnce.mockReturnValue(new Promise<string | null>((r) => (resolveRec = r)));
    const { result } = renderHook(() => useVoiceMachine());
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));

    act(() => result.current.userStop());
    expect(stopRecognition).toHaveBeenCalled();

    await act(async () => resolveRec('three sets of one minute, thirty seconds rest'));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/configure', {
        state: { session: { sets: 3, workSec: 60, restSec: 30 } },
      }),
    );
  });
});
