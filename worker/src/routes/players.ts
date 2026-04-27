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

  const allowed = ['full_name', 'nickname', 'birth_year', 'shirt_number', 'primary_team_id', 'is_default_keeper', 'active', 'hs_user_id'];
  const fields = Object.entries(body).filter(([k]) => allowed.includes(k));
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  const set = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await c.env.DB.prepare(`UPDATE players SET ${set} WHERE id = ? AND org_id = ?`)
    .bind(...values, id, user.org).run();

  return c.json({ ok: true });
});

// GET /players/:id/teams — list team assignments for a player
playerRoutes.get('/:id/teams', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  // Verify player belongs to this org
  const player = await c.env.DB.prepare('SELECT id FROM players WHERE id = ? AND org_id = ?')
    .bind(id, user.org).first();
  if (!player) return c.json({ error: 'Not found' }, 404);

  const rows = await c.env.DB.prepare(
    'SELECT pt.team_id, pt.season, t.name, t.color FROM player_teams pt JOIN teams t ON t.id = pt.team_id WHERE pt.player_id = ?'
  ).bind(id).all();

  return c.json(rows.results);
});

// POST /players/:id/teams — add a single team assignment
playerRoutes.post('/:id/teams', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { team_id, season } = await c.req.json<{ team_id: string; season: string }>();
  if (!team_id || !season) return c.json({ error: 'team_id and season required' }, 400);

  // Verify player belongs to this org
  const player = await c.env.DB.prepare('SELECT id FROM players WHERE id = ? AND org_id = ?')
    .bind(id, user.org).first();
  if (!player) return c.json({ error: 'Not found' }, 404);

  // Verify team belongs to this org
  const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND org_id = ?')
    .bind(team_id, user.org).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO player_teams (player_id, team_id, season) VALUES (?, ?, ?)'
  ).bind(id, team_id, season).run();

  return c.json({ ok: true });
});

// POST /players/:id/teams/sync — replace all team assignments for a season
playerRoutes.post('/:id/teams/sync', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { season, team_ids } = await c.req.json<{ season: string; team_ids: string[] }>();
  if (!season || !Array.isArray(team_ids)) return c.json({ error: 'season and team_ids required' }, 400);

  // Verify player belongs to this org
  const player = await c.env.DB.prepare('SELECT id FROM players WHERE id = ? AND org_id = ?')
    .bind(id, user.org).first();
  if (!player) return c.json({ error: 'Not found' }, 404);

  // Delete existing assignments for this season, then re-insert
  await c.env.DB.prepare('DELETE FROM player_teams WHERE player_id = ? AND season = ?')
    .bind(id, season).run();

  for (const team_id of team_ids) {
    // Verify each team belongs to this org
    const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND org_id = ?')
      .bind(team_id, user.org).first();
    if (team) {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO player_teams (player_id, team_id, season) VALUES (?, ?, ?)'
      ).bind(id, team_id, season).run();
    }
  }

  return c.json({ ok: true });
});
