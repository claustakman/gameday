import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { isBiometricLoginAvailable, registerBiometricDevice } from '../lib/webauthn';
import { WebauthnCredential } from '../lib/types';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();

  const [name,      setName]      = useState(user?.name ?? '');
  const [pw,        setPw]        = useState('');
  const [pwRepeat,  setPwRepeat]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const [bioSupported, setBioSupported] = useState(false);
  const [credentials,  setCredentials]  = useState<WebauthnCredential[]>([]);
  const [enrolling,    setEnrolling]    = useState(false);
  const [bioMsg,       setBioMsg]       = useState('');

  useEffect(() => {
    isBiometricLoginAvailable().then(setBioSupported).catch(() => setBioSupported(false));
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const rows = await api.get<WebauthnCredential[]>('/webauthn/credentials');
      setCredentials(rows);
    } catch {
      // ignore — section just stays empty
    }
  }

  async function enroll() {
    setBioMsg(''); setEnrolling(true);
    try {
      await registerBiometricDevice();
      await loadCredentials();
      setBioMsg('Enhed tilføjet ✓');
      setTimeout(() => setBioMsg(''), 2500);
    } catch (e) {
      setBioMsg(e instanceof Error ? e.message : 'Kunne ikke tilføje enhed');
    } finally {
      setEnrolling(false);
    }
  }

  async function removeCredential(id: string) {
    try {
      await api.delete(`/webauthn/credentials/${id}`);
      setCredentials(cs => cs.filter(c => c.id !== id));
    } catch (e) {
      setBioMsg(e instanceof Error ? e.message : 'Kunne ikke fjerne enhed');
    }
  }

  async function save() {
    if (pw && pw !== pwRepeat) { setMsg('Adgangskoderne matcher ikke'); return; }
    if (pw && pw.length < 6)   { setMsg('Adgangskoden skal være mindst 6 tegn'); return; }
    setMsg('');
    const body: Record<string, string> = {};
    if (name.trim() && name.trim() !== user?.name) body.name = name.trim();
    if (pw) body.password = pw;
    if (Object.keys(body).length === 0) { setMsg('Ingen ændringer'); return; }

    setSaving(true);
    try {
      await api.patch('/users/me', body);
      if (body.name) updateUser({ name: body.name });
      setPw(''); setPwRepeat('');
      setMsg('Gemt ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  return (
    <div className="px-4 pt-6 pb-8">
      <h2 className="text-xl font-bold text-text1 mb-6">Profil</h2>

      <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-text2 mb-1">Email</label>
          <p className="text-sm text-text3">{user?.email}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Navn</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Nyt kodeord</label>
          <input
            type="password"
            placeholder="Minimum 6 tegn"
            value={pw}
            onChange={e => setPw(e.target.value)}
            className={inputCls}
          />
        </div>

        {pw && (
          <div>
            <label className="block text-xs font-medium text-text2 mb-1.5">Gentag kodeord</label>
            <input
              type="password"
              placeholder="Gentag kodeord"
              value={pwRepeat}
              onChange={e => setPwRepeat(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

        {msg && (
          <p className={`text-xs font-medium ${msg.includes('✓') ? 'text-green' : 'text-red'}`}>{msg}</p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-green text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Gemmer…' : 'Gem profil'}
        </button>
      </div>

      {bioSupported && (
        <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-3 mb-6">
          <h3 className="text-sm font-semibold text-text1">🔐 Face ID / Touch ID</h3>
          <p className="text-xs text-text3">Log ind på denne enhed uden kodeord.</p>

          {credentials.length > 0 && (
            <div className="flex flex-col gap-2">
              {credentials.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-bg2 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-text1 font-medium">{c.device_name ?? 'Enhed'}</p>
                    <p className="text-[11px] text-text3">
                      {c.last_used_at ? `Sidst brugt ${new Date(c.last_used_at).toLocaleDateString('da-DK')}` : 'Ikke brugt endnu'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCredential(c.id)}
                    className="text-xs font-semibold text-red px-2 py-1"
                  >
                    Fjern
                  </button>
                </div>
              ))}
            </div>
          )}

          {bioMsg && (
            <p className={`text-xs font-medium ${bioMsg.includes('✓') ? 'text-green' : 'text-red'}`}>{bioMsg}</p>
          )}

          <button
            onClick={enroll}
            disabled={enrolling}
            className="w-full border border-border text-text1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {enrolling ? 'Tilføjer…' : 'Tilføj denne enhed'}
          </button>
        </div>
      )}

      <div className="border-t border-border pt-6">
        <p className="text-text2 text-sm mb-4">
          Logget ind som <strong className="text-text1">{user?.name}</strong>
          <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg2 text-text3">
            {user?.role === 'admin' ? 'Admin' : 'Træner'}
          </span>
        </p>
        <button
          onClick={logout}
          className="w-full border border-red text-red rounded-lg py-3 text-sm font-semibold"
        >
          Log ud
        </button>
      </div>
    </div>
  );
}
