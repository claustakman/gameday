import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

export const gameRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

gameRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { team_id, season, status, opponent } = c.req.query();

  let sql = `
    SELECT g.*, t.org_id FROM games g
    JOIN teams t ON t.id = g.team_id
    WHERE t.org_id = ?
  `;
  const params: unknown[] = [user.org];

  if (team_id) { sql += ' AND g.team_id = ?'; params.push(team_id); }
  if (season)  { sql += ' AND g.season = ?';  params.push(season); }
  if (status)  { sql += ' AND g.status = ?';  params.push(status); }
  if (opponent) { sql += " AND g.opponent LIKE ?"; params.push(`%${opponent}%`); }

  sql += ' ORDER BY g.date DESC';

  const games = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(games.results);
});

gameRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    team_id: string; date: string; time?: string; meetup_time?: string;
    opponent: string; location?: string; is_home?: boolean;
  }>();
  if (!body.team_id || !body.date || !body.opponent) return c.json({ error: 'Missing fields' }, 400);

  // Verify team belongs to org
  const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND org_id = ?')
    .bind(body.team_id, user.org).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);

  const id = uuid();
  const season = body.date.slice(0, 4); // derive season year from date, adjust as needed
  await c.env.DB.prepare(`
    INSERT INTO games (id, team_id, season, date, time, meetup_time, opponent, location, is_home, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.team_id, season, body.date, body.time ?? null, body.meetup_time ?? null,
    body.opponent, body.location ?? null, body.is_home !== false ? 1 : 0, now()).run();

  return c.json({ id }, 201);
});

gameRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await c.env.DB.prepare(`
    SELECT g.* FROM games g
    JOIN teams t ON t.id = g.team_id
    WHERE g.id = ? AND t.org_id = ?
  `).bind(id, user.org).first();
  if (!game) return c.json({ error: 'Not found' }, 404);
  return c.json(game);
});

gameRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const allowed = ['team_id','date','time','meetup_time','opponent','location','is_home','status',
    'result_us','result_them','focus_1','focus_2','focus_3','goal_1','goal_2','goal_3',
    'went_well','went_bad','motm_player_id'];

  const fields = Object.entries(body).filter(([k]) => allowed.includes(k));
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  const set = fields.map(([k]) => `${k} = ?`).join(', ');
  const values = fields.map(([, v]) => v);

  await c.env.DB.prepare(`
    UPDATE games SET ${set}
    WHERE id = ? AND team_id IN (SELECT id FROM teams WHERE org_id = ?)
  `).bind(...values, id, user.org).run();

  return c.json({ ok: true });
});

gameRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare(`
    DELETE FROM games WHERE id = ? AND team_id IN (SELECT id FROM teams WHERE org_id = ?)
  `).bind(id, user.org).run();
  return c.json({ ok: true });
});

gameRoutes.post('/:id/focus', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    focus_1: string; goal_1: string;
    focus_2?: string; goal_2?: string;
    focus_3?: string; goal_3?: string;
  }>();

  await c.env.DB.prepare(`
    UPDATE games SET focus_1=?, goal_1=?, focus_2=?, goal_2=?, focus_3=?, goal_3=?
    WHERE id = ? AND team_id IN (SELECT id FROM teams WHERE org_id = ?)
  `).bind(body.focus_1, body.goal_1, body.focus_2 ?? null, body.goal_2 ?? null,
    body.focus_3 ?? null, body.goal_3 ?? null, id, user.org).run();

  return c.json({ ok: true });
});

gameRoutes.patch('/:id/tally', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { field, delta } = await c.req.json<{ field: 'tally_1' | 'tally_2' | 'tally_3'; delta: 1 | -1 }>();

  if (!['tally_1', 'tally_2', 'tally_3'].includes(field)) return c.json({ error: 'Invalid field' }, 400);
  if (delta !== 1 && delta !== -1) return c.json({ error: 'Invalid delta' }, 400);

  await c.env.DB.prepare(`
    UPDATE games SET ${field} = MAX(0, ${field} + ?)
    WHERE id = ? AND team_id IN (SELECT id FROM teams WHERE org_id = ?)
  `).bind(delta, id, user.org).run();

  return c.json({ ok: true });
});

gameRoutes.post('/:id/finish', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    result_us: number; result_them: number;
    went_well?: string; went_bad?: string; motm_player_id?: string;
  }>();

  await c.env.DB.prepare(`
    UPDATE games SET status='done', result_us=?, result_them=?, went_well=?, went_bad=?, motm_player_id=?
    WHERE id = ? AND team_id IN (SELECT id FROM teams WHERE org_id = ?)
  `).bind(body.result_us, body.result_them, body.went_well ?? null, body.went_bad ?? null,
    body.motm_player_id ?? null, id, user.org).run();

  return c.json({ ok: true });
});

// --- Roster ---

gameRoutes.get('/:id/roster', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const roster = await c.env.DB.prepare(`
    SELECT gr.*, p.full_name as player_name, p.nickname, co.name as coach_name
    FROM game_roster gr
    LEFT JOIN players p ON p.id = gr.player_id
    LEFT JOIN coaches co ON co.id = gr.coach_id
    WHERE gr.game_id = ?
    AND EXISTS (
      SELECT 1 FROM games g JOIN teams t ON t.id = g.team_id
      WHERE g.id = gr.game_id AND t.org_id = ?
    )
  `).bind(id, user.org).all();

  // Dobbeltbooking-check
  const gameRow = await c.env.DB.prepare('SELECT date FROM games WHERE id = ?').bind(id).first<{ date: string }>();
  let doubleBooked: unknown[] = [];

  if (gameRow) {
    const playerIds = roster.results
      .filter((r: Record<string, unknown>) => r.player_id)
      .map((r: Record<string, unknown>) => r.player_id as string);

    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(',');
      const conflicts = await c.env.DB.prepare(`
        SELECT gr2.player_id, p.full_name as name, g2.id as other_game_id, t2.name as other_team_name
        FROM game_roster gr2
        JOIN games g2 ON g2.id = gr2.game_id
        JOIN teams t2 ON t2.id = g2.team_id
        JOIN players p ON p.id = gr2.player_id
        WHERE gr2.player_id IN (${placeholders})
          AND g2.date = ?
          AND g2.id != ?
          AND t2.org_id = ?
      `).bind(...playerIds, gameRow.date, id, user.org).all();
      doubleBooked = conflicts.results;
    }
  }

  return c.json({ roster: roster.results, double_booked_players: doubleBooked });
});

gameRoutes.post('/:id/roster', async (c) => {
  const gameId = c.req.param('id');
  const { player_id, coach_id, is_keeper } = await c.req.json<{
    player_id?: string; coach_id?: string; is_keeper?: boolean;
  }>();

  if (!player_id && !coach_id) return c.json({ error: 'player_id or coach_id required' }, 400);

  const id = uuid();
  await c.env.DB.prepare(`
    INSERT INTO game_roster (id, game_id, player_id, coach_id, is_keeper, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, gameId, player_id ?? null, coach_id ?? null, is_keeper ? 1 : 0, now()).run();

  return c.json({ id }, 201);
});

gameRoutes.delete('/:id/roster/:rosterId', async (c) => {
  const rosterId = c.req.param('rosterId');
  await c.env.DB.prepare('DELETE FROM game_roster WHERE id = ?').bind(rosterId).run();
  return c.json({ ok: true });
});
