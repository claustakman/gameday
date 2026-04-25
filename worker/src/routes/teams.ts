import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

export const teamRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

teamRoutes.get('/', async (c) => {
  const user = c.get('user');
  const teams = await c.env.DB.prepare(
    'SELECT * FROM teams WHERE org_id = ? ORDER BY season DESC, name ASC'
  ).bind(user.org).all();
  return c.json(teams.results);
});

teamRoutes.post('/', async (c) => {
  const user = c.get('user');
  const { name, description, color, season, hs_team_id } = await c.req.json<{
    name: string; description?: string; color: string; season: string; hs_team_id?: string;
  }>();
  if (!name || !color || !season) return c.json({ error: 'Missing fields' }, 400);

  const id = uuid();
  await c.env.DB.prepare(
    'INSERT INTO teams (id, org_id, name, description, color, season, hs_team_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.org, name, description ?? null, color, season, hs_team_id ?? null, now()).run();

  return c.json({ id }, 201);
});

teamRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{ name: string; description: string; color: string; season: string; hs_team_id: string }>>();

  const fields = Object.entries(body)
    .filter(([k]) => ['name', 'description', 'color', 'season', 'hs_team_id'].includes(k))
    .map(([k, v]) => ({ k, v }));

  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  const set = fields.map(f => `${f.k} = ?`).join(', ');
  const values = fields.map(f => f.v);

  await c.env.DB.prepare(
    `UPDATE teams SET ${set} WHERE id = ? AND org_id = ?`
  ).bind(...values, id, user.org).run();

  return c.json({ ok: true });
});

teamRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM teams WHERE id = ? AND org_id = ?').bind(id, user.org).run();
  return c.json({ ok: true });
});
