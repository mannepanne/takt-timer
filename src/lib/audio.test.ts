import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetAudioForTest, beep, prepareAudio } from './audio';

type FakeNode = {
  connect: ReturnType<typeof vi.fn>;
  start?: ReturnType<typeof vi.fn>;
  stop?: ReturnType<typeof vi.fn>;
};
type FakeParam = {
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
};

function createFakeContext(initialState: 'running' | 'suspended' = 'running') {
  const osc: FakeNode & { type: string; frequency: FakeParam } = {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain: FakeNode & { gain: FakeParam } = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
  };
  const ctx = {
    state: initialState,
    currentTime: 0,
    resume: vi.fn(async function (this: { state: string }) {
      this.state = 'running';
    }),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
    destination: {},
  };
  // Bind resume's `this` correctly.
  ctx.resume = vi.fn(async () => {
    ctx.state = 'running';
  });
  return { ctx, osc, gain };
}

describe('prepareAudio', () => {
  const originalAudioContext = window.AudioContext;
  const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    (globalThis as { navigator?: Navigator }).navigator = originalNavigator;
    __resetAudioForTest();
    vi.restoreAllMocks();
  });

  it('is a no-op when AudioContext is unavailable', () => {
    // @ts-expect-error — deleting for test
    delete window.AudioContext;
    expect(() => prepareAudio()).not.toThrow();
  });

  it('creates an AudioContext on first call, reuses on subsequent calls', () => {
    const { ctx } = createFakeContext();
    const Ctor = vi.fn(() => ctx) as unknown as typeof AudioContext;
    window.AudioContext = Ctor;
    prepareAudio();
    prepareAudio();
    expect(Ctor).toHaveBeenCalledTimes(1);
  });

  it('calls resume() when context is suspended', () => {
    const { ctx } = createFakeContext('suspended');
    window.AudioContext = vi.fn(() => ctx) as unknown as typeof AudioContext;
    prepareAudio();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('sets navigator.audioSession.type to ambient when present', () => {
    const { ctx } = createFakeContext();
    window.AudioContext = vi.fn(() => ctx) as unknown as typeof AudioContext;
    const audioSession = { type: 'auto' as const };
    // Augment the existing navigator rather than replacing it — jsdom's Navigator is not constructable.
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: audioSession,
    });
    prepareAudio();
    expect(audioSession.type).toBe('ambient');
    // Clean up the property
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: undefined,
    });
  });
});

describe('beep', () => {
  beforeEach(() => {
    __resetAudioForTest();
  });

  afterEach(() => {
    __resetAudioForTest();
    vi.restoreAllMocks();
  });

  it('schedules an oscillator with the expected frequency for each kind', () => {
    const { ctx, osc } = createFakeContext();
    const Ctor = vi.fn(() => ctx) as unknown as typeof AudioContext;
    window.AudioContext = Ctor;
    prepareAudio();

    beep('phase-work');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(523, expect.any(Number));
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });

  it('is a no-op when AudioContext is unavailable', () => {
    // @ts-expect-error — deleting for test
    delete window.AudioContext;
    __resetAudioForTest();
    expect(() => beep('pip')).not.toThrow();
  });
});
