// ABOUT: KV-backed server-side session store.
// ABOUT: Maps opaque signed session IDs to userHandle + expiry. Rolling 30-day TTL.

import type { Env } from '../index';

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionData {
  userHandle: string;
  isAdmin: boolean;
}

// Signs a session ID using HMAC-SHA256 with the SESSION_COOKIE_SECRET.
// Returns `${sessionId}.${base64url(signature)}`.
async function sign(sessionId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sessionId));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${sessionId}.${b64}`;
}

async function verify(signed: string, secret: string): Promise<string | null> {
  const dot = signed.lastIndexOf('.');
  if (dot < 0) return null;
  const sessionId = signed.slice(0, dot);
  const expected = await sign(sessionId, secret);
  // Constant-time comparison via SubtleCrypto.
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signed);
  if (a.length !== b.length) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(
    atob(
      signed
        .slice(dot + 1)
        .replace(/-/g, '+')
        .replace(/_/g, '/'),
    ),
    (c) => c.charCodeAt(0),
  );
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(sessionId));
  return ok ? sessionId : null;
}

export function makeCookieValue(signed: string): string {
  return `session=${signed}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_SECONDS}`;
}

export function clearCookieValue(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export function parseCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name.trim() === 'session') return rest.join('=').trim();
  }
  return null;
}

function userSessionKey(userHandle: string, sessionId: string): string {
  return `user-session:${userHandle}:${sessionId}`;
}

export async function createSession(
  env: Pick<Env, 'SESSIONS' | 'SESSION_COOKIE_SECRET'>,
  data: SessionData,
): Promise<string> {
  const sessionId = crypto.randomUUID();
  // Reverse-index written first: if session-data write fails, index points at nothing
  // and deleteUserSessions issues a harmless delete — no orphan session.
  await env.SESSIONS.put(userSessionKey(data.userHandle, sessionId), '1', {
    expirationTtl: TTL_SECONDS,
  });
  await env.SESSIONS.put(sessionId, JSON.stringify(data), { expirationTtl: TTL_SECONDS });
  return sign(sessionId, env.SESSION_COOKIE_SECRET);
}

export async function getSession(
  env: Pick<Env, 'SESSIONS' | 'SESSION_COOKIE_SECRET'>,
  cookieHeader: string | null,
): Promise<SessionData | null> {
  const signed = parseCookieHeader(cookieHeader);
  if (!signed) return null;
  const sessionId = await verify(signed, env.SESSION_COOKIE_SECRET);
  if (!sessionId) return null;
  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function deleteSession(
  env: Pick<Env, 'SESSIONS' | 'SESSION_COOKIE_SECRET'>,
  cookieHeader: string | null,
): Promise<void> {
  const signed = parseCookieHeader(cookieHeader);
  if (!signed) return;
  const sessionId = await verify(signed, env.SESSION_COOKIE_SECRET);
  if (!sessionId) return;
  await env.SESSIONS.delete(sessionId);
}

export async function deleteUserSessions(
  env: Pick<Env, 'SESSIONS'>,
  userHandle: string,
): Promise<number> {
  const prefix = userSessionKey(userHandle, '');
  let total = 0;
  let cursor: string | undefined;
  do {
    const page = await env.SESSIONS.list({ prefix, ...(cursor ? { cursor } : {}) });
    if (page.keys.length > 0) {
      total += page.keys.length;
      await Promise.all(
        page.keys.flatMap((k) => {
          const sessionId = k.name.slice(prefix.length);
          return [env.SESSIONS.delete(sessionId), env.SESSIONS.delete(k.name)];
        }),
      );
    }
    cursor = page.list_complete ? undefined : (page as { cursor?: string }).cursor;
  } while (cursor);
  return total;
}
