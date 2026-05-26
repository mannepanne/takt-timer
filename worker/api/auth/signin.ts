// ABOUT: WebAuthn passkey sign-in — options generation and assertion verification.
// ABOUT: Counter regression check skipped for synced (backed-up) passkeys per ADR 2026-05-26.

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import type { Env } from '../../index';
import { getUserByHandle, updateUserCounter } from '../../db/queries';
import { createSession, makeCookieValue } from '../../lib/sessionStore';

const CHALLENGE_TTL = 300;

function challengeKey(token: string) {
  return `challenge:auth:${token}`;
}

export async function signinOptions(_request: Request, env: Env): Promise<Response> {
  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    userVerification: 'preferred',
  });

  const token = crypto.randomUUID();
  await env.SESSIONS.put(challengeKey(token), options.challenge, {
    expirationTtl: CHALLENGE_TTL,
  });

  return Response.json({ ...options, _token: token });
}

const VerifyBody = z.object({
  token: z.string().min(1),
  credential: z.record(z.string(), z.unknown()),
  userHandle: z.string().regex(/^[0-9a-f]{32}$/),
});

export async function signinVerify(request: Request, env: Env): Promise<Response> {
  let body: z.infer<typeof VerifyBody>;
  try {
    body = VerifyBody.parse(await request.json());
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const challenge = await env.SESSIONS.get(challengeKey(body.token));
  if (!challenge) return Response.json({ error: 'challenge-expired' }, { status: 400 });
  await env.SESSIONS.delete(challengeKey(body.token));

  const user = await getUserByHandle(env.DB, body.userHandle);
  if (!user) return Response.json({ error: 'user-not-found' }, { status: 404 });

  const credential = body.credential as unknown as AuthenticationResponseJSON;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: false,
      credential: {
        id: credential.id,
        publicKey: isoBase64URL.toBuffer(user.public_key),
        counter: user.counter,
        transports: undefined,
      },
    });
  } catch {
    return Response.json({ error: 'verification-failed' }, { status: 400 });
  }

  if (!verification.verified) {
    return Response.json({ error: 'verification-failed' }, { status: 400 });
  }

  const { authenticationInfo } = verification;

  // Per ADR 2026-05-26: skip counter regression check for synced passkeys.
  // credentialBackedUp = true means iCloud Keychain / Google PM — counter intentionally = 0.
  const newCounter = authenticationInfo.newCounter;
  const isSynced = authenticationInfo.credentialBackedUp;
  if (!isSynced && newCounter > 0 && newCounter <= user.counter) {
    return Response.json({ error: 'counter-regression' }, { status: 403 });
  }

  if (newCounter !== user.counter) {
    await updateUserCounter(env.DB, body.userHandle, newCounter);
  }

  const signed = await createSession(env, {
    userHandle: body.userHandle,
    isAdmin: user.is_admin === 1,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeCookieValue(signed),
    },
  });
}
