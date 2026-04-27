import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Player } from '../lib/types';

export default function SquadPage() {
  const [players,  setPlayers]  = useState<Player[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [showInactive, setShowInactive] = useState(false);
  const [yearFilter,   setYearFilter]   = useState('');
  const [showAdd,      setShowAdd]      = useState(false);

  useEffect(() => {
    api.get<Player[]>('/players')
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Unikke årgange til filter-chips
  const years = Array.from(
    new Set(players.map(p => p.birth_year).filter(Boolean) as number[])
  ).sort();

  const visible = players.filter(p => {
    if (!showInactive && p.active === 0) return false;
    if (yearFilter && String(p.birth_year) !== yearFilter) return false;
    return true;
  });

  const active   = visible.filter(p => p.active === 1);
  const inactive = visible.filter(p => p.active === 0);

  function onUpdated(updated: Player) {
    setPlayers(ps => ps.map(p => p.id === updated.id ? updated : p));
  }

  function onAdded(p: Player) {
    setPlayers(ps => [...ps, p]);
    setShowAdd(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-bg px-4 pt-6 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text1">Trup</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 bg-green text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ny spiller
          </button>
        </div>

        {/* Årgangfilter */}
        {years.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <ChipButton active={yearFilter === ''} onClick={() => setYearFilter('')}>Alle</ChipButton>
            {years.map(y => (
              <ChipButton
                key={y}
                active={yearFilter === String(y)}
                onClick={() => setYearFilter(yearFilter === String(y) ? '' : String(y))}
              >
                {y}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-1">
        {active.length === 0 && (
          <p className="text-center text-text3 text-sm pt-12">
            {yearFilter ? `Ingen spillere fra ${yearFilter}` : 'Ingen spillere endnu — tilføj den første'}
          </p>
        )}

        {active.map(p => (
          <PlayerRow key={p.id} player={p} onUpdated={onUpdated} />
        ))}

        {inactive.length > 0 && (
          <button
            onClick={() => setShowInactive(s => !s)}
            className="flex items-center gap-2 text-xs text-text3 py-3 mt-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={showInactive ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
            </svg>
            {showInactive ? 'Skjul' : 'Vis'} inaktive ({inactive.length})
          </button>
        )}

        {showInactive && inactive.map(p => (
          <PlayerRow key={p.id} player={p} onUpdated={onUpdated} />
        ))}
      </div>

      {showAdd && (
        <AddPlayerSheet
          onClose={() => setShowAdd(false)}
          onAdded={onAdded}
        />
      )}
    </div>
  );
}

/* ─── PlayerRow ──────────────────────────────────────────────────── */
function PlayerRow({ player, onUpdated }: {
  player: Player;
  onUpdated: (p: Player) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  const displayName = player.nickname
    ? `${player.nickname} (${player.full_name})`
    : player.full_name;

  return (
    <>
      <button
        onClick={() => setShowEdit(true)}
        className={`w-full text-left bg-bg rounded-xl border border-border px-4 py-3 flex items-center gap-3 active:bg-bg2 transition-colors ${player.active === 0 ? 'opacity-50' : ''}`}
      >
        {/* Nummer / Avatar */}
        <div className="w-9 h-9 rounded-full bg-bg2 flex items-center justify-center shrink-0">
          {player.shirt_number != null
            ? <span className="text-sm font-bold text-text2">{player.shirt_number}</span>
            : <span className="text-sm font-bold text-text2">{initials(player.full_name)}</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text1 text-sm truncate">{displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {player.birth_year && (
              <span className="text-xs text-text3">{player.birth_year}</span>
            )}
            {player.is_default_keeper === 1 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bg2 text-text2">Keeper</span>
            )}
            {player.active === 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bg2 text-text3">Inaktiv</span>
            )}
          </div>
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text3 shrink-0">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      {showEdit && (
        <EditPlayerSheet
          player={player}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { onUpdated(updated); setShowEdit(false); }}
        />
      )}
    </>
  );
}

/* ─── AddPlayerSheet ─────────────────────────────────────────────── */
function AddPlayerSheet({ onClose, onAdded }: {
  onClose: () => void;
  onAdded: (p: Player) => void;
}) {
  const [fullName,     setFullName]     = useState('');
  const [nickname,     setNickname]     = useState('');
  const [birthYear,    setBirthYear]    = useState('');
  const [shirtNumber,  setShirtNumber]  = useState('');
  const [isKeeper,     setIsKeeper]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      const { id } = await api.post<{ id: string }>('/players', {
        full_name:         fullName.trim(),
        nickname:          nickname.trim() || null,
        birth_year:        birthYear   ? parseInt(birthYear)   : null,
        shirt_number:      shirtNumber ? parseInt(shirtNumber) : null,
        is_default_keeper: isKeeper,
      });

      onAdded({
        id, org_id: '',
        full_name:         fullName.trim(),
        nickname:          nickname.trim() || null,
        birth_year:        birthYear   ? parseInt(birthYear)   : null,
        shirt_number:      shirtNumber ? parseInt(shirtNumber) : null,
        is_default_keeper: isKeeper ? 1 : 0,
        hs_user_id: null, active: 1,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Ny spiller" onClose={onClose} scrollable>
      <PlayerForm
        fullName={fullName} setFullName={setFullName}
        nickname={nickname} setNickname={setNickname}
        birthYear={birthYear} setBirthYear={setBirthYear}
        shirtNumber={shirtNumber} setShirtNumber={setShirtNumber}
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        error={error}
      />
      <div className="pt-4 border-t border-border mt-2">
        <button onClick={save} disabled={saving || !fullName.trim()}
          className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
          {saving ? 'Gemmer…' : 'Opret spiller'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── EditPlayerSheet ────────────────────────────────────────────── */
function EditPlayerSheet({ player, onClose, onSaved }: {
  player: Player;
  onClose: () => void;
  onSaved: (p: Player) => void;
}) {
  const [fullName,    setFullName]    = useState(player.full_name);
  const [nickname,    setNickname]    = useState(player.nickname ?? '');
  const [birthYear,   setBirthYear]   = useState(player.birth_year   ? String(player.birth_year)   : '');
  const [shirtNumber, setShirtNumber] = useState(player.shirt_number != null ? String(player.shirt_number) : '');
  const [isKeeper,    setIsKeeper]    = useState(player.is_default_keeper === 1);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch(`/players/${player.id}`, {
        full_name:         fullName.trim(),
        nickname:          nickname.trim() || null,
        birth_year:        birthYear   ? parseInt(birthYear)   : null,
        shirt_number:      shirtNumber ? parseInt(shirtNumber) : null,
        is_default_keeper: isKeeper ? 1 : 0,
      });

      onSaved({
        ...player,
        full_name:         fullName.trim(),
        nickname:          nickname.trim() || null,
        birth_year:        birthYear   ? parseInt(birthYear)   : null,
        shirt_number:      shirtNumber ? parseInt(shirtNumber) : null,
        is_default_keeper: isKeeper ? 1 : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const newActive = player.active === 1 ? 0 : 1;
    await api.patch(`/players/${player.id}`, { active: newActive });
    onSaved({ ...player, active: newActive });
  }

  return (
    <BottomSheet title="Rediger spiller" onClose={onClose} scrollable>
      <PlayerForm
        fullName={fullName} setFullName={setFullName}
        nickname={nickname} setNickname={setNickname}
        birthYear={birthYear} setBirthYear={setBirthYear}
        shirtNumber={shirtNumber} setShirtNumber={setShirtNumber}
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        error={error}
      />
      <div className="pt-4 border-t border-border mt-2 flex flex-col gap-2">
        <button onClick={save} disabled={saving}
          className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
          {saving ? 'Gemmer…' : 'Gem ændringer'}
        </button>
        <button onClick={toggleActive}
          className={`w-full border rounded-xl py-3 font-semibold text-sm ${
            player.active === 1
              ? 'border-border text-text2'
              : 'border-green text-green'
          }`}>
          {player.active === 1 ? 'Sæt inaktiv' : 'Sæt aktiv'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── Delt formular ──────────────────────────────────────────────── */
function PlayerForm({
  fullName, setFullName, nickname, setNickname,
  birthYear, setBirthYear, shirtNumber, setShirtNumber,
  isKeeper, setIsKeeper, error,
}: {
  fullName: string; setFullName: (v: string) => void;
  nickname: string; setNickname: (v: string) => void;
  birthYear: string; setBirthYear: (v: string) => void;
  shirtNumber: string; setShirtNumber: (v: string) => void;
  isKeeper: boolean; setIsKeeper: (v: boolean) => void;
  error: string;
}) {
  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Fulde navn</label>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="For- og efternavn" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Kaldenavn (valgfri)</label>
        <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Bruges i UI" className={inputCls} />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text2 mb-1.5">Fødselsår (valgfri)</label>
          <input
            type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)}
            placeholder="fx 2013" min="1990" max="2020"
            className={inputCls}
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-text2 mb-1.5">Trøjenummer</label>
          <input
            type="number" value={shirtNumber} onChange={e => setShirtNumber(e.target.value)}
            placeholder="fx 7" min="1" max="99"
            className={inputCls}
          />
        </div>
      </div>

      {/* Keeper toggle */}
      <button
        type="button"
        onClick={() => setIsKeeper(!isKeeper)}
        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors ${
          isKeeper ? 'border-green bg-green-light' : 'border-border bg-bg'
        }`}
      >
        <span className="text-sm font-medium text-text1">Keeper</span>
        <div className={`w-10 h-6 rounded-full transition-colors relative ${isKeeper ? 'bg-green' : 'bg-bg2'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isKeeper ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </button>

      {error && <p className="text-red text-sm">{error}</p>}
    </div>
  );
}

/* ─── BottomSheet ────────────────────────────────────────────────── */
function BottomSheet({ title, children, onClose, scrollable = false }: {
  title: string; children: React.ReactNode;
  onClose: () => void; scrollable?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className={`fixed bottom-14 left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl flex flex-col ${scrollable ? 'max-h-[calc(90dvh-3.5rem)]' : ''}`}>
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pt-2 pb-3 shrink-0">
          <h3 className="text-lg font-bold text-text1">{title}</h3>
          <button onClick={onClose} className="text-text3 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div
          className={`px-4 ${scrollable ? 'overflow-y-auto flex-1' : ''}`}
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function ChipButton({ children, active, onClick }: {
  children: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        active ? 'bg-green text-white border-transparent' : 'bg-bg2 text-text2 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
