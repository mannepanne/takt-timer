// ABOUT: WebAuthn client — passkey registration and sign-in orchestration.
// ABOUT: Handles base64url→hex userHandle conversion required by the server.

import {
  startAuthentication,
  startRegistration,
  base64URLStringToBuffer,
} from '@simplewebauthn/browser';

import { apiFetch } from '@/lib/apiFetch';

export type AuthUser = {
  userHandle: string;
  isAdmin: boolean;
};

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function register(): Promise<AuthUser> {
  const optRes = await apiFetch('/api/auth/registration/options', { method: 'POST' });
  if (!optRes.ok) {
    const body = await optRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'options-failed');
  }
  const { _token, ...options } = (await optRes.json()) as Record<string, unknown>;

  const credential = await startRegistration({ optionsJSON: options as never });

  const verifyRes = await apiFetch('/api/auth/registration/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: _token, credential }),
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Registration failed');
  }
  const authUser = (await verifyRes.json()) as AuthUser;
  // Push local settings to server so anon preferences survive registration.
  try {
    const langRaw = localStorage.getItem('takt.lang.v1');
    const accentRaw = localStorage.getItem('takt.accent.v1');
    const soundRaw = localStorage.getItem('takt.sound.v1');
    const VALID_ACCENTS = new Set(['lichen', 'coral', 'ocean', 'amber', 'iris', 'slate']);
    await apiFetch('/api/me/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langRaw === 'en' || langRaw === 'sv' ? langRaw : 'en',
        accent_colour: accentRaw && VALID_ACCENTS.has(accentRaw) ? accentRaw : 'lichen',
        sound_on: soundRaw === '0' ? 0 : 1,
      }),
    });
  } catch {
    // Push failure is non-fatal — server keeps registration defaults.
  }
  return authUser;
}

export async function signIn(): Promise<AuthUser> {
  const optRes = await apiFetch('/api/auth/signin/options', { method: 'POST' });
  if (!optRes.ok) {
    const body = await optRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'options-failed');
  }
  const { _token, ...options } = (await optRes.json()) as Record<string, unknown>;

  const credential = await startAuthentication({ optionsJSON: options as never });

  // The browser returns userHandle as Base64URLString; server expects hex.
  const userHandleB64 = credential.response.userHandle;
  if (!userHandleB64) throw new Error('No userHandle in authentication response');
  const userHandleHex = bufferToHex(base64URLStringToBuffer(userHandleB64));

  const verifyRes = await apiFetch('/api/auth/signin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: _token, credential, userHandle: userHandleHex }),
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Sign-in failed');
  }
  return verifyRes.json() as Promise<AuthUser>;
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/signout', { method: 'POST' });
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json() as Promise<AuthUser>;
}
