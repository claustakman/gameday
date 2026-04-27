import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Player, Team } from '../lib/types';

export default function SquadPage() {
  const [players,  setPlayers]  = useState<Player[]>([]);
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [showInactive, setShowInactive] = useState(false);
  const [teamFilter,   setTeamFilter]   = useState('');
  const [showAdd,      setShowAdd]      = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Player[]>('/players').catch(() => [] as Player[]),
      api.get<Team[]>('/teams').catch(()   => [] as Team[]),
    ]).then(([p, t]) => {
      setPlayers(p);
      setTeams(t);
    }).finally(() => setLoading(false));
  }, []);

  const currentSeason = (() => {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  })();

  // Sæsonhold til filter-chips
  const seasonTeams = teams.filter(t => t.season === currentSeason);

  const visible = players.filter(p => {
    if (!showInactive && p.active === 0) return false;
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny spiller
          </button>
        </div>

        {/* Hold-chips */}
        {seasonTeams.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <ChipButton active={teamFilter === ''} onClick={() => setTeamFilter('')}>Alle</ChipButton>
            {seasonTeams.map(t => (
              <ChipButton
                key={t.id}
                active={teamFilter === t.id}
                color={t.color}
                onClick={() => setTeamFilter(teamFilter === t.id ? '' : t.id)}
              >
                {t.name}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-1">
        {active.length === 0 && (
          <p className="text-center text-text3 text-sm pt-12">Ingen spillere endnu — tilføj den første</p>
        )}

        {active.map(p => (
          <PlayerRow key={p.id} player={p} teams={teams} season={currentSeason} onUpdated={onUpdated} />
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
          <PlayerRow key={p.id} player={p} teams={teams} season={currentSeason} onUpdated={onUpdated} />
        ))}
      </div>

      {/* Add sheet */}
      {showAdd && (
        <AddPlayerSheet
          teams={teams}
          season={currentSeason}
          onClose={() => setShowAdd(false)}
          onAdded={onAdded}
        />
      )}
    </div>
  );
}

/* ─── PlayerRow ──────────────────────────────────────────────────── */
function PlayerRow({ player, teams, season, onUpdated }: {
  player: Player;
  teams: Team[];
  season: string;
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
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-bg2 flex items-center justify-center shrink-0 text-sm font-bold text-text2">
          {initials(player.full_name)}
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
          teams={teams}
          season={season}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { onUpdated(updated); setShowEdit(false); }}
        />
      )}
    </>
  );
}

/* ─── AddPlayerSheet ─────────────────────────────────────────────── */
function AddPlayerSheet({ teams, season, onClose, onAdded }: {
  teams: Team[];
  season: string;
  onClose: () => void;
  onAdded: (p: Player) => void;
}) {
  const [fullName,   setFullName]   = useState('');
  const [nickname,   setNickname]   = useState('');
  const [birthYear,  setBirthYear]  = useState('');
  const [isKeeper,   setIsKeeper]   = useState(false);
  const [teamIds,    setTeamIds]    = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const seasonTeams = teams.filter(t => t.season === season);

  function toggleTeam(id: string) {
    setTeamIds(ts => ts.includes(id) ? ts.filter(x => x !== id) : [...ts, id]);
  }

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      const { id } = await api.post<{ id: string }>('/players', {
        full_name: fullName.trim(),
        nickname:  nickname.trim() || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
        is_default_keeper: isKeeper,
      });

      // Tilknyt hold
      for (const teamId of teamIds) {
        await api.post(`/players/${id}/teams`, { team_id: teamId, season }).catch(() => {});
      }

      onAdded({
        id, org_id: '', full_name: fullName.trim(),
        nickname: nickname.trim() || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
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
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        teamIds={teamIds} toggleTeam={toggleTeam}
        seasonTeams={seasonTeams}
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
function EditPlayerSheet({ player, teams, season, onClose, onSaved }: {
  player: Player;
  teams: Team[];
  season: string;
  onClose: () => void;
  onSaved: (p: Player) => void;
}) {
  const [fullName,  setFullName]  = useState(player.full_name);
  const [nickname,  setNickname]  = useState(player.nickname ?? '');
  const [birthYear, setBirthYear] = useState(player.birth_year ? String(player.birth_year) : '');
  const [isKeeper,  setIsKeeper]  = useState(player.is_default_keeper === 1);
  const [teamIds,   setTeamIds]   = useState<string[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const seasonTeams = teams.filter(t => t.season === season);

  // Hent eksisterende holdtilknytninger
  useEffect(() => {
    api.get<{ team_id: string }[]>(`/players/${player.id}/teams`)
      .then(rows => setTeamIds(rows.map(r => r.team_id)))
      .catch(() => {});
  }, [player.id]);

  function toggleTeam(id: string) {
    setTeamIds(ts => ts.includes(id) ? ts.filter(x => x !== id) : [...ts, id]);
  }

  async function save() {
    if (!fullName.trim()) { setError('Navn er påkrævet'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch(`/players/${player.id}`, {
        full_name: fullName.trim(),
        nickname:  nickname.trim() || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
        is_default_keeper: isKeeper ? 1 : 0,
      });

      // Synk holdtilknytninger
      await api.post(`/players/${player.id}/teams/sync`, { team_ids: teamIds, season }).catch(() => {});

      onSaved({
        ...player,
        full_name: fullName.trim(),
        nickname:  nickname.trim() || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
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
        isKeeper={isKeeper} setIsKeeper={setIsKeeper}
        teamIds={teamIds} toggleTeam={toggleTeam}
        seasonTeams={seasonTeams}
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
  birthYear, setBirthYear, isKeeper, setIsKeeper,
  teamIds, toggleTeam, seasonTeams, error,
}: {
  fullName: string; setFullName: (v: string) => void;
  nickname: string; setNickname: (v: string) => void;
  birthYear: string; setBirthYear: (v: string) => void;
  isKeeper: boolean; setIsKeeper: (v: boolean) => void;
  teamIds: string[]; toggleTeam: (id: string) => void;
  seasonTeams: Team[];
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
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Fødselsår (valgfri)</label>
        <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)}
          placeholder="fx 2013" min="1990" max="2020" className={inputCls} />
      </div>

      {/* Keeper toggle */}
      <button
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

      {/* Holdtilknytning */}
      {seasonTeams.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Hold ({new Date().getFullYear()}/{String(new Date().getFullYear() + 1).slice(2)})</label>
          <div className="flex gap-2 flex-wrap">
            {seasonTeams.map(t => (
              <button
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors"
                style={{
                  borderColor: teamIds.includes(t.id) ? t.color : 'transparent',
                  backgroundColor: teamIds.includes(t.id) ? t.color + '22' : '#f5f5f5',
                  color: teamIds.includes(t.id) ? t.color : '#666',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
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
function ChipButton({ children, active, color, onClick }: {
  children: React.ReactNode; active: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        active ? (color ? 'border-transparent' : 'bg-green text-white border-transparent') : 'bg-bg2 text-text2 border-transparent'
      }`}
      style={active && color ? { backgroundColor: color + '22', borderColor: color, color } : {}}
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
