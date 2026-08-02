import { Env } from '../types';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min

export function rpConfig(env: Env): { rpName: string; rpID: string; origin: string } {
  const origin = env.CORS_ORIGIN;
  return { rpName: 'Gameday', rpID: new URL(origin).hostname, origin };
}

export async function saveChallenge(env: Env, userId: string, challenge: string, type: 'register' | 'authenticate'): Promise<void> {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO webauthn_challenges (user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, challenge, type, expiresAt).run();
}

// Consumes (deletes) the stored challenge and returns it if still valid, else null
export async function consumeChallenge(env: Env, userId: string, type: 'register' | 'authenticate'): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT challenge, expires_at FROM webauthn_challenges WHERE user_id = ? AND type = ?'
  ).bind(userId, type).first<{ challenge: string; expires_at: string }>();

  await env.DB.prepare('DELETE FROM webauthn_challenges WHERE user_id = ?').bind(userId).run();

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row.challenge;
}

export function guessDeviceName(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Enhed';
}
