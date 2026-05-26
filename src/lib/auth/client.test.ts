// ABOUT: Unit tests for the WebAuthn client — register, signIn, signOut, getMe.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
  base64URLStringToBuffer: vi.fn(),
}));

vi.mock('@/lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import {
  startAuthentication,
  startRegistration,
  base64URLStringToBuffer,
} from '@simplewebauthn/browser';
import { apiFetch } from '@/lib/apiFetch';
import { register, signIn, signOut, getMe } from './client';

function mockJson(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

const AUTH_USER = { userHandle: 'aabb1122334455667788aabbccddeeff', isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('register', () => {
  it('fetches options, starts registration, then verifies', async () => {
    const options = { challenge: 'chall', _token: 'tok123', rpId: 'localhost' };
    const credential = { id: 'cred1', response: {} };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockJson(options) as never)
      .mockResolvedValueOnce(mockJson(AUTH_USER) as never);
    vi.mocked(startRegistration).mockResolvedValueOnce(credential as never);

    const user = await register();
    expect(user).toEqual(AUTH_USER);

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/auth/registration/options', {
      method: 'POST',
    });
    expect(startRegistration).toHaveBeenCalledWith({
      optionsJSON: { challenge: 'chall', rpId: 'localhost' },
    });
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/registration/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'tok123', credential }),
      }),
    );
  });

  it('throws on options fetch failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson({}, 500) as never);
    await expect(register()).rejects.toThrow('Failed to get registration options');
  });

  it('throws with server error message on verify failure', async () => {
    const options = { _token: 'tok', challenge: 'chall' };
    const credential = { id: 'c1', response: {} };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockJson(options) as never)
      .mockResolvedValueOnce(mockJson({ error: 'duplicate-handle' }, 409) as never);
    vi.mocked(startRegistration).mockResolvedValueOnce(credential as never);
    await expect(register()).rejects.toThrow('duplicate-handle');
  });
});

describe('signIn', () => {
  it('decodes base64url userHandle to hex, then verifies', async () => {
    const options = { challenge: 'chall', _token: 'tok456' };
    // base64url of 0xaabb1122... → 16 bytes → 32 hex chars
    const hexBytes = new Uint8Array([
      0xaa, 0xbb, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
      0xff,
    ]);
    const credential = {
      id: 'cred2',
      response: { userHandle: 'base64urlstr' },
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockJson(options) as never)
      .mockResolvedValueOnce(mockJson(AUTH_USER) as never);
    vi.mocked(startAuthentication).mockResolvedValueOnce(credential as never);
    vi.mocked(base64URLStringToBuffer).mockReturnValueOnce(hexBytes.buffer);

    const user = await signIn();
    expect(user).toEqual(AUTH_USER);

    expect(base64URLStringToBuffer).toHaveBeenCalledWith('base64urlstr');
    const verifyCall = vi.mocked(apiFetch).mock.calls[1];
    const body = JSON.parse(verifyCall[1]!.body as string);
    expect(body.userHandle).toBe('aabb1122334455667788aabbccddeeff');
  });

  it('throws when userHandle is missing from credential response', async () => {
    const options = { _token: 'tok', challenge: 'chall' };
    const credential = { id: 'c', response: { userHandle: undefined } };
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson(options) as never);
    vi.mocked(startAuthentication).mockResolvedValueOnce(credential as never);
    await expect(signIn()).rejects.toThrow('No userHandle');
  });

  it('throws with server error on verify failure', async () => {
    const options = { _token: 'tok', challenge: 'chall' };
    const cred = { id: 'c', response: { userHandle: 'aaa' } };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockJson(options) as never)
      .mockResolvedValueOnce(mockJson({ error: 'counter-regression' }, 403) as never);
    vi.mocked(startAuthentication).mockResolvedValueOnce(cred as never);
    vi.mocked(base64URLStringToBuffer).mockReturnValueOnce(new Uint8Array(16).buffer);
    await expect(signIn()).rejects.toThrow('counter-regression');
  });
});

describe('signOut', () => {
  it('POSTs to /api/auth/signout', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson({}) as never);
    await signOut();
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/signout', { method: 'POST' });
  });
});

describe('getMe', () => {
  it('returns user when authenticated', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson(AUTH_USER) as never);
    const user = await getMe();
    expect(user).toEqual(AUTH_USER);
  });

  it('returns null on 401', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson({}, 401) as never);
    const user = await getMe();
    expect(user).toBeNull();
  });

  it('throws on non-401 error', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockJson({}, 500) as never);
    await expect(getMe()).rejects.toThrow('Failed to fetch user');
  });
});
