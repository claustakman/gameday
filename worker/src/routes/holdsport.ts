import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';
import { uuid, now } from '../db/utils';

const HS_BASE = 'https://api.holdsport.dk/v1';

export const holdsportRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

// ── Holdsport API helper ────────────────────────────────────────────────────

async function hsFetch(path: string, env: Env): Promise<unknown> {
  const credentials = btoa(`${env.HOLDSPORT_USER}:${env.HOLDSPORT_PASS}`);
  const res = await fetch(`${HS_BASE}${path}`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Holdsport ${res.status}: ${path}`);
  return res.json();
}

// ── Holdsport types ─────────────────────────────────────────────────────────

interface HsActivity {
  id: number;
  name?: string;
  title?: string;
  starttime?: string;    // "2026-04-03T16:30:00"
  endtime?: string;
  place?: string;
  location?: string;
  activities_users?: HsActivityUser[];
}

interface HsActivityUser {
  id: number;        // enrollment object ID (not the user ID)
  user_id?: number;  // actual Holdsport user ID — maps to hs_user_id
  name: string;
  status_code?: number;  // 4 = Udvalgt (selected/attending), 5 = Ukendt
  number?: string | number;
  birthday?: string;
}

interface HsMember {
  id: number;
  firstname: string;
  lastname: string;
  role: number;          // 1 = player, 2 = coach/adult
  birthday?: string;     // "YYYY-MM-DD"
  member_number?: string;
}

// ── Parse Holdsport timestamp ───────────────────────────────────────────────
// Holdsport returns "2026-05-31T13:00:00+02:00" — strip timezone, use local time as-is

function parseHsTime(ts?: string): { date: string; time: string | null } {
  if (!ts) return { date: '', time: null };
  // Strip timezone offset: "2026-05-31T13:00:00+02:00" → "2026-05-31T13:00:00"
  const local = ts.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
  const [date, timePart] = local.split('T');
  const time = (!timePart || timePart.startsWith('00:00')) ? null : timePart.slice(0, 5);
  return { date, time };
}

// ── Activity parsing ────────────────────────────────────────────────────────
// Holdsport name format: "Træningskamp: Ajax København - Holte"
//                        "Kamp: Ajax København 2 - Holte 2"
//                        "Træning U13 Hafnia"  ← not a game

// Returns null if activity is not a game
function parseActivity(activity: HsActivity, appTeams: { id: string; name: string }[]): {
  opponent: string;
  isHome: boolean;
  location: string | null;
  teamId: string | null;  // matched app team id, or null = unmatched (assign manually)
} | null {
  const title = (activity.name || activity.title || '').trim();
  const place = activity.place || activity.location || null;

  // Must contain " - " to be a game (separator between our team and opponent)
  if (!title.includes(' - ')) return null;
  // Must start with a game-type prefix or contain a known team name
  const isGameType = /^(kamp|træningskamp|stævne|cup|turneringskamp)/i.test(title);
  const containsTeamName = appTeams.some(t => title.toLowerCase().includes(t.name.toLowerCase()));
  if (!isGameType && !containsTeamName) return null;

  // Strip prefix (everything before and including ": ")
  const withoutPrefix = title.includes(': ') ? title.split(': ').slice(1).join(': ') : title;

  // Split on " - " → ["Ajax København 2", "Holte 2"]
  const dashIdx = withoutPrefix.indexOf(' - ');
  if (dashIdx === -1) return null;

  const leftTeam  = withoutPrefix.slice(0, dashIdx).trim();
  const rightTeam = withoutPrefix.slice(dashIdx + 3).trim();

  // Find which app team is on the left (we are home) or right (we are away)
  let matchedTeamId: string | null = null;
  let opponent = '';
  let isHome = true;

  // Sort longest name first to avoid "Ajax København" matching before "Ajax København 2"
  const sortedTeams = [...appTeams].sort((a, b) => b.name.length - a.name.length);
  for (const t of sortedTeams) {
    const tLower = t.name.toLowerCase();
    if (leftTeam.toLowerCase().includes(tLower) || tLower.includes(leftTeam.toLowerCase())) {
      matchedTeamId = t.id;
      opponent = rightTeam;
      isHome = true;
      break;
    }
    if (rightTeam.toLowerCase().includes(tLower) || tLower.includes(rightTeam.toLowerCase())) {
      matchedTeamId = t.id;
      opponent = leftTeam;
      isHome = false;
      break;
    }
  }

  // If no team matched, use left side as "our team" and right as opponent
  if (!matchedTeamId) {
    opponent = rightTeam;
    isHome = true;
  }

  return { opponent: opponent || rightTeam || title, isHome, location: place, teamId: matchedTeamId };
}

// ── Birth year extraction ───────────────────────────────────────────────────

function extractBirthYear(birthday?: string): number | null {
  if (!birthday) return null;
  // Formats: "2012-03-15", "15/03/2012", "2012"
  const match = birthday.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// ── GET /holdsport/teams ────────────────────────────────────────────────────
// Proxy Holdsport /teams so frontend can discover hs_team_id values

holdsportRoutes.get('/teams', async (c) => {
  if (!c.env.HOLDSPORT_USER || !c.env.HOLDSPORT_PASS) {
    return c.json({ error: 'Holdsport credentials not configured (HOLDSPORT_USER / HOLDSPORT_PASS)' }, 503);
  }
  let data: unknown;
  try {
    data = await hsFetch('/teams', c.env);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
  const raw = data as Record<string, unknown>;
  const teams = Array.isArray(data) ? data : Array.isArray(raw.teams) ? raw.teams : [];
  return c.json(teams);
});

// ── GET /holdsport/users/:hs_team_id ───────────────────────────────────────
// Tries multiple Holdsport endpoints to find user/member list

holdsportRoutes.get('/users/:hs_team_id', async (c) => {
  const id = c.req.param('hs_team_id');
  const results: Record<string, unknown> = {};
  for (const path of [
    `/teams/${id}/users`,
    `/teams/${id}/members`,
    `/teams/${id}/participants`,
    `/activities/${id}/users`,
  ]) {
    try {
      results[path] = await hsFetch(path, c.env);
    } catch (e) {
      results[path] = String(e);
    }
  }
  return c.json(results);
});

// ── GET /holdsport/activity-debug/:activity_id ─────────────────────────────
// Tries multiple endpoints to find attendees for an activity

holdsportRoutes.get('/activity-debug/:activity_id', async (c) => {
  const id = c.req.param('activity_id');
  const results: Record<string, unknown> = {};
  for (const path of [
    `/activities/${id}`,
    `/activities/${id}/users`,
    `/activities/${id}/members`,
    `/activities/${id}/participants`,
    `/activities/${id}/attendees`,
    `/activities/${id}/signups`,
  ]) {
    try {
      const data = await hsFetch(path, c.env);
      // If it's the base activity, show only keys to keep response small
      results[path] = data;
    } catch (e) {
      results[path] = String(e);
    }
  }
  return c.json(results);
});

// ── GET /holdsport/activities/:hs_team_id ──────────────────────────────────
// Debug: returns raw activity list so we can inspect name format

holdsportRoutes.get('/activities/:hs_team_id', async (c) => {
  const hsTeamId = c.req.param('hs_team_id');
  let data: unknown;
  try {
    data = await hsFetch(`/teams/${hsTeamId}/activities`, c.env);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
  const raw = data as Record<string, unknown>;
  const activities = Array.isArray(data) ? data : Array.isArray(raw.activities) ? raw.activities : data;
  // Return first 10 with just the fields we care about
  const preview = (Array.isArray(activities) ? activities : []).map((a: Record<string, unknown>) => ({
    id: a.id, name: a.name, title: a.title, starttime: a.starttime, place: a.place,
  }));
  return c.json({ total: Array.isArray(activities) ? activities.length : '?', preview });
});

// ── POST /holdsport/sync-games ──────────────────────────────────────────────
// Imports games from a single Holdsport team (hs_team_id).
// Maps each activity to an app team by matching team names in the activity title.
// body: { hs_team_id, season } — syncs all app teams in that season

holdsportRoutes.post('/sync-games', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ hs_team_id: string | number; season: string }>();
  const { hs_team_id, season } = body;
  if (!hs_team_id || !season) return c.json({ error: 'hs_team_id and season required' }, 400);

  // Load all app teams for this org+season
  const teamsResult = await c.env.DB.prepare(
    'SELECT id, name FROM teams WHERE org_id = ? AND season = ?'
  ).bind(user.org, season).all<{ id: string; name: string }>();
  const appTeams = teamsResult.results;
  if (appTeams.length === 0) return c.json({ error: `No teams found for season ${season}` }, 404);

  let data: unknown;
  try {
    data = await hsFetch(`/teams/${hs_team_id}/activities`, c.env);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }

  const raw = data as Record<string, unknown>;
  const activities: HsActivity[] = (
    Array.isArray(data) ? data :
    Array.isArray(raw.activities) ? raw.activities as HsActivity[] :
    []
  );

  let imported = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const act of activities) {
    const hsId = String(act.id);

    // Skip if already imported
    const existing = await c.env.DB.prepare('SELECT id FROM games WHERE hs_activity_id = ?')
      .bind(hsId).first();
    if (existing) { skipped++; continue; }

    const parsed = parseActivity(act, appTeams);
    if (!parsed) { skipped++; continue; }  // not a game activity

    const { date, time } = parseHsTime(act.starttime);
    if (!date) continue;

    // If no team matched by name, skip (can't assign to a team)
    if (!parsed.teamId) { unmatched++; continue; }

    const id = uuid();
    await c.env.DB.prepare(`
      INSERT INTO games (id, team_id, season, date, time, opponent, location, is_home, status, hs_activity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)
    `).bind(
      id, parsed.teamId, season, date, time,
      parsed.opponent, parsed.location, parsed.isHome ? 1 : 0,
      hsId, now()
    ).run();

    imported++;
  }

  return c.json({ imported, skipped, unmatched, total: activities.length });
});

// ── POST /holdsport/import-games ───────────────────────────────────────────
// Import a user-selected list of activities as games.
// Body: { items: [{ hs_activity_id, team_id, opponent, is_home, location?, date, time? }] }

interface ImportGameItem {
  hs_activity_id: string;
  team_id: string;
  opponent: string;
  is_home: boolean;
  location?: string | null;
  date: string;
  time?: string | null;
}

holdsportRoutes.post('/import-games', async (c) => {
  const user = c.get('user');
  const { items } = await c.req.json<{ items: ImportGameItem[] }>();
  if (!Array.isArray(items) || items.length === 0) return c.json({ error: 'items required' }, 400);

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    // Verify team belongs to org
    const team = await c.env.DB.prepare('SELECT id, season FROM teams WHERE id = ? AND org_id = ?')
      .bind(item.team_id, user.org).first<{ id: string; season: string }>();
    if (!team) { skipped++; continue; }

    // Skip if already imported
    const existing = await c.env.DB.prepare('SELECT id FROM games WHERE hs_activity_id = ?')
      .bind(item.hs_activity_id).first();
    if (existing) { skipped++; continue; }

    const id = uuid();
    await c.env.DB.prepare(`
      INSERT INTO games (id, team_id, season, date, time, opponent, location, is_home, status, hs_activity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)
    `).bind(
      id, item.team_id, team.season,
      item.date, item.time ?? null,
      item.opponent, item.location ?? null,
      item.is_home ? 1 : 0,
      item.hs_activity_id, now()
    ).run();
    imported++;
  }

  return c.json({ imported, skipped });
});

// ── POST /holdsport/sync-players ────────────────────────────────────────────
// Imports members from Holdsport /teams/:id/members.
// role=1 → players, role=2 → coaches.
// Matches existing records by hs_user_id, then by full name.

holdsportRoutes.post('/sync-players', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ team_id: string; hs_team_id: string | number }>();
  const { team_id, hs_team_id } = body;
  if (!team_id || !hs_team_id) return c.json({ error: 'team_id and hs_team_id required' }, 400);

  const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND org_id = ?')
    .bind(team_id, user.org).first();
  if (!team) return c.json({ error: 'Team not found' }, 404);

  let data: unknown;
  try {
    data = await hsFetch(`/teams/${hs_team_id}/members`, c.env);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }

  const members: HsMember[] = Array.isArray(data) ? data as HsMember[] : [];

  let playersImported = 0;
  let playersUpdated = 0;
  let coachesImported = 0;
  let coachesUpdated = 0;
  const seen = new Set<string>(); // deduplicate by "name+birthday"

  for (const m of members) {
    const hsUserId = String(m.id);
    const fullName = `${m.firstname} ${m.lastname}`.replace(/\s+/g, ' ').trim();
    if (!fullName) continue;

    // Skip duplicate entries (same name + birthday)
    const dedupeKey = `${fullName}|${m.birthday ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const birthYear = m.birthday ? parseInt(m.birthday.slice(0, 4)) : null;
    const isCoach = m.role === 2;

    if (isCoach) {
      // ── Coach ──────────────────────────────────────────────
      let existing = await c.env.DB.prepare(
        'SELECT id FROM coaches WHERE hs_user_id = ? AND org_id = ?'
      ).bind(hsUserId, user.org).first<{ id: string }>();

      if (!existing) {
        existing = await c.env.DB.prepare(
          'SELECT id FROM coaches WHERE name = ? AND org_id = ? AND (hs_user_id IS NULL OR hs_user_id = "")'
        ).bind(fullName, user.org).first<{ id: string }>();
      }

      if (existing) {
        await c.env.DB.prepare('UPDATE coaches SET name = ?, hs_user_id = ? WHERE id = ?')
          .bind(fullName, hsUserId, existing.id).run();
        coachesUpdated++;
      } else {
        await c.env.DB.prepare(
          'INSERT INTO coaches (id, org_id, name, hs_user_id, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(uuid(), user.org, fullName, hsUserId, now()).run();
        coachesImported++;
      }
    } else {
      // ── Player ─────────────────────────────────────────────
      let existing = await c.env.DB.prepare(
        'SELECT id, primary_team_id FROM players WHERE hs_user_id = ? AND org_id = ?'
      ).bind(hsUserId, user.org).first<{ id: string; primary_team_id: string | null }>();

      if (!existing) {
        existing = await c.env.DB.prepare(
          'SELECT id, primary_team_id FROM players WHERE full_name = ? AND org_id = ? AND (hs_user_id IS NULL OR hs_user_id = "")'
        ).bind(fullName, user.org).first<{ id: string; primary_team_id: string | null }>();
      }

      if (existing) {
        const patches: string[] = ['full_name = ?', 'hs_user_id = ?'];
        const pvals: unknown[] = [fullName, hsUserId];
        if (birthYear !== null) { patches.push('birth_year = ?'); pvals.push(birthYear); }
        if (!existing.primary_team_id) { patches.push('primary_team_id = ?'); pvals.push(team_id); }
        await c.env.DB.prepare(`UPDATE players SET ${patches.join(', ')} WHERE id = ?`)
          .bind(...pvals, existing.id).run();
        playersUpdated++;
      } else {
        await c.env.DB.prepare(`
          INSERT INTO players (id, org_id, full_name, birth_year, primary_team_id, hs_user_id, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(uuid(), user.org, fullName, birthYear, team_id, hsUserId, now()).run();
        playersImported++;
      }
    }
  }

  return c.json({
    players: { imported: playersImported, updated: playersUpdated },
    coaches: { imported: coachesImported, updated: coachesUpdated },
    total: members.length,
  });
});

// ── POST /holdsport/sync-game-players ──────────────────────────────────────
// For a specific game: fetches the Holdsport activity (which embeds activities_users
// and activities_coaches) and syncs attending players/coaches to game_roster.

interface HsActivityFull {
  id: number;
  activities_users?: HsActivityUser[];
  activities_coaches?: HsActivityUser[];
}

holdsportRoutes.post('/sync-game-players', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ game_id: string }>();
  const { game_id } = body;
  if (!game_id) return c.json({ error: 'game_id required' }, 400);

  // Get game with hs_activity_id + verify org ownership
  const game = await c.env.DB.prepare(`
    SELECT g.id, g.hs_activity_id FROM games g
    JOIN teams t ON t.id = g.team_id
    WHERE g.id = ? AND t.org_id = ?
  `).bind(game_id, user.org).first<{ id: string; hs_activity_id: string | null }>();

  if (!game) return c.json({ error: 'Game not found' }, 404);
  if (!game.hs_activity_id) return c.json({ error: 'Game has no Holdsport activity ID' }, 400);

  let data: unknown;
  try {
    data = await hsFetch(`/activities/${game.hs_activity_id}`, c.env);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }

  // /activities/:id returns an array with one item
  const activity: HsActivityFull = (Array.isArray(data) ? data[0] : data) as HsActivityFull;
  if (!activity) return c.json({ error: 'Activity not found' }, 404);

  // status_code 1 = Tilmeldt (signed up)
  const attendingPlayers = (activity.activities_users ?? []).filter(u => u.status_code === 1);
  const attendingCoaches = (activity.activities_coaches ?? []).filter(u => u.status_code === 1);

  // Build sets of hs_user_ids that should be on the roster
  const attendingPlayerHsIds = new Set(attendingPlayers.map(u => String(u.user_id ?? u.id)));
  const attendingCoachHsIds  = new Set(attendingCoaches.map(u => String(u.user_id ?? u.id)));

  let added = 0;
  let removed = 0;

  // ── Remove players no longer signed up ───────────────────────────────────
  const currentPlayers = await c.env.DB.prepare(`
    SELECT gr.id, gr.player_id, p.hs_user_id
    FROM game_roster gr
    JOIN players p ON p.id = gr.player_id
    WHERE gr.game_id = ? AND gr.player_id IS NOT NULL
  `).bind(game_id).all<{ id: string; player_id: string; hs_user_id: string | null }>();

  for (const entry of currentPlayers.results) {
    if (entry.hs_user_id && !attendingPlayerHsIds.has(entry.hs_user_id)) {
      await c.env.DB.prepare('DELETE FROM game_roster WHERE id = ?').bind(entry.id).run();
      removed++;
    }
  }

  // ── Remove coaches no longer signed up ───────────────────────────────────
  const currentCoaches = await c.env.DB.prepare(`
    SELECT gr.id, gr.coach_id, co.hs_user_id
    FROM game_roster gr
    JOIN coaches co ON co.id = gr.coach_id
    WHERE gr.game_id = ? AND gr.coach_id IS NOT NULL
  `).bind(game_id).all<{ id: string; coach_id: string; hs_user_id: string | null }>();

  for (const entry of currentCoaches.results) {
    if (entry.hs_user_id && !attendingCoachHsIds.has(entry.hs_user_id)) {
      await c.env.DB.prepare('DELETE FROM game_roster WHERE id = ?').bind(entry.id).run();
      removed++;
    }
  }

  // ── Add newly signed-up players ───────────────────────────────────────────
  for (const u of attendingPlayers) {
    const hsUserId = String(u.user_id ?? u.id);
    const player = await c.env.DB.prepare(
      'SELECT id FROM players WHERE hs_user_id = ? AND org_id = ?'
    ).bind(hsUserId, user.org).first<{ id: string }>();
    if (!player) continue;

    const onRoster = await c.env.DB.prepare(
      'SELECT id FROM game_roster WHERE game_id = ? AND player_id = ?'
    ).bind(game_id, player.id).first();
    if (onRoster) continue;

    await c.env.DB.prepare(
      'INSERT INTO game_roster (id, game_id, player_id, is_keeper, created_at) VALUES (?, ?, ?, 0, ?)'
    ).bind(uuid(), game_id, player.id, now()).run();
    added++;
  }

  // ── Add newly signed-up coaches ───────────────────────────────────────────
  for (const u of attendingCoaches) {
    const hsUserId = String(u.user_id ?? u.id);
    const coach = await c.env.DB.prepare(
      'SELECT id FROM coaches WHERE hs_user_id = ? AND org_id = ?'
    ).bind(hsUserId, user.org).first<{ id: string }>();
    if (!coach) continue;

    const onRoster = await c.env.DB.prepare(
      'SELECT id FROM game_roster WHERE game_id = ? AND coach_id = ?'
    ).bind(game_id, coach.id).first();
    if (onRoster) continue;

    await c.env.DB.prepare(
      'INSERT INTO game_roster (id, game_id, coach_id, is_keeper, created_at) VALUES (?, ?, ?, 0, ?)'
    ).bind(uuid(), game_id, coach.id, now()).run();
    added++;
  }

  return c.json({ added, removed, total: attendingPlayers.length + attendingCoaches.length });
});
