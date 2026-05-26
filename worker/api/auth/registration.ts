// ABOUT: WebAuthn passkey registration — options generation and response verification.
// ABOUT: Stores pending challenge in SESSIONS KV (short TTL). Creates user row on success.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import type { Env } from '../../index';
import { insertUser, getUserByHandle } from '../../db/queries';
import { createSession, makeCookieValue } from '../../lib/sessionStore';

const CHALLENGE_TTL = 300; // 5 minutes

function challengeKey(token: string) {
  return `challenge:reg:${token}`;
}

function generateUserHandle(): { hex: string; bytes: Uint8Array<ArrayBuffer> } {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { hex, bytes };
}

export async function registrationOptions(_request: Request, env: Env): Promise<Response> {
  const { hex: userHandleHex, bytes: userHandleBytes } = generateUserHandle();

  const options = await generateRegistrationOptions({
    rpName: 'Takt',
    rpID: env.WEBAUTHN_RP_ID,
    userID: userHandleBytes,
    userName: 'takt-user',
    userDisplayName: 'Takt User',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
    attestationType: 'none',
  });

  // Store challenge + userHandle together so verify can retrieve both.
  const token = crypto.randomUUID();
  await env.SESSIONS.put(
    challengeKey(token),
    JSON.stringify({ challenge: options.challenge, userHandle: userHandleHex }),
    { expirationTtl: CHALLENGE_TTL },
  );

  return Response.json({ ...options, _token: token });
}

const VerifyBody = z.object({
  token: z.string().min(1),
  credential: z.record(z.string(), z.unknown()),
});

export async function registrationVerify(request: Request, env: Env): Promise<Response> {
  let body: z.infer<typeof VerifyBody>;
  try {
    body = VerifyBody.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const stored = await env.SESSIONS.get(challengeKey(body.token));
  if (!stored) return Response.json({ error: 'challenge-expired' }, { status: 400 });
  await env.SESSIONS.delete(challengeKey(body.token));

  const { challenge, userHandle } = JSON.parse(stored) as {
    challenge: string;
    userHandle: string;
  };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: false,
    });
  } catch {
    return Response.json({ error: 'verification-failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: 'verification-failed' }, { status: 400 });
  }

  const { credential: cred } = verification.registrationInfo;

  // Guard against duplicate userHandle (astronomically unlikely, but correct).
  const existing = await getUserByHandle(env.DB, userHandle);
  if (existing) return Response.json({ error: 'handle-collision' }, { status: 409 });

  await insertUser(env.DB, {
    user_handle: userHandle,
    public_key: isoBase64URL.fromBuffer(cred.publicKey),
    counter: cred.counter,
    is_admin: 0,
    created_at: Date.now(),
  });

  const signed = await createSession(env, { userHandle, isAdmin: false });

  return new Response(JSON.stringify({ userHandle, isAdmin: false }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeCookieValue(signed),
    },
  });
}
