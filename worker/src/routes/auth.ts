import { Hono } from 'hono';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { Env, JWTPayload } from '../types';
import { signJWT } from '../db/jwt';
import { now } from '../db/utils';
import { rpConfig, saveChallenge, consumeChallenge } from '../lib/webauthn';

export const authRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

type UserAuthRow = { id: string; org_id: string; email: string; name: string; role: string };
type CredentialRow = { id: string; public_key: string; counter: number; transports: string | null };

// ── POST /auth/accept-invite  (public — set password via invite token) ─
authRoutes.post('/accept-invite', async (c) => {
  const { token, password } = await c.req.json<{ token: string; password: string }>();
  if (!token || !password) return c.json({ error: 'token and password required' }, 400);
  if (password.length < 6) return c.json({ error: 'Password too short (min 6)' }, 400);

  const row = await c.env.DB.prepare(
    'SELECT token, user_id, expires_at, used FROM invite_tokens WHERE token = ?'
  ).bind(token).first<{ token: string; user_id: string; expires_at: string; used: number }>();

  if (!row) return c.json({ error: 'Invalid invite link' }, 404);
  if (row.used) return c.json({ error: 'Invite link already used' }, 410);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: 'Invite link expired' }, 410);

  const hash = await sha256(password);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, row.user_id).run();
  await c.env.DB.prepare('UPDATE invite_tokens SET used = 1 WHERE token = ?').bind(token).run();

  // Return user info so frontend can redirect to login
  const user = await c.env.DB.prepare(
    'SELECT id, org_id, email, name, role FROM users WHERE id = ?'
  ).bind(row.user_id).first<{ id: string; org_id: string; email: string; name: string; role: string }>();

  return c.json({ ok: true, email: user?.email });
});

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400);

  const user = await c.env.DB.prepare(
    'SELECT id, org_id, email, name, role, password_hash FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; org_id: string; email: string; name: string; role: string; password_hash: string }>();

  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  // Compare bcrypt-like hash — in production use a proper hasher via crypto.subtle
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (hashHex !== user.password_hash) return c.json({ error: 'Invalid credentials' }, 401);

  const token = await signJWT(
    { sub: user.id, org: user.org_id, role: user.role as 'admin' | 'coach' },
    c.env.JWT_SECRET
  );

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ── POST /auth/webauthn/login-options  (public — start Face ID/Touch ID login) ─
authRoutes.post('/webauthn/login-options', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  const generic = { error: 'Face ID/Touch ID er ikke sat op for denne konto' };
  if (!email) return c.json(generic, 400);

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first<{ id: string }>();
  if (!user) return c.json(generic, 404);

  const creds = await c.env.DB.prepare(
    'SELECT id, transports FROM webauthn_credentials WHERE user_id = ?'
  ).bind(user.id).all<{ id: string; transports: string | null }>();
  if (creds.results.length === 0) return c.json(generic, 404);

  const { rpID } = rpConfig(c.env);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: creds.results.map(r => ({
      id: r.id,
      transports: r.transports ? (JSON.parse(r.transports) as AuthenticatorTransportFuture[]) : undefined,
    })),
  });

  await saveChallenge(c.env, user.id, options.challenge, 'authenticate');
  return c.json(options);
});

// ── POST /auth/webauthn/login-verify  (public — finish Face ID/Touch ID login) ─
authRoutes.post('/webauthn/login-verify', async (c) => {
  const { email, response } = await c.req.json<{ email: string; response: AuthenticationResponseJSON }>();
  if (!email || !response) return c.json({ error: 'Ugyldig forespørgsel' }, 400);

  const user = await c.env.DB.prepare(
    'SELECT id, org_id, email, name, role FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first<UserAuthRow>();
  if (!user) return c.json({ error: 'Ugyldigt forsøg' }, 400);

  const expectedChallenge = await consumeChallenge(c.env, user.id, 'authenticate');
  if (!expectedChallenge) return c.json({ error: 'Udløbet forespørgsel — prøv igen' }, 400);

  const credRow = await c.env.DB.prepare(
    'SELECT id, public_key, counter, transports FROM webauthn_credentials WHERE id = ? AND user_id = ?'
  ).bind(response.id, user.id).first<CredentialRow>();
  if (!credRow) return c.json({ error: 'Ukendt enhed' }, 400);

  const { origin, rpID } = rpConfig(c.env);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credRow.id,
        publicKey: isoBase64URL.toBuffer(credRow.public_key),
        counter: credRow.counter,
        transports: credRow.transports ? (JSON.parse(credRow.transports) as AuthenticatorTransportFuture[]) : undefined,
      },
    });
  } catch {
    return c.json({ error: 'Kunne ikke verificere' }, 400);
  }

  if (!verification.verified) return c.json({ error: 'Verifikation fejlede' }, 400);

  await c.env.DB.prepare(
    'UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?'
  ).bind(verification.authenticationInfo.newCounter, now(), credRow.id).run();

  const token = await signJWT(
    { sub: user.id, org: user.org_id, role: user.role as 'admin' | 'coach' },
    c.env.JWT_SECRET
  );

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRoutes.post('/logout', (c) => c.json({ ok: true }));

authRoutes.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  // Full validation handled by middleware on protected routes; here just a passthrough stub
  return c.json({ error: 'Use a protected route' }, 400);
});

// ── GET /auth/invite-info/:token  (public — fetch user info for invite page) ─
authRoutes.get('/invite-info/:token', async (c) => {
  const token = c.req.param('token');
  const row = await c.env.DB.prepare(
    'SELECT it.user_id, it.expires_at, it.used, u.name, u.email FROM invite_tokens it JOIN users u ON u.id = it.user_id WHERE it.token = ?'
  ).bind(token).first<{ user_id: string; expires_at: string; used: number; name: string; email: string }>();

  if (!row) return c.json({ error: 'Invalid invite link' }, 404);
  if (row.used) return c.json({ error: 'already_used' }, 410);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: 'expired' }, 410);

  return c.json({ name: row.name, email: row.email });
});

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
