import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVoiceMachine } from './useVoiceMachine';

type MockRecorder = {
  state: 'recording' | 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
};

let currentRecorder: MockRecorder | null = null;

function installBrowserMocks(
  options: { getUserMediaThrows?: Error; isTypeSupported?: boolean } = {},
) {
  const MockMediaRecorder = vi.fn((_stream: MediaStream, _opts: { mimeType: string }) => {
    const recorder: MockRecorder = {
      state: 'recording',
      ondataavailable: null,
      onerror: null,
      onstop: null,
      start() {
        recorder.state = 'recording';
      },
      stop() {
        recorder.state = 'inactive';
        recorder.onstop?.();
      },
    };
    currentRecorder = recorder;
    return recorder;
  }) as unknown as typeof MediaRecorder & { isTypeSupported: (t: string) => boolean };
  (MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
    () => options.isTypeSupported ?? true;
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);

  const tracks = [{ stop: vi.fn() }];
  vi.stubGlobal('navigator', {
    ...navigator,
    onLine: true,
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        if (options.getUserMediaThrows) throw options.getUserMediaThrows;
        return { getTracks: () => tracks } as unknown as MediaStream;
      }),
    },
    audioSession: { type: 'ambient' },
  });

  return { tracks };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function deliverBlob(size: number, mimeType = 'audio/webm;codecs=opus'): void {
  if (!currentRecorder) throw new Error('no recorder installed');
  // Fill with enough bytes to match `size`.
  currentRecorder.ondataavailable?.({
    data: new Blob([new Uint8Array(size)], { type: mimeType }),
  });
}

describe('useVoiceMachine', () => {
  beforeEach(() => {
    currentRecorder = null;
    installBrowserMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts in idle', () => {
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    expect(result.current.state.phase).toBe('idle');
  });

  it('micTap → requesting-permission → listening when getUserMedia resolves', async () => {
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    expect(result.current.state.phase).toBe('requesting-permission');
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));
  });

  it('micTap when offline → offline state (no permission prompt)', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    expect(result.current.state.phase).toBe('offline');
  });

  it('micTap when MediaRecorder is unavailable → browser-unsupported', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    expect(result.current.state.phase).toBe('browser-unsupported');
  });

  it('getUserMedia rejection (NotAllowedError) → permission-denied', async () => {
    installBrowserMocks({
      getUserMediaThrows: new DOMException('denied', 'NotAllowedError'),
    });
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('permission-denied'));
  });

  it('sets audioSession to play-and-record on micTap, restores ambient on permission-denied', async () => {
    const audioSession = { type: 'ambient' };
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('denied', 'NotAllowedError');
        }),
      },
      audioSession,
    });
    installBrowserMocks({ getUserMediaThrows: new DOMException('denied', 'NotAllowedError') });
    // Override the audioSession specifically to the one we observe
    (navigator as unknown as { audioSession: typeof audioSession }).audioSession = audioSession;

    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    expect(audioSession.type).toBe('play-and-record');
    await waitFor(() => expect(result.current.state.phase).toBe('permission-denied'));
    expect(audioSession.type).toBe('ambient');
  });

  it('userStop → uploading → uploadBegun → transcribing → postVoice called', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));

    act(() => {
      deliverBlob(2048);
      result.current.userStop();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('transcribing'));
    expect(fetchFn).toHaveBeenCalledWith('/api/voice/parse', expect.any(Object));
  });

  it('empty blob → idle (blobEmpty path) without calling fetch', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));

    act(() => {
      deliverBlob(10); // Below MIN_AUDIO_BYTES (500)
      result.current.userStop();
    });

    await waitFor(() => expect(result.current.state.phase).toBe('idle'));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancel from listening → idle, no fetch, recorder discarded', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('listening'));

    act(() => result.current.cancel());

    expect(result.current.state.phase).toBe('idle');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('retry from a terminal state → idle', async () => {
    installBrowserMocks({
      getUserMediaThrows: new DOMException('denied', 'NotAllowedError'),
    });
    const { result } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(result.current.state.phase).toBe('permission-denied'));
    act(() => result.current.retry());
    expect(result.current.state.phase).toBe('idle');
  });

  it('unmount cleans up: restores ambient audio', async () => {
    const audioSession = { type: 'ambient' };
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
      },
      audioSession,
    });
    const { result, unmount } = renderHook(() => useVoiceMachine(), { wrapper });
    act(() => result.current.micTap());
    await waitFor(() => expect(audioSession.type).toBe('play-and-record'));
    unmount();
    expect(audioSession.type).toBe('ambient');
  });
});
