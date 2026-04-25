import { Hono } from 'hono';
import { Env, JWTPayload } from '../types';

export const seasonRoutes = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

seasonRoutes.get('/:season/config', async (c) => {
  const user = c.get('user');
  const season = c.req.param('season');
  const row = await c.env.DB.prepare(
    'SELECT webcal_url FROM season_config WHERE org_id = ? AND season = ?'
  ).bind(user.org, season).first<{ webcal_url: string | null }>();
  return c.json({ season, webcal_url: row?.webcal_url ?? null });
});

seasonRoutes.put('/:season/config', async (c) => {
  const user = c.get('user');
  const season = c.req.param('season');
  const { webcal_url } = await c.req.json<{ webcal_url: string | null }>();

  await c.env.DB.prepare(`
    INSERT INTO season_config (org_id, season, webcal_url)
    VALUES (?, ?, ?)
    ON CONFLICT (org_id, season) DO UPDATE SET webcal_url = excluded.webcal_url
  `).bind(user.org, season, webcal_url ?? null).run();

  return c.json({ ok: true });
});
