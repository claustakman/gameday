import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { signJWT } from '../db/jwt';

export const authRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

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

authRoutes.post('/logout', (c) => c.json({ ok: true }));

authRoutes.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  // Full validation handled by middleware on protected routes; here just a passthrough stub
  return c.json({ error: 'Use a protected route' }, 400);
});
