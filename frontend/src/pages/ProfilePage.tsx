import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();

  const [name,      setName]      = useState(user?.name ?? '');
  const [pw,        setPw]        = useState('');
  const [pwRepeat,  setPwRepeat]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

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
