import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();

  const [info,     setInfo]     = useState<{ name: string; email: string } | null>(null);
  const [loadErr,  setLoadErr]  = useState('');
  const [pw,       setPw]       = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/auth/invite-info/${token}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Ugyldigt link');
        setInfo(data);
      })
      .catch(e => setLoadErr(e.message));
  }, [token]);

  async function submit() {
    if (!pw || pw.length < 6) { setErr('Adgangskoden skal være mindst 6 tegn'); return; }
    if (pw !== pwRepeat) { setErr('Adgangskoderne matcher ikke'); return; }
    setErr(''); setSaving(true);
    try {
      const r = await fetch(`${BASE}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Fejl');
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ──
  if (!info && !loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg2">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Fejl (ugyldigt/udløbet link) ──
  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg2 px-6">
        <div className="bg-bg rounded-2xl border border-border p-8 w-full max-w-sm text-center">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-lg font-bold text-text1 mb-2">Ugyldigt invitationslink</h1>
          <p className="text-sm text-text3 mb-6">{loadErr === 'already_used' ? 'Dette link er allerede brugt.' : loadErr === 'expired' ? 'Dette link er udløbet.' : loadErr}</p>
          <button onClick={() => navigate('/')} className="w-full bg-green text-white rounded-xl py-3 font-semibold text-sm">
            Gå til login
          </button>
        </div>
      </div>
    );
  }

  // ── Kodeord oprettet ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg2 px-6">
        <div className="bg-bg rounded-2xl border border-border p-8 w-full max-w-sm text-center">
          <p className="text-4xl mb-4">✅</p>
          <h1 className="text-lg font-bold text-text1 mb-2">Kodeord oprettet!</h1>
          <p className="text-sm text-text3 mb-6">Du kan nu logge ind med din email og det valgte kodeord.</p>
          <button onClick={() => navigate('/')} className="w-full bg-green text-white rounded-xl py-3 font-semibold text-sm">
            Gå til login
          </button>
        </div>
      </div>
    );
  }

  // ── Formular ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg2 px-6">
      <div className="bg-bg rounded-2xl border border-border p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-text1 mb-1">Velkommen, {info!.name}!</h1>
        <p className="text-sm text-text3 mb-6">Opret dit kodeord til <strong className="text-text1">{info!.email}</strong></p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text2 mb-1.5">Kodeord</label>
            <input
              type="password"
              placeholder="Minimum 6 tegn"
              value={pw}
              onChange={e => setPw(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text2 mb-1.5">Gentag kodeord</label>
            <input
              type="password"
              placeholder="Gentag kodeord"
              value={pwRepeat}
              onChange={e => setPwRepeat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
            />
          </div>

          {err && <p className="text-red text-sm">{err}</p>}

          <button
            onClick={submit}
            disabled={saving || !pw || !pwRepeat}
            className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Opretter…' : 'Opret kodeord'}
          </button>
        </div>
      </div>
    </div>
  );
}
