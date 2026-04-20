import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isMediaRecorderAvailable,
  preferredMimeType,
  queryMicPermission,
  setAudioCategory,
  startRecording,
  supportedMimeTypes,
} from './mic';

type MockRecorder = {
  state: 'recording' | 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type MockAudioSession = { type: string };

function installMediaRecorderMock(isSupported = (_: string) => true) {
  const constructed: MockRecorder[] = [];
  const MockMediaRecorder = vi.fn((_stream: MediaStream, _opts: { mimeType: string }) => {
    const recorder: MockRecorder = {
      state: 'inactive',
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
    constructed.push(recorder);
    return recorder;
  }) as unknown as typeof MediaRecorder & { isTypeSupported: (t: string) => boolean };
  (MockMediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported =
    isSupported;
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  return { constructed };
}

function installGetUserMediaMock(stream?: MediaStream, throwError?: Error) {
  const tracks = [{ stop: vi.fn() }];
  const mockStream = (stream ?? { getTracks: () => tracks }) as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => {
    if (throwError) throw throwError;
    return mockStream;
  });
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia },
  });
  return { getUserMedia, tracks };
}

describe('mic — feature detection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports MediaRecorder available when global is defined', () => {
    vi.stubGlobal('MediaRecorder', class {});
    expect(isMediaRecorderAvailable()).toBe(true);
  });

  it('reports MediaRecorder unavailable when global is undefined', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(isMediaRecorderAvailable()).toBe(false);
  });

  it('supportedMimeTypes returns only candidates the platform accepts', () => {
    installMediaRecorderMock((t) => t === 'audio/mp4' || t === 'audio/mp4;codecs=mp4a.40.2');
    expect(supportedMimeTypes()).toEqual(['audio/mp4;codecs=mp4a.40.2', 'audio/mp4']);
  });

  it('supportedMimeTypes returns empty array when MediaRecorder is missing', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(supportedMimeTypes()).toEqual([]);
  });

  it('preferredMimeType picks the first supported candidate (opus first)', () => {
    installMediaRecorderMock(() => true);
    expect(preferredMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('preferredMimeType returns empty string when nothing is supported', () => {
    installMediaRecorderMock(() => false);
    expect(preferredMimeType()).toBe('');
  });

  it('supportedMimeTypes swallows throws from isTypeSupported', () => {
    const MockRecorder = vi.fn() as unknown as typeof MediaRecorder & {
      isTypeSupported: () => boolean;
    };
    (MockRecorder as unknown as { isTypeSupported: () => boolean }).isTypeSupported = () => {
      throw new Error('boom');
    };
    vi.stubGlobal('MediaRecorder', MockRecorder);
    expect(supportedMimeTypes()).toEqual([]);
  });
});

describe('mic — setAudioCategory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sets navigator.audioSession.type when the API is available', () => {
    const audioSession: MockAudioSession = { type: 'ambient' };
    vi.stubGlobal('navigator', { ...navigator, audioSession });
    setAudioCategory('play-and-record');
    expect(audioSession.type).toBe('play-and-record');
    setAudioCategory('ambient');
    expect(audioSession.type).toBe('ambient');
  });

  it('no-ops when navigator.audioSession is missing', () => {
    vi.stubGlobal('navigator', { ...navigator, audioSession: undefined });
    expect(() => setAudioCategory('play-and-record')).not.toThrow();
  });

  it('swallows errors from the assignment', () => {
    const audioSession = Object.defineProperty({} as MockAudioSession, 'type', {
      set() {
        throw new Error('platform error');
      },
    });
    vi.stubGlobal('navigator', { ...navigator, audioSession });
    expect(() => setAudioCategory('play-and-record')).not.toThrow();
  });
});

describe('mic — startRecording', () => {
  beforeEach(() => {
    installMediaRecorderMock();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests getUserMedia and returns a handle', async () => {
    const { getUserMedia } = installGetUserMediaMock();
    const onStop = vi.fn();
    const onError = vi.fn();
    const handle = await startRecording({ onStop, onError });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(typeof handle.stop).toBe('function');
    expect(typeof handle.discard).toBe('function');
  });

  it('onStop delivers a blob of the chosen MIME type and stops the stream tracks', async () => {
    const { tracks } = installGetUserMediaMock();
    const onStop = vi.fn();
    const handle = await startRecording({ onStop, onError: vi.fn() });

    const recorder = (MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0]
      .value as MockRecorder;
    recorder.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    handle.stop();

    expect(onStop).toHaveBeenCalledTimes(1);
    const blob = onStop.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('discard() suppresses the onStop callback but still stops the stream', async () => {
    const { tracks } = installGetUserMediaMock();
    const onStop = vi.fn();
    const handle = await startRecording({ onStop, onError: vi.fn() });
    handle.discard();
    expect(onStop).not.toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('onError is called when the underlying recorder emits an error event', async () => {
    installGetUserMediaMock();
    const onError = vi.fn();
    await startRecording({ onStop: vi.fn(), onError });
    const recorder = (MediaRecorder as unknown as ReturnType<typeof vi.fn>).mock.results[0]
      .value as MockRecorder;
    const boom = new Error('recorder error');
    recorder.onerror?.({ error: boom } as unknown as Event);
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it('throws when MediaRecorder is unavailable', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    installGetUserMediaMock();
    await expect(startRecording({ onStop: vi.fn(), onError: vi.fn() })).rejects.toThrow(
      /not available/i,
    );
  });

  it('throws when no supported MIME type is found', async () => {
    installMediaRecorderMock(() => false);
    installGetUserMediaMock();
    await expect(startRecording({ onStop: vi.fn(), onError: vi.fn() })).rejects.toThrow(/MIME/);
  });

  it('propagates getUserMedia rejection (permission denied)', async () => {
    installGetUserMediaMock(undefined, new DOMException('denied', 'NotAllowedError'));
    await expect(startRecording({ onStop: vi.fn(), onError: vi.fn() })).rejects.toThrow(/denied/);
  });
});

describe('mic — queryMicPermission', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns granted when the Permissions API reports granted', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      permissions: { query: vi.fn(async () => ({ state: 'granted' })) },
    });
    await expect(queryMicPermission()).resolves.toBe('granted');
  });

  it('returns denied when the Permissions API reports denied', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      permissions: { query: vi.fn(async () => ({ state: 'denied' })) },
    });
    await expect(queryMicPermission()).resolves.toBe('denied');
  });

  it('returns unavailable when the Permissions API is absent', async () => {
    vi.stubGlobal('navigator', { ...navigator, permissions: undefined });
    await expect(queryMicPermission()).resolves.toBe('unavailable');
  });

  it('returns unavailable when query throws', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      permissions: {
        query: vi.fn(async () => {
          throw new Error('boom');
        }),
      },
    });
    await expect(queryMicPermission()).resolves.toBe('unavailable');
  });
});
