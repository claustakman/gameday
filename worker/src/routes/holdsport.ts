import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now, parseHoldsportTime } from '../db/utils';

const HS_BASE = 'https://holdsport.dk/api'; // adjust to actual proxy URL

export const holdsportRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

async function hsFetch(path: string, env: Env): Promise<unknown> {
  const credentials = btoa(`${env.HOLDSPORT_USER}:${env.HOLDSPORT_PASS}`);
  const res = await fetch(`${HS_BASE}${path}`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Holdsport ${res.status}: ${path}`);
  return res.json();
}

holdsportRoutes.post('/sync-games', async (c) => {
  const user = c.get('user');
  const { team_id, hs_team_id } = await c.req.json<{ team_id: string; hs_team_id: string }>();
  if (!team_id || !hs_team_id) return c.json({ error: 'team_id and hs_team_id required' }, 400);

  const team = await c.env.DB.prepare('SELECT id, season FROM teams WHERE id = ? AND org_id = ?')
    .bind(team_id, user.org).first<{ id: string; season: string }>();
  if (!team) return c.json({ error: 'Team not found' }, 404);

  const activities = await hsFetch(`/teams/${hs_team_id}/activities`, c.env) as { activities: HsActivity[] };

  let imported = 0;
  for (const act of activities.activities ?? []) {
    const existing = await c.env.DB.prepare('SELECT id FROM games WHERE hs_activity_id = ?')
      .bind(String(act.id)).first();
    if (existing) continue;

    const { date, time } = parseHoldsportTime(act.start_at);
    const id = uuid();
    await c.env.DB.prepare(`
      INSERT INTO games (id, team_id, season, date, time, opponent, is_home, status, hs_activity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)
    `).bind(id, team_id, team.season, date, time, act.title ?? 'Ukendt', 1, String(act.id), now()).run();
    imported++;
  }

  return c.json({ imported });
});

holdsportRoutes.post('/sync-players', async (c) => {
  const user = c.get('user');
  const { team_id, hs_team_id } = await c.req.json<{ team_id: string; hs_team_id: string }>();
  if (!team_id || !hs_team_id) return c.json({ error: 'team_id and hs_team_id required' }, 400);

  const team = await c.env.DB.prepare('SELECT id, season FROM teams WHERE id = ? AND org_id = ?')
    .bind(team_id, user.org).first<{ id: string; season: string }>();
  if (!team) return c.json({ error: 'Team not found' }, 404);

  const data = await hsFetch(`/teams/${hs_team_id}/activities`, c.env) as { users: HsUser[] };

  let imported = 0;
  for (const u of data.users ?? []) {
    const existing = await c.env.DB.prepare('SELECT id FROM players WHERE hs_user_id = ? AND org_id = ?')
      .bind(String(u.id), user.org).first<{ id: string }>();

    let playerId: string;
    if (existing) {
      playerId = existing.id;
    } else {
      playerId = uuid();
      await c.env.DB.prepare(`
        INSERT INTO players (id, org_id, full_name, hs_user_id, created_at) VALUES (?, ?, ?, ?, ?)
      `).bind(playerId, user.org, u.name, String(u.id), now()).run();
      imported++;
    }

    // Ensure player_teams entry exists
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO player_teams (player_id, team_id, season) VALUES (?, ?, ?)
    `).bind(playerId, team_id, team.season).run();
  }

  return c.json({ imported });
});

interface HsActivity {
  id: number;
  title?: string;
  start_at: string;
}

interface HsUser {
  id: number;
  name: string;
}
