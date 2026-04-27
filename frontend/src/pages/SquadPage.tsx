import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Player, Team } from '../lib/types';

type SortKey = 'number' | 'name' | 'birth_year';

export default function SquadPage() {
  const [players,  setPlayers]  = useState<Player[]>([]);
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [showInactive, setShowInactive] = useState(false);
  const [yearFilter,   setYearFilter]   = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('number');
  const [showAdd,      setShowAdd]      = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Player[]>('/players').catch(() => [] as Player[]),
      api.get<Team[]>('/teams').catch(() => [] as Team[]),
    ]).then(([p, t]) => {
      setPlayers(p);
      setTeams(t);
    }).finally(() => setLoading(false));
  }, []);

  // Unikke årgange fra aktive spillere (obligatorisk felt)
  const years = Array.from(
    new Set(players.filter(p => p.birth_year).map(p => p.birth_year) as number[])
  ).sort();

  // Teammap til farve-opslag
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  function byNumber(a: Player, b: Player): number {
    if (a.shirt_number == null && b.shirt_number == null) return a.full_name.localeCompare(b.full_name);
    if (a.shirt_number == null) return 1;
    if (b.shirt_number == null) return -1;
    return a.shirt_number - b.shirt_number;
  }

  function sorted(list: Player[]): Player[] {
    return [...list].sort((a, b) => {
      if (sortKey === 'number') {
        return byNumber(a, b);
      }
      if (sortKey === 'name') {
        const an = a.nickname ?? a.full_name;
        const bn = b.nickname ?? b.full_name;
        return an.localeCompare(bn);
      }
      if (sortKey === 'birth_year') {
        if (a.birth_year == null && b.birth_year == null) return byNumber(a, b);
        if (a.birth_year == null) return 1;
        if (b.birth_year == null) return -1;
        const diff = a.birth_year - b.birth_year;
        // Sekundær sortering på nummer når årgange er ens (også ved årgangfilter)
        return diff !== 0 ? diff : byNumber(a, b);
      }
      return 0;
    });
  }

  const filtered = players.filter(p => {
    if (!showInactive && p.active === 0) return false;
    if (yearFilter && String(p.birth_year) !== yearFilter) return false;
    return true;
  });

  const active   = sorted(filtered.filter(p => p.active === 1));
  const inactive = sorted(filtered.filter(p => p.active === 0));

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

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'number',     label: 'Nummer' },
    { key: 'name',       label: 'Navn' },
    { key: 'birth_year', label: 'Årgang' },
  ];

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

        {/* Årgangfilter — samme stil som Kampe */}
        {years.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
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

        {/* Sortering + aktiv-filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {sortOptions.map(opt => (
            <ChipButton
              key={opt.key}
              active={sortKey === opt.key}
              onClick={() => setSortKey(opt.key)}
            >
              {opt.label}
            </ChipButton>
          ))}
          <span className="w-px bg-border shrink-0 mx-1" />
          <ChipButton active={showInactive} onClick={() => setShowInactive(s => !s)}>
            Inaktive {showInactive && players.filter(p => p.active === 0).length > 0 && `(${players.filter(p => p.active === 0).length})`}
          </ChipButton>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-1">
        {active.length === 0 && inactive.length === 0 && (
          <p className="text-center text-text3 text-sm pt-12">
            {yearFilter ? `Ingen spillere fra ${yearFilter}` : 'Ingen spillere endnu — tilføj den første'}
          </p>
        )}
        {active.length === 0 && inactive.length > 0 && !showInactive && (
          <p className="text-center text-text3 text-sm pt-12">
            Ingen aktive spillere{yearFilter ? ` fra ${yearFilter}` : ''} — tryk <span className="font-semibold">Inaktive</span> for at se dem
          </p>
        )}

        {active.map(p => (
          <PlayerRow key={p.id} player={p} teamMap={teamMap} teams={teams} onUpdated={onUpdated} />
        ))}

        {showInactive && inactive.map(p => (
          <PlayerRow key={p.id} player={p} teamMap={teamMap} teams={teams} onUpdated={onUpdated} />
        ))}
      </div>

      {showAdd && (
        <AddPlayerSheet
          teams={teams}
          onClose={() => setShowAdd(false)}
          onAdded={onAdded}
        />
      )}
    </div>
  );
}

/* ─── PlayerRow ──────────────────────────────────────────────────── */
function PlayerRow({ player, teamMap, teams, onUpdated }: {
  player: Player;
  teamMap: Record<string, Team>;
  teams: Team[];
  onUpdated: (p: Player) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  const primaryTeam = player.primary_team_id ? teamMap[player.primary_team_id] : null;
  const avatarColor = primaryTeam?.color ?? null;

  const displayName = player.nickname
    ? `${player.nickname} (${player.full_name})`
    : player.full_name;

  return (
    <>
      <button
        onClick={() => setShowEdit(true)}
        className={`w-full text-left bg-bg rounded-xl border border-border px-4 py-3 flex items-center gap-3 active:bg-bg2 transition-colors ${player.active === 0 ? 'opacity-50' : ''}`}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={avatarColor
            ? { backgroundColor: avatarColor, color: '#fff' }
            : { backgroundColor: 'var(--color-bg2)', color: 'var(--color-text2)' }
          }
        >
          <span className="text-sm font-bold">
            {player.shirt_number != null ? player.shirt_number : initials(player.full_name)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text1 text-sm truncate">{displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {player.birth_year && (
              <span className="text-xs text-text3">{player.birth_year}</span>
            )}
            {primaryTeam && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: primaryTeam.color + '22', color: primaryTeam.color }}
              >
                {primaryTeam.name}
              </span>
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
          teams={teams}
          teamMap={teamMap}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { onUpdated(updated); setShowEdit(false); }}
        />
      )}
    </>
  );
}

/* ─── AddPlayerSheet ─────────────────────────────────────────────── */
function AddPlayerSheet({ teams, onClose, onAdded }: {
  teams: Team[];
  onClose: () => void;
  onAdded: (p: Player) => void;
}) {
  const [fullName,       setFullName]       = useState('');
  const [nickname,       setNickname]       = useState('');
  const [birthYear,      setBirthYear]      = useState('');
  const [shirtNumber,    setShirtNumber]    = useState('');
  const [primaryTeamId,  setPrimaryTeamId]  = useState('');
  const [isKeeper,       setIsKeeper]       = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    if (!birthYear)       { setError('Årgang er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      const { id } = await api.post<{ id: string }>('/players', {
        full_name:        fullName.trim(),
        nickname:         nickname.trim() || null,
        birth_year:       parseInt(birthYear),
        shirt_number:     shirtNumber ? parseInt(shirtNumber) : null,
        primary_team_id:  primaryTeamId || null,
        is_default_keeper: isKeeper,
      });

      onAdded({
        id, org_id: '',
        full_name:        fullName.trim(),
        nickname:         nickname.trim() || null,
        birth_year:       parseInt(birthYear),
        shirt_number:     shirtNumber ? parseInt(shirtNumber) : null,
        primary_team_id:  primaryTeamId || null,
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
        primaryTeamId={primaryTeamId} setPrimaryTeamId={setPrimaryTeamId}
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        teams={teams}
        error={error}
      />
      <div className="pt-4 border-t border-border mt-2">
        <button onClick={save} disabled={saving || !fullName.trim() || !birthYear}
          className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
          {saving ? 'Gemmer…' : 'Opret spiller'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── EditPlayerSheet ────────────────────────────────────────────── */
function EditPlayerSheet({ player, teams, onClose, onSaved }: {
  player: Player;
  teams: Team[];
  teamMap: Record<string, Team>;
  onClose: () => void;
  onSaved: (p: Player) => void;
}) {

  const [fullName,      setFullName]      = useState(player.full_name);
  const [nickname,      setNickname]      = useState(player.nickname ?? '');
  const [birthYear,     setBirthYear]     = useState(player.birth_year ? String(player.birth_year) : '');
  const [shirtNumber,   setShirtNumber]   = useState(player.shirt_number != null ? String(player.shirt_number) : '');
  const [primaryTeamId, setPrimaryTeamId] = useState(player.primary_team_id ?? '');
  const [isKeeper,      setIsKeeper]      = useState(player.is_default_keeper === 1);
  const [hsUserId,      setHsUserId]      = useState(player.hs_user_id ?? '');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    if (!birthYear)       { setError('Årgang er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch(`/players/${player.id}`, {
        full_name:        fullName.trim(),
        nickname:         nickname.trim() || null,
        birth_year:       parseInt(birthYear),
        shirt_number:     shirtNumber ? parseInt(shirtNumber) : null,
        primary_team_id:  primaryTeamId || null,
        is_default_keeper: isKeeper ? 1 : 0,
        hs_user_id:       hsUserId.trim() || null,
      });

      onSaved({
        ...player,
        full_name:        fullName.trim(),
        nickname:         nickname.trim() || null,
        birth_year:       parseInt(birthYear),
        shirt_number:     shirtNumber ? parseInt(shirtNumber) : null,
        primary_team_id:  primaryTeamId || null,
        is_default_keeper: isKeeper ? 1 : 0,
        hs_user_id:       hsUserId.trim() || null,
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
        primaryTeamId={primaryTeamId} setPrimaryTeamId={setPrimaryTeamId}
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        hsUserId={hsUserId} setHsUserId={setHsUserId}
        teams={teams}
        error={error}
      />
      <div className="pt-4 border-t border-border mt-2 flex flex-col gap-2">
        <button onClick={save} disabled={saving}
          className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
          {saving ? 'Gemmer…' : 'Gem ændringer'}
        </button>
        <button onClick={toggleActive}
          className={`w-full border rounded-xl py-3 font-semibold text-sm ${
            player.active === 1 ? 'border-border text-text2' : 'border-green text-green'
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
  primaryTeamId, setPrimaryTeamId,
  isKeeper, setIsKeeper,
  hsUserId, setHsUserId,
  teams, error,
}: {
  fullName: string; setFullName: (v: string) => void;
  nickname: string; setNickname: (v: string) => void;
  birthYear: string; setBirthYear: (v: string) => void;
  shirtNumber: string; setShirtNumber: (v: string) => void;
  primaryTeamId: string; setPrimaryTeamId: (v: string) => void;
  isKeeper: boolean; setIsKeeper: (v: boolean) => void;
  hsUserId?: string; setHsUserId?: (v: string) => void;
  teams: Team[];
  error: string;
}) {
  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  // Vis kun hold fra aktuel sæson
  const y = new Date().getFullYear();
  const currentSeason = `${y}/${String(y + 1).slice(2)}`;
  const seasonTeams = teams.filter(t => t.season === currentSeason);

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
          <label className="block text-xs font-medium text-text2 mb-1.5">Fødselsår <span className="text-red">*</span></label>
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

      {/* Primært hold */}
      {seasonTeams.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Primært hold (valgfri)</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPrimaryTeamId('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                primaryTeamId === '' ? 'border-border bg-bg2 text-text2' : 'border-transparent bg-bg2 text-text3'
              }`}
            >
              Ingen
            </button>
            {seasonTeams.map(t => (
              <button
                type="button"
                key={t.id}
                onClick={() => setPrimaryTeamId(primaryTeamId === t.id ? '' : t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors"
                style={{
                  borderColor:     primaryTeamId === t.id ? t.color : 'transparent',
                  backgroundColor: primaryTeamId === t.id ? t.color + '22' : '#f5f5f5',
                  color:           primaryTeamId === t.id ? t.color : '#666',
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Holdsport mapping — vises kun ved redigering */}
      {setHsUserId !== undefined && (
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">
            Holdsport bruger-ID
            <span className="ml-1.5 font-normal text-text3">(til integration)</span>
          </label>
          <input
            value={hsUserId ?? ''}
            onChange={e => setHsUserId(e.target.value)}
            placeholder="fx 123456"
            className={inputCls}
          />
        </div>
      )}

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
