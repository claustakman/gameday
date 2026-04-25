import { Context, Next } from 'hono';
import { jwtVerify, importHmac } from '../db/jwt';
import { Env, JWTPayload } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authorization.slice(7);
  try {
    const payload = await jwtVerify(token, c.env.JWT_SECRET);
    c.set('user', payload as JWTPayload);
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
  return next();
}
