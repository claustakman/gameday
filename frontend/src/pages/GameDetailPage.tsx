import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team, Player, RosterEntry } from '../lib/types';

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game,         setGame]         = useState<Game | null>(null);
  const [teams,        setTeams]        = useState<Team[]>([]);
  const [roster,       setRoster]       = useState<RosterEntry[]>([]);
  const [doubleBooked, setDoubleBooked] = useState<{ player_id: string; name: string; other_team_name: string }[]>([]);
  const [allPlayers,   setAllPlayers]   = useState<Player[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const [showResult,  setShowResult]  = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showRoster,  setShowRoster]  = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Game>(`/games/${id}`),
      api.get<Team[]>('/teams'),
      api.get<Player[]>('/players?active=1'),
    ])
      .then(([g, ts, ps]) => { setGame(g); setTeams(ts); setAllPlayers(ps); })
      .catch(() => setError('Kunne ikke hente kamp'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchRoster();
  }, [id]);

  async function fetchRoster() {
    if (!id) return;
    try {
      const data = await api.get<{ roster: RosterEntry[]; double_booked_players: typeof doubleBooked }>(`/games/${id}/roster`);
      setRoster(data.roster);
      setDoubleBooked(data.double_booked_players);
    } catch {
      // silent
    }
  }

  async function addToRoster(playerId: string) {
    if (!id) return;
    const player = allPlayers.find(p => p.id === playerId);
    const isKeeper = player?.is_default_keeper === 1 && roster.every(r => r.is_keeper === 0);
    await api.post(`/games/${id}/roster`, { player_id: playerId, is_keeper: isKeeper });
    await fetchRoster();
  }

  async function removeFromRoster(rosterId: string) {
    if (!id) return;
    await api.delete(`/games/${id}/roster/${rosterId}`);
    setRoster(rs => rs.filter(r => r.id !== rosterId));
    await fetchRoster();
  }

  async function toggleKeeper(rosterId: string, currentIsKeeper: number) {
    if (!id) return;
    const newVal = currentIsKeeper === 1 ? false : true;
    await api.patch(`/games/${id}/roster/${rosterId}`, { is_keeper: newVal });
    setRoster(rs => rs.map(r => r.id === rosterId ? { ...r, is_keeper: newVal ? 1 : 0 } : r));
  }

  async function incTally(field: 'tally_1' | 'tally_2' | 'tally_3', delta: 1 | -1) {
    if (!game || !id) return;
    await api.patch(`/games/${id}/tally`, { field, delta });
    setGame(g => g ? { ...g, [field]: Math.max(0, (g[field] ?? 0) + delta) } : g);
  }

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-text3 text-sm mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          Kampe
        </button>
        <p className="text-red text-sm">{error || 'Kamp ikke fundet'}</p>
      </div>
    );
  }

  const team   = teams.find(t => t.id === game.team_id) ?? null;
  const color  = team?.color ?? '#1D9E75';
  const d      = new Date(game.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  const isHome  = game.is_home === 1;

  const focuses = [
    { focus: game.focus_1, goal: game.goal_1, tally: game.tally_1, field: 'tally_1' as const },
    { focus: game.focus_2, goal: game.goal_2, tally: game.tally_2, field: 'tally_2' as const },
    { focus: game.focus_3, goal: game.goal_3, tally: game.tally_3, field: 'tally_3' as const },
  ].filter(f => f.focus);

  const usWon = game.result_us !== null && game.result_them !== null
    ? game.result_us > game.result_them ? 'win' : game.result_us < game.result_them ? 'loss' : 'draw'
    : null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 bg-bg border-b border-border">
        {/* Top bar */}
        <div className="flex items-center mb-4">
          <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-text3 text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            Kampe
          </button>
        </div>

        {/* Opponent + result */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-text3">{isHome ? 'Hjemme vs.' : 'Ude mod'}</span>
              {team && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
                  {team.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text1 leading-tight">{game.opponent}</h1>
          </div>

          {/* Resultat — klikbart for at åbne result-sheet */}
          <button
            onClick={() => setShowResult(true)}
            className="shrink-0 text-right rounded-xl px-3 py-2 active:opacity-70 transition-opacity"
            style={{ backgroundColor: color + '15' }}
          >
            {game.result_us !== null ? (
              <>
                <span className="text-3xl font-black text-text1 block leading-tight">
                  {game.result_us}–{game.result_them}
                </span>
                <span className={`text-[11px] font-semibold ${usWon === 'win' ? 'text-green' : usWon === 'loss' ? 'text-red' : 'text-text3'}`}>
                  {usWon === 'win' ? 'Sejr' : usWon === 'loss' ? 'Nederlg' : 'Uafgjort'}
                </span>
              </>
            ) : (
              <span className="text-xs font-semibold text-text3 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Resultat
              </span>
            )}
          </button>
        </div>

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <MetaItem icon="📅">{capitalize(dateStr)}</MetaItem>
          {game.time && <MetaItem icon="⏰">{game.time}{game.meetup_time ? ` · mødes ${game.meetup_time}` : ''}</MetaItem>}
          {game.location && <MetaItem icon="📍">{game.location}</MetaItem>}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status={game.status} />
        </div>
      </div>

      {/* Scroll-indhold */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

        {/* Fokuspunkter */}
        {focuses.length > 0 && (
          <section>
            <SectionTitle>Fokuspunkter</SectionTitle>
            <div className="flex flex-col gap-3">
              {focuses.map((f, i) => (
                <div key={i} className="bg-bg rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {i + 1}
                        </span>
                        <p className="font-semibold text-text1 text-sm">{f.focus}</p>
                      </div>
                      {f.goal && <p className="text-xs text-text2 ml-7">{f.goal}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => incTally(f.field, -1)}
                        className="w-8 h-8 rounded-full bg-bg2 flex items-center justify-center text-text2 text-lg font-bold active:bg-border"
                      >
                        −
                      </button>
                      <span className="text-lg font-bold text-text1 w-6 text-center">{f.tally}</span>
                      <button
                        onClick={() => incTally(f.field, 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold active:opacity-80"
                        style={{ backgroundColor: color }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evaluering */}
        {(game.went_well || game.went_bad) && (
          <section>
            <SectionTitle>Evaluering</SectionTitle>
            <div className="flex flex-col gap-3">
              {game.went_well && (
                <div className="bg-green-light rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-dark mb-1">✅ Det gik godt</p>
                  <p className="text-sm text-text1">{game.went_well}</p>
                </div>
              )}
              {game.went_bad && (
                <div className="bg-bg rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-red mb-1">⚠️ Kan gøres bedre</p>
                  <p className="text-sm text-text1">{game.went_bad}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Hold */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Hold {roster.filter(r => r.player_id).length > 0 && `(${roster.filter(r => r.player_id).length})`}</SectionTitle>
            <button
              onClick={() => setShowRoster(true)}
              className="flex items-center gap-1 text-xs font-semibold text-green"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tilføj spiller
            </button>
          </div>

          {doubleBooked.length > 0 && (
            <div className="mb-3 bg-bg rounded-xl border border-red/30 px-3 py-2.5 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <p className="text-xs font-semibold text-red mb-0.5">Dobbeltbooking</p>
                {doubleBooked.map(db => (
                  <p key={db.player_id} className="text-xs text-text2">{db.name} spiller også for {db.other_team_name}</p>
                ))}
              </div>
            </div>
          )}

          {roster.filter(r => r.player_id).length === 0 ? (
            <p className="text-xs text-text3 py-2">Ingen spillere tilføjet endnu</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {roster.filter(r => r.player_id).map(entry => {
                const isDoubleBooked = doubleBooked.some(db => db.player_id === entry.player_id);
                return (
                  <div
                    key={entry.id}
                    className={`bg-bg rounded-xl border flex items-center gap-3 px-3 py-2.5 ${isDoubleBooked ? 'border-red/40' : 'border-border'}`}
                  >
                    {/* Avatar — holdfarvet som i Trup */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color, color: '#fff' }}
                    >
                      <span className="text-xs font-bold">
                        {entry.shirt_number != null ? entry.shirt_number : initials(entry.player_name ?? '')}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text1 truncate">
                        {entry.nickname ?? entry.player_name}
                        {isDoubleBooked && (
                          <span className="ml-1.5 text-[10px] font-semibold text-red">⚠</span>
                        )}
                      </p>
                    </div>

                    {/* Keeper toggle */}
                    <button
                      onClick={() => toggleKeeper(entry.id, entry.is_keeper)}
                      className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                        entry.is_keeper === 1
                          ? 'border-green bg-green-light text-green-dark'
                          : 'border-border bg-bg2 text-text3'
                      }`}
                    >
                      K
                    </button>

                    {/* Fjern */}
                    <button
                      onClick={() => removeFromRoster(entry.id)}
                      className="shrink-0 w-7 h-7 rounded-full bg-bg2 flex items-center justify-center text-text3 active:bg-border"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Knapper */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="w-full rounded-xl py-3.5 font-semibold text-sm border border-border bg-bg2 text-text2 flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rediger
          </button>
          <button
            onClick={() => setShowResult(true)}
            className="w-full rounded-xl py-3.5 font-semibold text-sm border-2 transition-colors"
            style={{ borderColor: color, color, backgroundColor: color + '10' }}
          >
            {game.result_us !== null ? `Ret resultat (${game.result_us}–${game.result_them})` : 'Log resultat'}
          </button>
        </div>
      </div>

      {/* Result sheet */}
      {showResult && (
        <ResultSheet
          game={game}
          color={color}
          roster={roster}
          onClose={() => setShowResult(false)}
          onSaved={updated => { setGame(updated); setShowResult(false); }}
        />
      )}

      {/* Edit sheet */}
      {showEdit && (
        <EditSheet
          game={game}
          teams={teams}
          color={color}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setGame(updated); setShowEdit(false); }}
        />
      )}

      {/* Add to roster sheet */}
      {showRoster && (
        <AddToRosterSheet
          allPlayers={allPlayers}
          rosterPlayerIds={roster.filter(r => r.player_id).map(r => r.player_id!)}
          teams={teams}
          fallbackColor={color}
          onAdd={async (pid) => { await addToRoster(pid); }}
          onClose={() => setShowRoster(false)}
        />
      )}
    </div>
  );
}

/* ─── Result sheet ────────────────────────────────────────────────── */
function ResultSheet({ game, color, roster, onClose, onSaved }: {
  game: Game;
  color: string;
  roster: RosterEntry[];
  onClose: () => void;
  onSaved: (g: Game) => void;
}) {
  const [resultUs,    setResultUs]    = useState(game.result_us   !== null ? String(game.result_us)   : '');
  const [resultThem,  setResultThem]  = useState(game.result_them !== null ? String(game.result_them) : '');
  const [wentWell,    setWentWell]    = useState(game.went_well ?? '');
  const [wentBad,     setWentBad]     = useState(game.went_bad  ?? '');
  const [motmId,      setMotmId]      = useState<string | null>(game.motm_player_id ?? null);
  const [saving,      setSaving]      = useState(false);

  const rosterPlayers = roster.filter(r => r.player_id);

  async function save() {
    const us   = parseInt(resultUs);
    const them = parseInt(resultThem);
    if (isNaN(us) || isNaN(them)) return;
    setSaving(true);
    try {
      await api.post(`/games/${game.id}/finish`, {
        result_us:       us,
        result_them:     them,
        went_well:       wentWell.trim() || null,
        went_bad:        wentBad.trim()  || null,
        motm_player_id:  motmId || null,
      });
      onSaved({ ...game, status: 'done', result_us: us, result_them: them,
        went_well: wentWell.trim() || null, went_bad: wentBad.trim() || null,
        motm_player_id: motmId || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet title="Resultat" onClose={onClose} scrollable>
      {/* Score — side-by-side, fixed width */}
      <div className="flex items-end gap-3 mb-5">
        <div className="w-0 flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-text3 uppercase tracking-wide text-center">Hjemme</span>
          <input
            type="number" inputMode="numeric" min="0" placeholder="0"
            value={resultUs} onChange={e => setResultUs(e.target.value)}
            className="w-full border border-border rounded-xl px-2 py-3 text-2xl font-bold text-center text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
          />
        </div>
        <span className="text-xl font-bold text-text3 shrink-0 pb-3">–</span>
        <div className="w-0 flex-1 flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-text3 uppercase tracking-wide text-center">Ude</span>
          <input
            type="number" inputMode="numeric" min="0" placeholder="0"
            value={resultThem} onChange={e => setResultThem(e.target.value)}
            className="w-full border border-border rounded-xl px-2 py-3 text-2xl font-bold text-center text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
          />
        </div>
      </div>

      {/* MOTM — kompakt chip-grid */}
      {rosterPlayers.length > 0 && (
        <>
          <p className="text-xs font-medium text-text2 mb-2">Dagens spiller — MOTM (valgfri)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Ingen */}
            <button
              onClick={() => setMotmId(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                motmId === null ? 'bg-bg2 border-border text-text1' : 'border-transparent text-text3'
              }`}
            >
              <span>Ingen</span>
            </button>
            {rosterPlayers.map(entry => {
              const selected = motmId === entry.player_id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setMotmId(selected ? null : entry.player_id!)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors`}
                  style={selected
                    ? { backgroundColor: color + '20', borderColor: color, color }
                    : { borderColor: 'transparent', color: 'var(--color-text2)' }
                  }
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: selected ? color : color + '40', color: '#fff' }}
                  >
                    <span className="text-[9px] font-bold leading-none">
                      {entry.shirt_number != null ? entry.shirt_number : initials(entry.player_name ?? '')}
                    </span>
                  </div>
                  <span>{entry.nickname ?? entry.player_name}</span>
                  {selected && <span className="text-xs">⭐</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs font-medium text-text2 mb-1.5">Det gik godt (valgfri)</p>
      <textarea
        placeholder="Hvad fungerede?"
        value={wentWell} onChange={e => setWentWell(e.target.value)}
        rows={2}
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg resize-none mb-3"
      />

      <p className="text-xs font-medium text-text2 mb-1.5">Kan gøres bedre (valgfri)</p>
      <textarea
        placeholder="Hvad skal vi arbejde på?"
        value={wentBad} onChange={e => setWentBad(e.target.value)}
        rows={2}
        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg resize-none mb-4"
      />

      <button
        onClick={save}
        disabled={saving || resultUs === '' || resultThem === ''}
        className="w-full rounded-xl py-3.5 font-semibold text-sm text-white disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {saving ? 'Gemmer…' : 'Gem resultat'}
      </button>
    </BottomSheet>
  );
}

/* ─── Edit sheet ──────────────────────────────────────────────────── */
const EMPTY_FOCUS = { focus: '', goal: '' };

function EditSheet({ game, teams, color, onClose, onSaved }: {
  game: Game;
  teams: Team[];
  color: string;
  onClose: () => void;
  onSaved: (g: Game) => void;
}) {
  const [date,       setDate]       = useState(game.date);
  const [time,       setTime]       = useState(game.time ?? '');
  const [meetupTime, setMeetupTime] = useState(game.meetup_time ?? '');
  const [opponent,   setOpponent]   = useState(game.opponent);
  const [location,   setLocation]   = useState(game.location ?? '');
  const [isHome,     setIsHome]     = useState(game.is_home === 1);
  const [teamId,     setTeamId]     = useState(game.team_id);
  const [focuses, setFocuses] = useState<{ focus: string; goal: string }[]>(() => {
    const raw = [
      { focus: game.focus_1 ?? '', goal: game.goal_1 ?? '' },
      { focus: game.focus_2 ?? '', goal: game.goal_2 ?? '' },
      { focus: game.focus_3 ?? '', goal: game.goal_3 ?? '' },
    ].filter(f => f.focus);
    return raw.length > 0 ? raw : [{ ...EMPTY_FOCUS }];
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function setFocusField(i: number, field: 'focus' | 'goal', value: string) {
    setFocuses(fs => fs.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  }

  async function save() {
    if (!opponent.trim() || !date) { setError('Udfyld modstander og dato'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch(`/games/${game.id}`, {
        team_id: teamId,
        date,
        time: time || null,
        meetup_time: meetupTime || null,
        opponent: opponent.trim(),
        location: location.trim() || null,
        is_home: isHome ? 1 : 0,
      });

      const filled = focuses.filter(f => f.focus.trim());
      await api.post(`/games/${game.id}/focus`, {
        focus_1: filled[0]?.focus.trim() ?? null,
        goal_1:  filled[0]?.goal.trim()  ?? null,
        focus_2: filled[1]?.focus.trim() ?? null,
        goal_2:  filled[1]?.goal.trim()  ?? null,
        focus_3: filled[2]?.focus.trim() ?? null,
        goal_3:  filled[2]?.goal.trim()  ?? null,
      });

      onSaved({
        ...game, team_id: teamId, date, time: time || null,
        meetup_time: meetupTime || null, opponent: opponent.trim(),
        location: location.trim() || null, is_home: isHome ? 1 : 0,
        focus_1: filled[0]?.focus.trim() ?? null, goal_1: filled[0]?.goal.trim() ?? null,
        focus_2: filled[1]?.focus.trim() ?? null, goal_2: filled[1]?.goal.trim() ?? null,
        focus_3: filled[2]?.focus.trim() ?? null, goal_3: filled[2]?.goal.trim() ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  return (
    <BottomSheet title="Rediger kamp" onClose={onClose} scrollable>
      <div className="flex flex-col gap-4">
        {/* Hold */}
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Hold</label>
          <div className="flex gap-2 flex-wrap">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors"
                style={{
                  borderColor: teamId === t.id ? t.color : 'transparent',
                  backgroundColor: teamId === t.id ? t.color + '22' : '#f5f5f5',
                  color: teamId === t.id ? t.color : '#666',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Modstander */}
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Modstander</label>
          <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} className={inputCls} />
        </div>

        {/* Hjemme/ude */}
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Hvor</label>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button onClick={() => setIsHome(true)}  className={`flex-1 py-2 text-sm font-medium transition-colors ${isHome  ? 'bg-green text-white' : 'bg-bg text-text2'}`}>Hjemme</button>
            <button onClick={() => setIsHome(false)} className={`flex-1 py-2 text-sm font-medium transition-colors ${!isHome ? 'bg-green text-white' : 'bg-bg text-text2'}`}>Ude</button>
          </div>
        </div>

        {/* Dato */}
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Dato</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>

        {/* Tider */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-text2 mb-1.5">Kampstart</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-text2 mb-1.5">Mødetid</label>
            <input type="time" value={meetupTime} onChange={e => setMeetupTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Lokation */}
        <div>
          <label className="block text-xs font-medium text-text2 mb-1.5">Lokation (valgfri)</label>
          <input type="text" placeholder="Bane, adresse…" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
        </div>

        {/* Fokuspunkter */}
        <div>
          <p className="text-xs font-medium text-text2 mb-2">Fokuspunkter (valgfri)</p>
          <div className="flex flex-col gap-3">
            {focuses.map((f, i) => (
              <div key={i} className="bg-bg2 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text2">#{i + 1}</span>
                  {focuses.length > 1 && (
                    <button onClick={() => setFocuses(fs => fs.filter((_, idx) => idx !== i))} className="text-text3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
                <input type="text" placeholder="Fokuspunkt" value={f.focus} onChange={e => setFocusField(i, 'focus', e.target.value)} className={inputCls} />
                <input type="text" placeholder="Mål (valgfri)" value={f.goal}  onChange={e => setFocusField(i, 'goal',  e.target.value)} className={inputCls} />
              </div>
            ))}
            {focuses.length < 3 && (
              <button
                onClick={() => setFocuses(fs => [...fs, { ...EMPTY_FOCUS }])}
                className="flex items-center justify-center gap-1.5 border border-dashed border-border rounded-xl py-2.5 text-sm text-text3"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tilføj fokuspunkt
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red text-sm">{error}</p>}
      </div>

      <div className="pt-4 border-t border-border mt-2">
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl py-3.5 font-semibold text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: color }}
        >
          {saving ? 'Gemmer…' : 'Gem ændringer'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── Shared bottom sheet ─────────────────────────────────────────── */
function BottomSheet({ title, children, onClose, scrollable = false }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  scrollable?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div
        className={`fixed left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl flex flex-col ${scrollable ? 'max-h-[calc(90dvh-3.5rem-env(safe-area-inset-bottom))]' : ''}`}
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <div className={`flex items-center justify-between px-4 pt-2 pb-3 shrink-0`}>
          <h3 className="text-lg font-bold text-text1">{title}</h3>
          <button onClick={onClose} className="text-text3 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={`px-4 pb-4 ${scrollable ? 'overflow-y-auto flex-1' : ''}`} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ─── Add to roster sheet ─────────────────────────────────────────── */
function AddToRosterSheet({ allPlayers, rosterPlayerIds, teams, fallbackColor, onAdd, onClose }: {
  allPlayers: Player[];
  rosterPlayerIds: string[];
  teams: Team[];
  fallbackColor: string;
  onAdd: (playerId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search,  setSearch]  = useState('');
  const [adding,  setAdding]  = useState<string | null>(null);

  const teamColorMap = useMemo(() =>
    Object.fromEntries(teams.map(t => [t.id, t.color])),
    [teams]
  );

  const available = useMemo(() =>
    allPlayers
      .filter(p => !rosterPlayerIds.includes(p.id))
      .filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (p.full_name.toLowerCase().includes(q)) ||
               (p.nickname?.toLowerCase().includes(q)) ||
               (p.shirt_number != null && String(p.shirt_number).includes(q));
      })
      .sort((a, b) => {
        if (a.shirt_number != null && b.shirt_number != null) return a.shirt_number - b.shirt_number;
        if (a.shirt_number != null) return -1;
        if (b.shirt_number != null) return 1;
        return a.full_name.localeCompare(b.full_name);
      }),
    [allPlayers, rosterPlayerIds, search]
  );

  async function add(pid: string) {
    setAdding(pid);
    try { await onAdd(pid); } finally { setAdding(null); }
  }

  return (
    /* Full-screen overlay — covers tab bar too (z-[60]) */
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <h3 className="text-lg font-bold text-text1">Tilføj spiller</h3>
        <button onClick={onClose} className="text-text3 p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Søg — sticky under header */}
      <div className="px-4 py-2.5 border-b border-border shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Søg navn eller nummer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg2 rounded-lg pl-9 pr-3 py-2 text-sm text-text1 placeholder-text3 focus:outline-none focus:ring-2 focus:ring-green"
            autoFocus
          />
        </div>
      </div>

      {/* Liste — scrollbar */}
      <div className="flex-1 overflow-y-auto px-4 py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {available.length === 0 ? (
          <p className="text-center text-text3 text-sm py-10">
            {search ? 'Ingen spillere matcher søgningen' : 'Alle aktive spillere er allerede tilføjet'}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {available.map(p => {
              const avatarColor = (p.primary_team_id && teamColorMap[p.primary_team_id]) ?? fallbackColor;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  disabled={adding === p.id}
                  className="flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-xl active:bg-bg2 transition-colors disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: avatarColor, color: '#fff' }}>
                    <span className="text-xs font-bold">
                      {p.shirt_number != null ? p.shirt_number : initials(p.full_name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text1 truncate">{p.nickname ?? p.full_name}</p>
                    {p.nickname && <p className="text-xs text-text3 truncate">{p.full_name}</p>}
                  </div>
                  {p.birth_year && <span className="text-xs text-text3 shrink-0">{p.birth_year}</span>}
                  {adding === p.id
                    ? <div className="w-5 h-5 border-2 border-green border-t-transparent rounded-full animate-spin shrink-0" />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green shrink-0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  }
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function MetaItem({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs text-text2">
      <span>{icon}</span><span>{children}</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">{children}</p>;
}

function StatusBadge({ status }: { status: Game['status'] }) {
  const cfg = {
    planned:  { cls: 'bg-bg2 text-text2',             label: 'Planlagt' },
    done:     { cls: 'bg-green-light text-green-dark', label: 'Spillet' },
    archived: { cls: 'bg-bg2 text-text3',             label: 'Arkiveret' },
  };
  const { cls, label } = cfg[status];
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
