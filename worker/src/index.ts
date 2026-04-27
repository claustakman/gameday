/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { authRoutes } from './routes/auth';
import { teamRoutes } from './routes/teams';
import { gameRoutes } from './routes/games';
import { playerRoutes } from './routes/players';
import { coachRoutes } from './routes/coaches';
import { statsRoutes } from './routes/stats';
import { holdsportRoutes } from './routes/holdsport';
import { seasonRoutes } from './routes/seasons';
import { userRoutes } from './routes/users';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  });
  return corsMiddleware(c, next);
});

app.route('/auth', authRoutes);

app.use('/users/*', authMiddleware);
app.use('/teams/*', authMiddleware);
app.use('/games/*', authMiddleware);
app.use('/players/*', authMiddleware);
app.use('/coaches/*', authMiddleware);
app.use('/stats/*', authMiddleware);
app.use('/holdsport/*', authMiddleware);
app.use('/seasons/*', authMiddleware);

app.route('/users', userRoutes);
app.route('/teams', teamRoutes);
app.route('/games', gameRoutes);
app.route('/players', playerRoutes);
app.route('/coaches', coachRoutes);
app.route('/stats', statsRoutes);
app.route('/holdsport', holdsportRoutes);
app.route('/seasons', seasonRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
