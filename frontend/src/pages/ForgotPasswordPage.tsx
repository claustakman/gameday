import { useState, FormEvent } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setSending(true);
    try {
      const r = await fetch(`${BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Fejl');
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg2 px-6">
        <div className="bg-bg rounded-2xl border border-border p-8 w-full max-w-sm text-center">
          <p className="text-4xl mb-4">📧</p>
          <h1 className="text-lg font-bold text-text1 mb-2">Tjek din email</h1>
          <p className="text-sm text-text3 mb-6">Hvis emailen findes i systemet, har vi sendt et link til nulstilling af kodeord. Linket er gyldigt i 1 time.</p>
          <a href="/" className="block w-full bg-green text-white rounded-xl py-3 font-semibold text-sm">
            Gå til login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg2 px-6">
      <div className="bg-bg rounded-2xl border border-border p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-text1 mb-1">Glemt kodeord?</h1>
        <p className="text-sm text-text3 mb-6">Indtast din email, så sender vi et link til at nulstille dit kodeord.</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text2 mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
            />
          </div>

          {err && <p className="text-red text-sm">{err}</p>}

          <button
            type="submit"
            disabled={sending || !email}
            className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50"
          >
            {sending ? 'Sender…' : 'Send nulstillingslink'}
          </button>

          <a href="/" className="text-center text-xs text-text3 hover:text-green">
            Tilbage til login
          </a>
        </form>
      </div>
    </div>
  );
}
