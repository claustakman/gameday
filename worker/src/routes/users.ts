import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

export const userRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

type UserRow = { id: string; email: string; name: string; role: string };

// ── GET /users  (admin only) ──────────────────────────────────────────
userRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const rows = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE org_id = ? ORDER BY name'
  ).bind(user.org).all<UserRow>();

  return c.json(rows.results);
});

// ── POST /users  (admin only — create user without password) ──────────
userRoutes.post('/', async (c) => {
  const actor = c.get('user');
  if (actor.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const { email, name, role } = await c.req.json<{ email: string; name: string; role: string }>();
  if (!email || !name) return c.json({ error: 'email and name required' }, 400);
  if (!['admin', 'coach'].includes(role ?? '')) return c.json({ error: 'role must be admin or coach' }, 400);

  // Check unique email within org
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND org_id = ?'
  ).bind(email, actor.org).first();
  if (existing) return c.json({ error: 'Email already in use' }, 409);

  const id = uuid();
  await c.env.DB.prepare(
    'INSERT INTO users (id, org_id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)'
  ).bind(id, actor.org, email.toLowerCase().trim(), name.trim(), role, now()).run();

  return c.json({ id, email, name, role }, 201);
});

// ── DELETE /users/:id  (admin only) ──────────────────────────────────
userRoutes.delete('/:id', async (c) => {
  const actor = c.get('user');
  if (actor.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const id = c.req.param('id');
  if (id === actor.sub) return c.json({ error: 'Cannot delete yourself' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM users WHERE id = ? AND org_id = ?'
  ).bind(id, actor.org).run();

  return c.json({ ok: true });
});

// ── POST /users/:id/invite  (admin only — generate invite link token) ─
userRoutes.post('/:id/invite', async (c) => {
  const actor = c.get('user');
  if (actor.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const id = c.req.param('id');

  // Verify user belongs to org
  const target = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ? AND org_id = ?'
  ).bind(id, actor.org).first();
  if (!target) return c.json({ error: 'User not found' }, 404);

  // Delete old unused tokens for this user
  await c.env.DB.prepare('DELETE FROM invite_tokens WHERE user_id = ? AND used = 0').bind(id).run();

  const token    = uuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await c.env.DB.prepare(
    'INSERT INTO invite_tokens (token, user_id, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)'
  ).bind(token, id, now(), expiresAt).run();

  return c.json({ token });
});

// ── GET /users/me  (own profile) ─────────────────────────────────────
userRoutes.get('/me', async (c) => {
  const actor = c.get('user');
  const row = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE id = ?'
  ).bind(actor.sub).first<UserRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// ── PATCH /users/me  (update own name and/or password) ───────────────
userRoutes.patch('/me', async (c) => {
  const actor = c.get('user');
  const { name, password } = await c.req.json<{ name?: string; password?: string }>();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (name?.trim()) { updates.push('name = ?'); values.push(name.trim()); }

  if (password) {
    if (password.length < 6) return c.json({ error: 'Password too short (min 6)' }, 400);
    const hash = await sha256(password);
    updates.push('password_hash = ?');
    values.push(hash);
  }

  if (updates.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values, actor.sub).run();

  return c.json({ ok: true });
});

// ── helpers ───────────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
