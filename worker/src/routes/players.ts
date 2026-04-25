import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

export const playerRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

playerRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { season, team_id, active } = c.req.query();

  let sql = 'SELECT DISTINCT p.* FROM players p WHERE p.org_id = ?';
  const params: unknown[] = [user.org];

  if (active !== undefined) { sql += ' AND p.active = ?'; params.push(active === '1' || active === 'true' ? 1 : 0); }

  if (season || team_id) {
    sql += ' AND EXISTS (SELECT 1 FROM player_teams pt WHERE pt.player_id = p.id';
    if (team_id) { sql += ' AND pt.team_id = ?'; params.push(team_id); }
    if (season)  { sql += ' AND pt.season = ?';  params.push(season); }
    sql += ')';
  }

  sql += ' ORDER BY p.full_name ASC';

  const players = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(players.results);
});

playerRoutes.post('/', async (c) => {
  const user = c.get('user');
  const { full_name, nickname, birth_year, is_default_keeper } = await c.req.json<{
    full_name: string; nickname?: string; birth_year?: number; is_default_keeper?: boolean;
  }>();
  if (!full_name) return c.json({ error: 'full_name required' }, 400);

  const id = uuid();
  await c.env.DB.prepare(`
    INSERT INTO players (id, org_id, full_name, nickname, birth_year, is_default_keeper, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.org, full_name, nickname ?? null, birth_year ?? null,
    is_default_keeper ? 1 : 0, now()).run();

  return c.json({ id }, 201);
});

playerRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const allowed = ['full_name', 'nickname', 'birth_year', 'is_default_keeper', 'active', 'hs_user_id'];
  const fields = Object.entries(body).filter(([k]) => allowed.includes(k));
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  const set = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await c.env.DB.prepare(`UPDATE players SET ${set} WHERE id = ? AND org_id = ?`)
    .bind(...values, id, user.org).run();

  return c.json({ ok: true });
});
