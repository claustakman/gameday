import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';

export const statsRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

statsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { season, team_id } = c.req.query();

  let gameSql = `
    SELECT g.* FROM games g
    JOIN teams t ON t.id = g.team_id
    WHERE t.org_id = ? AND g.status = 'done'
  `;
  const params: unknown[] = [user.org];

  if (team_id) { gameSql += ' AND g.team_id = ?'; params.push(team_id); }
  if (season)  { gameSql += ' AND g.season = ?';  params.push(season); }

  const games = await c.env.DB.prepare(gameSql).bind(...params).all();

  // Player stats: appearances, keeper appearances, MOTM
  const playerStatsSql = `
    SELECT p.id, p.full_name, p.nickname,
      COUNT(gr.id) as appearances,
      SUM(CASE WHEN gr.is_keeper = 1 THEN 1 ELSE 0 END) as keeper_appearances,
      SUM(CASE WHEN g.motm_player_id = p.id THEN 1 ELSE 0 END) as motm_count
    FROM players p
    JOIN game_roster gr ON gr.player_id = p.id
    JOIN games g ON g.id = gr.game_id
    JOIN teams t ON t.id = g.team_id
    WHERE t.org_id = ? AND g.status = 'done'
    ${team_id ? 'AND g.team_id = ?' : ''}
    ${season  ? 'AND g.season = ?'  : ''}
    GROUP BY p.id
    ORDER BY appearances DESC
  `;
  const playerParams: unknown[] = [user.org];
  if (team_id) playerParams.push(team_id);
  if (season)  playerParams.push(season);

  const playerStats = await c.env.DB.prepare(playerStatsSql).bind(...playerParams).all();

  // Coach stats
  const coachStatsSql = `
    SELECT co.id, co.name,
      COUNT(gr.id) as appearances
    FROM coaches co
    JOIN game_roster gr ON gr.coach_id = co.id
    JOIN games g ON g.id = gr.game_id
    JOIN teams t ON t.id = g.team_id
    WHERE t.org_id = ? AND g.status = 'done'
    ${team_id ? 'AND g.team_id = ?' : ''}
    ${season  ? 'AND g.season = ?'  : ''}
    GROUP BY co.id
    ORDER BY appearances DESC
  `;
  const coachParams: unknown[] = [user.org];
  if (team_id) coachParams.push(team_id);
  if (season)  coachParams.push(season);

  const coachStats = await c.env.DB.prepare(coachStatsSql).bind(...coachParams).all();

  return c.json({
    games: games.results,
    player_stats: playerStats.results,
    coach_stats: coachStats.results,
  });
});
