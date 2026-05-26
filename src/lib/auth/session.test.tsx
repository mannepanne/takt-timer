// ABOUT: Tests for SessionProvider and useSession hook.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './session';

vi.mock('./client', () => ({ getMe: vi.fn() }));
import { getMe } from './client';

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

  it('throws when used outside SessionProvider', () => {
    expect(() => renderHook(() => useSession())).toThrow(
      'useSession must be used inside SessionProvider',
    );
  });
});
