import { Hono } from 'hono';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { RegistrationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { Env, JWTPayload } from '../types';
import { now } from '../db/utils';
import { rpConfig, saveChallenge, consumeChallenge, guessDeviceName } from '../lib/webauthn';

export const webauthnRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

type CredentialRow = { id: string; transports: string | null };

// ── POST /webauthn/register-options  (start enrolling this device) ────
webauthnRoutes.post('/register-options', async (c) => {
  const actor = c.get('user');
  const { rpName, rpID } = rpConfig(c.env);

  const userRow = await c.env.DB.prepare(
    'SELECT email, name FROM users WHERE id = ?'
  ).bind(actor.sub).first<{ email: string; name: string }>();
  if (!userRow) return c.json({ error: 'Bruger ikke fundet' }, 404);

  const existing = await c.env.DB.prepare(
    'SELECT id, transports FROM webauthn_credentials WHERE user_id = ?'
  ).bind(actor.sub).all<CredentialRow>();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userRow.email,
    userDisplayName: userRow.name,
    attestationType: 'none',
    excludeCredentials: existing.results.map(r => ({
      id: r.id,
      transports: r.transports ? (JSON.parse(r.transports) as AuthenticatorTransportFuture[]) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  await saveChallenge(c.env, actor.sub, options.challenge, 'register');
  return c.json(options);
});

// ── POST /webauthn/register-verify  (finish enrolling this device) ────
webauthnRoutes.post('/register-verify', async (c) => {
  const actor = c.get('user');
  const { response, deviceName } = await c.req.json<{ response: RegistrationResponseJSON; deviceName?: string }>();
  if (!response) return c.json({ error: 'Manglende response' }, 400);

  const expectedChallenge = await consumeChallenge(c.env, actor.sub, 'register');
  if (!expectedChallenge) return c.json({ error: 'Udløbet forespørgsel — prøv igen' }, 400);

  const { origin, rpID } = rpConfig(c.env);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return c.json({ error: 'Kunne ikke verificere enheden' }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'Verifikation fejlede' }, 400);
  }

  const { credential } = verification.registrationInfo;

  await c.env.DB.prepare(
    'INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, device_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    credential.id,
    actor.sub,
    isoBase64URL.fromBuffer(credential.publicKey),
    credential.counter,
    credential.transports ? JSON.stringify(credential.transports) : null,
    deviceName?.trim() || guessDeviceName(c.req.header('User-Agent')),
    now()
  ).run();

  return c.json({ ok: true });
});

// ── GET /webauthn/credentials  (list own registered devices) ──────────
webauthnRoutes.get('/credentials', async (c) => {
  const actor = c.get('user');
  const rows = await c.env.DB.prepare(
    'SELECT id, device_name, created_at, last_used_at FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(actor.sub).all();
  return c.json(rows.results);
});

// ── DELETE /webauthn/credentials/:id  (remove own device) ─────────────
webauthnRoutes.delete('/credentials/:id', async (c) => {
  const actor = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?').bind(id, actor.sub).run();
  return c.json({ ok: true });
});
