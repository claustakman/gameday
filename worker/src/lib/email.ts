import { Env } from '../types';

// Sends transactional email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error (${res.status}): ${body}`);
  }
}

export async function sendPasswordResetEmail(env: Env, to: string, name: string, token: string): Promise<void> {
  const link = `${env.CORS_ORIGIN}/reset-password/${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Gameday</h2>
      <p>Hej ${name},</p>
      <p>Vi har modtaget en anmodning om at nulstille dit kodeord. Klik på linket nedenfor for at vælge et nyt kodeord. Linket er gyldigt i 1 time.</p>
      <p><a href="${link}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Nulstil kodeord</a></p>
      <p style="color: #6b6b6b; font-size: 13px;">Hvis du ikke har anmodet om dette, kan du roligt ignorere denne email.</p>
    </div>
  `;
  await sendEmail(env, to, 'Nulstil dit kodeord — Gameday', html);
}
