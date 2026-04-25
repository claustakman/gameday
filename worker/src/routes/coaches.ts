import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

export const coachRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

coachRoutes.get('/', async (c) => {
  const user = c.get('user');
  const coaches = await c.env.DB.prepare(
    'SELECT * FROM coaches WHERE org_id = ? ORDER BY name ASC'
  ).bind(user.org).all();
  return c.json(coaches.results);
});

coachRoutes.post('/', async (c) => {
  const user = c.get('user');
  const { name } = await c.req.json<{ name: string }>();
  if (!name) return c.json({ error: 'name required' }, 400);

  const id = uuid();
  await c.env.DB.prepare(
    'INSERT INTO coaches (id, org_id, name, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, user.org, name, now()).run();

  return c.json({ id }, 201);
});

coachRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{ name: string; hs_user_id: string }>>();

  const fields = Object.entries(body).filter(([k]) => ['name', 'hs_user_id'].includes(k));
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  const set = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await c.env.DB.prepare(`UPDATE coaches SET ${set} WHERE id = ? AND org_id = ?`)
    .bind(...values, id, user.org).run();

  return c.json({ ok: true });
});
