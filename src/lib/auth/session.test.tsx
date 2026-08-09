// ABOUT: Tests for SessionProvider and useSession hook.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './session';

vi.mock('./client', () => ({ getMe: vi.fn() }));
vi.mock('./local-hint', () => ({ markRegistered: vi.fn() }));
vi.mock('@/lib/platform', () => ({ isNativePlatform: vi.fn(() => false) }));
import { getMe } from './client';
import { markRegistered } from './local-hint';
import { isNativePlatform } from '@/lib/platform';

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SessionProvider / useSession', () => {
  it('starts in loading state', async () => {
    vi.mocked(getMe).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.session.status).toBe('loading');
  });

  it('transitions to authenticated when getMe returns a user', async () => {
    vi.mocked(getMe).mockResolvedValue({ userHandle: 'aabb', isAdmin: false });
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('authenticated'));
    expect(
      (result.current.session as { status: 'authenticated'; user: { userHandle: string } }).user
        .userHandle,
    ).toBe('aabb');
  });

  it('transitions to unauthenticated when getMe returns null', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
  });

  it('transitions to unauthenticated on getMe error', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
  });

  it('refresh() re-fetches and updates state', async () => {
    vi.mocked(getMe)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userHandle: 'ccdd', isAdmin: false });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.session.status).toBe('authenticated'));
  });

  it('login() calls markRegistered so returning users are routed to sign-in next time', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));
    act(() => result.current.login({ userHandle: 'eeff', isAdmin: false }));
    expect(markRegistered).toHaveBeenCalledTimes(1);
  });

  it('login() sets session to authenticated immediately without a network call', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session.status).toBe('unauthenticated'));

    act(() => result.current.login({ userHandle: 'eeff', isAdmin: false }));
    expect(result.current.session.status).toBe('authenticated');
    expect(
      (result.current.session as { status: 'authenticated'; user: { userHandle: string } }).user
        .userHandle,
    ).toBe('eeff');
    expect(getMe).toHaveBeenCalledTimes(1); // no extra network call
  });

  it('login() cancels an in-flight refresh so stale null response does not overwrite authenticated state', async () => {
    let resolveGetMe!: (v: null) => void;
    vi.mocked(getMe).mockReturnValueOnce(
      new Promise<null>((res) => {
        resolveGetMe = res;
      }),
    );

    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.session.status).toBe('loading');

    // login() fires while the initial refresh getMe() is still in flight
    act(() => result.current.login({ userHandle: 'gggg', isAdmin: false }));
    expect(result.current.session.status).toBe('authenticated');

    // Now the stale refresh response arrives with null — must NOT override login
    await act(async () => resolveGetMe(null));
    expect(result.current.session.status).toBe('authenticated');
  });

  it('throws when used outside SessionProvider', () => {
    expect(() => renderHook(() => useSession())).toThrow(
      'useSession must be used inside SessionProvider',
    );
  });

  // 07c: on native the "no auth network call, ever" guarantee is structural — gated on platform,
  // not on auth state. These are the load-bearing tests (spec 07c): resolve to a definite
  // `unauthenticated` and never call getMe, including after a refresh().
  describe('native (no accounts)', () => {
    beforeEach(() => vi.mocked(isNativePlatform).mockReturnValue(true));

    it('resolves to a definite unauthenticated state with no loading flash', () => {
      vi.mocked(getMe).mockReturnValue(new Promise(() => {})); // would hang if ever called
      const { result } = renderHook(() => useSession(), { wrapper });
      expect(result.current.session.status).toBe('unauthenticated');
    });

    it('never calls getMe on mount', () => {
      vi.mocked(getMe).mockReturnValue(new Promise(() => {}));
      renderHook(() => useSession(), { wrapper });
      expect(getMe).not.toHaveBeenCalled();
    });

    it('refresh() stays unauthenticated and still never calls getMe', () => {
      vi.mocked(getMe).mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useSession(), { wrapper });
      act(() => result.current.refresh());
      expect(result.current.session.status).toBe('unauthenticated');
      expect(getMe).not.toHaveBeenCalled();
    });
  });
});
