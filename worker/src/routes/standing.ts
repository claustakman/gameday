import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';

export const standingRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

const DHF_API   = 'https://cms.dhf.dk/api/v1';
const DHF_KEY   = '0116bbe0-8f62-4e17-b1c0-303b664d19ee';
const POOL_RE   = /\/puljer\/(\d+)/;

// Extract pool ID from a danskhaandbold.dk URL
function extractPoolId(url: string): string | null {
  const m = url.match(POOL_RE);
  return m ? m[1] : null;
}

export interface StandingRow {
  priority: number;
  teamId: number;
  teamName: string;
  matchCount: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

// GET /standing/:poolId — fetch standings from DHF and return as clean JSON
standingRoutes.get('/:poolId', async (c) => {
  const poolId = c.req.param('poolId');

  let data: Record<string, unknown>;
  try {
    const res = await fetch(`${DHF_API}/proxy?endpoint=pools/${poolId}`, {
      headers: { 'Api-Key': DHF_KEY, 'Accept': 'application/json' },
    });
    if (!res.ok) return c.json({ error: `DHF ${res.status}` }, 502);
    data = await res.json() as Record<string, unknown>;
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }

  const pool = data.Pool as Record<string, unknown> | null;
  const scoreList = data.ScoreList as Record<string, unknown>[] | null;
  const lineList  = data.LineList  as Record<string, unknown>[] | null;

  if (!scoreList || scoreList.length === 0) {
    return c.json({ poolName: (pool?.Name ?? '') as string, rows: [], lines: [] });
  }

  const rows: StandingRow[] = scoreList.map(entry => {
    const team = entry.Team as Record<string, unknown>;
    return {
      priority:     entry.Priority as number,
      teamId:       team.Id       as number,
      teamName:     (team.Name    as string).trim(),
      matchCount:   entry.MatchCount  as number,
      wins:         entry.Wins        as number,
      draws:        entry.Draws       as number,
      losses:       entry.Losses      as number,
      goalsFor:     entry.ScoreOwn      as number,
      goalsAgainst: entry.ScoreOpponent as number,
      points:       entry.MatchPoint    as number,
    };
  });

  // Lines mark promotion/relegation zones
  const lines = (lineList ?? []).map(l => ({
    position: l.Position as number,
    type:     (l.Type as Record<string, unknown>)?.Name as string,
  }));

  const row = data.Row as Record<string, unknown> | null;
  const rowName = (row?.Name as string | undefined)?.trim() ?? '';
  const poolName = (pool?.Name as string | undefined)?.trim() ?? '';
  const fullName = rowName
    ? `${rowName}${poolName ? ' — ' + poolName : ''}`
    : poolName;

  return c.json({
    poolName: fullName,
    rows,
    lines,
  });
});

// POST /standing/resolve — resolve pool ID from a danskhaandbold.dk URL
standingRoutes.post('/resolve', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const poolId = extractPoolId(url ?? '');
  if (!poolId) return c.json({ error: 'Could not extract pool ID from URL' }, 400);
  return c.json({ poolId });
});
