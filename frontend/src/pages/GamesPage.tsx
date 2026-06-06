import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';
import NewGameSheet from '../components/NewGameSheet';
import HsImportGamesModal from '../components/HsImportGamesModal';

export default function GamesPage() {
  const navigate = useNavigate();
  const [games,   setGames]   = useState<Game[]>([]);
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [teamId,          setTeamId]          = useState('');
  const [season,          setSeason]          = useState('');
  const [status,          setStatus]          = useState('planned');
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [updating,        setUpdating]        = useState(false);
  const [updateMsg,       setUpdateMsg]       = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false);

  // Multi-select
  const [selecting,  setSelecting]  = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkMsg,    setBulkMsg]    = useState('');

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  function fetchGames(overrides?: { teamId?: string; season?: string; status?: string; search?: string }) {
    setLoading(true);
    const t  = overrides?.teamId  ?? teamId;
    const se = overrides?.season  ?? season;
    const st = overrides?.status  ?? status;
    const sr = overrides?.search  ?? debouncedSearch;
    const params = new URLSearchParams();
    if (t)  params.set('team_id',  t);
    if (se) params.set('season',   se);
    if (st) params.set('status',   st);
    if (sr) params.set('opponent', sr);
    api.get<Game[]>(`/games?${params}`)
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchGames(); }, [teamId, season, status, debouncedSearch]);

  async function bulkUpdate() {
    setUpdating(true); setUpdateMsg('');
    try {
      const res = await api.post<{ updated: number; total: number }>('/holdsport/bulk-update-games', {});
      setUpdateMsg(`${res.updated}/${res.total} kampe opdateret`);
      fetchGames();
      setTimeout(() => setUpdateMsg(''), 4000);
    } catch (e) {
      setUpdateMsg(e instanceof Error ? e.message : 'Fejl');
      setTimeout(() => setUpdateMsg(''), 4000);
    } finally { setUpdating(false); }
  }

  function exitSelect() { setSelecting(false); setSelected(new Set()); }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === games.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(games.map(g => g.id)));
    }
  }

  async function bulkArchive() {
    setBulkWorking(true); setBulkMsg('');
    try {
      await Promise.all([...selected].map(id => api.patch(`/games/${id}`, { status: 'archived' })));
      setBulkMsg(`${selected.size} kampe arkiveret`);
      fetchGames();
      exitSelect();
      setTimeout(() => setBulkMsg(''), 3000);
    } catch { setBulkMsg('Fejl'); setTimeout(() => setBulkMsg(''), 3000); }
    finally { setBulkWorking(false); }
  }

  async function bulkHsSync() {
    setBulkWorking(true); setBulkMsg('');
    const ids = [...selected].filter(id => games.find(g => g.id === id)?.hs_activity_id);
    if (ids.length === 0) { setBulkMsg('Ingen valgte kampe har Holdsport-tilknytning'); setBulkWorking(false); setTimeout(() => setBulkMsg(''), 3000); return; }
    try {
      let added = 0, removed = 0;
      for (const id of ids) {
        const res = await api.post<{ added: number; removed: number }>('/holdsport/sync-game-players', { game_id: id });
        added += res.added; removed += res.removed;
      }
      setBulkMsg(`Synket ${ids.length} kampe (+${added}/-${removed})`);
      fetchGames();
      exitSelect();
      setTimeout(() => setBulkMsg(''), 3000);
    } catch { setBulkMsg('Fejl'); setTimeout(() => setBulkMsg(''), 3000); }
    finally { setBulkWorking(false); }
  }

  async function bulkDelete() {
    if (!confirm(`Slet ${selected.size} kampe? Dette kan ikke fortrydes.`)) return;
    setBulkWorking(true); setBulkMsg('');
    try {
      await Promise.all([...selected].map(id => api.delete(`/games/${id}`)));
      setGames(gs => gs.filter(g => !selected.has(g.id)));
      exitSelect();
    } catch { setBulkMsg('Fejl'); setTimeout(() => setBulkMsg(''), 3000); }
    finally { setBulkWorking(false); }
  }

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const seasons = [...new Set(games.map(g => g.season))].sort().reverse();
  const currentSeason = (() => { const y = new Date().getFullYear(); return `${y}/${String(y+1).slice(2)}`; })();
  const importTeams = teams.filter(t => t.season === currentSeason);

  const statusOptions = [
    { value: '',         label: 'Alle' },
    { value: 'planned',  label: 'Planlagt' },
    { value: 'done',     label: 'Spillet' },
    { value: 'archived', label: 'Arkiveret' },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-bg px-4 pt-6 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          {selecting ? (
            <>
              <button onClick={toggleAll} className="text-sm font-semibold text-text2">
                {selected.size === games.length ? 'Fravælg alle' : 'Vælg alle'}
              </button>
              <button onClick={exitSelect} className="text-sm font-semibold text-text2 px-3 py-1.5 rounded-lg bg-bg2">
                Annuller
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-text1">Kampe</h2>
              <div className="flex items-center gap-2">
                {/* Opdater — ikon-only */}
                <button onClick={bulkUpdate} disabled={updating} title="Opdater tid, sted og tilmeldte fra Holdsport"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-bg2 text-text2 disabled:opacity-40">
                  {updating
                    ? <div className="w-4 h-4 border-2 border-text3 border-t-transparent rounded-full animate-spin" />
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  }
                </button>
                {/* Vælg */}
                <button onClick={() => setSelecting(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-bg2 text-text2">
                  Vælg
                </button>
              </div>
            </>
          )}
        </div>

        {(updateMsg || bulkMsg) && (
          <p className="text-xs text-green-dark mb-2">{updateMsg || bulkMsg}</p>
        )}

        {/* Søgefelt */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" placeholder="Søg modstander…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg2 rounded-lg pl-9 pr-3 py-2 text-sm text-text1 placeholder-text3 focus:outline-none focus:ring-2 focus:ring-green" />
        </div>

        {/* Chip-filtre */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <ChipButton active={teamId === ''} onClick={() => setTeamId('')}>Alle hold</ChipButton>
            {teams.map(t => (
              <ChipButton key={t.id} active={teamId === t.id} color={t.color} onClick={() => setTeamId(teamId === t.id ? '' : t.id)}>
                {t.name}
              </ChipButton>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {statusOptions.map(opt => (
              <ChipButton key={opt.value} active={status === opt.value} onClick={() => setStatus(opt.value)}>
                {opt.label}
              </ChipButton>
            ))}
            {seasons.length > 0 && <span className="w-px bg-border shrink-0 mx-1" />}
            {seasons.map(s => (
              <ChipButton key={s} active={season === s} onClick={() => setSeason(season === s ? '' : s)}>
                {s}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-2" style={{ paddingBottom: selecting ? '7rem' : undefined }}>
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : games.length === 0 ? (
          <p className="text-center text-text3 text-sm pt-12">Ingen kampe fundet</p>
        ) : (
          games.map(game => (
            <GameRow
              key={game.id}
              game={game}
              team={teamMap[game.team_id]}
              selecting={selecting}
              isSelected={selected.has(game.id)}
              onClick={() => { if (selecting) toggleSelect(game.id); else navigate(`/games/${game.id}`); }}
              onDeleted={() => setGames(gs => gs.filter(g => g.id !== game.id))}
            />
          ))
        )}
      </div>

      {/* Bulk-action bar */}
      {selecting && (
        <div className="fixed left-0 right-0 z-50 bg-bg border-t border-border shadow-xl"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          <div className="px-4 py-3">
            <p className="text-xs text-text3 mb-2 text-center">
              {selected.size === 0 ? 'Ingen valgt' : `${selected.size} kamp${selected.size !== 1 ? 'e' : ''} valgt`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={bulkArchive} disabled={bulkWorking || selected.size === 0}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-bg2 text-text2 disabled:opacity-40 active:bg-border">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                <span className="text-[11px] font-semibold">Arkivér</span>
              </button>
              <button onClick={bulkHsSync} disabled={bulkWorking || selected.size === 0}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-bg2 text-text2 disabled:opacity-40 active:bg-border">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span className="text-[11px] font-semibold">Holdsport</span>
              </button>
              <button onClick={bulkDelete} disabled={bulkWorking || selected.size === 0}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-bg2 text-red disabled:opacity-40 active:bg-border">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                <span className="text-[11px] font-semibold">Slet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB — floating action button */}
      {!selecting && (
        <>
          {/* Overlay to close FAB */}
          {fabOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
          )}

          {/* FAB menu items */}
          {fabOpen && (
            <div className="fixed z-50 flex flex-col items-end gap-2"
              style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', right: '1rem' }}>
              <button
                onClick={() => { setFabOpen(false); setShowImport(true); }}
                disabled={importTeams.length === 0}
                className="flex items-center gap-2 bg-bg border border-border shadow-lg rounded-full pl-3 pr-4 py-2.5 text-sm font-semibold text-text1 disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Importer fra Holdsport
              </button>
              <button
                onClick={() => { setFabOpen(false); setShowNew(true); }}
                className="flex items-center gap-2 bg-bg border border-border shadow-lg rounded-full pl-3 pr-4 py-2.5 text-sm font-semibold text-text1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Opret kamp
              </button>
            </div>
          )}

          {/* FAB button */}
          <button
            onClick={() => setFabOpen(o => !o)}
            className="fixed z-50 w-14 h-14 rounded-full bg-green text-white shadow-lg flex items-center justify-center active:opacity-80 transition-transform"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))', right: '1rem',
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </>
      )}

      {showNew && (
        <NewGameSheet teams={teams} onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchGames(); }} />
      )}
      {showImport && (
        <HsImportGamesModal hsTeamId="625040" teams={importTeams}
          onImported={(count) => { setShowImport(false); if (count > 0) fetchGames(); }}
          onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

/* ─── GameRow ─────────────────────────────────────────────────────── */
function GameRow({ game, team, selecting, isSelected, onClick, onDeleted }: {
  game: Game; team?: Team;
  selecting: boolean; isSelected: boolean;
  onClick: () => void; onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const d      = new Date(game.date + 'T00:00:00');
  const day    = d.toLocaleDateString('da-DK', { weekday: 'short' });
  const dayNum = d.getDate();
  const mon    = d.toLocaleDateString('da-DK', { month: 'short' });
  const isHome = game.is_home === 1;
  const isDone = game.status === 'done';
  const color  = team?.color;

  async function doDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    try { await api.delete(`/games/${game.id}`); onDeleted(); }
    finally { setDeleting(false); }
  }

  if (confirmDelete && !selecting) {
    return (
      <div className="rounded-xl p-3 border border-red/30 bg-bg flex items-center gap-3">
        <p className="flex-1 text-sm text-text1 truncate">Slet <span className="font-semibold">{game.opponent}</span>?</p>
        <button onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-text2">Annuller</button>
        <button onClick={doDelete} disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg bg-red text-white font-semibold disabled:opacity-50">
          {deleting ? '…' : 'Slet'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`w-full text-left rounded-xl p-3 flex items-center gap-3 active:opacity-80 transition-opacity ${selecting ? 'pr-3' : 'pr-10'}`}
        style={color
          ? { backgroundColor: isSelected ? color + '25' : color + '12', borderLeft: `3px solid ${isSelected ? color : color}`, outline: isSelected ? `2px solid ${color}` : 'none', outlineOffset: '0px' }
          : { backgroundColor: 'var(--color-bg)', border: isSelected ? '2px solid var(--color-green)' : '1px solid var(--color-border)' }
        }
      >
        {/* Checkbox i select-mode */}
        {selecting && (
          <div
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors`}
            style={isSelected
              ? { backgroundColor: color ?? 'var(--color-green)', borderColor: color ?? 'var(--color-green)' }
              : { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }
            }
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <polyline points="1,6 5,10 11,2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </div>
        )}

        {/* Dato-blok */}
        <div className="shrink-0 w-11 flex flex-col items-center justify-center rounded-lg py-1.5"
          style={color ? { backgroundColor: color + '22' } : { backgroundColor: 'var(--color-bg2)' }}>
          <span className="text-[10px] font-medium text-text3 uppercase">{day}</span>
          <span className="text-lg font-bold text-text1 leading-tight">{dayNum}</span>
          <span className="text-[10px] font-medium text-text3">{mon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {team && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: team.color }}>
                {team.name}
              </span>
            )}
            <span className="text-[11px] text-text3">{isHome ? 'hjemme vs.' : 'ude mod'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-text1 text-sm truncate">{game.opponent}</p>
            {game.has_double_booking === 1 && <DoubleBookingBadge />}
            {game.has_no_keeper === 1 && <NoKeeperBadge />}
          </div>
          {game.time && (
            <p className="text-xs text-text3 mt-0.5">{game.time}{game.location ? ` · ${game.location}` : ''}</p>
          )}
          {!game.time && game.location && (
            <p className="text-xs text-text3 mt-0.5 truncate">{game.location}</p>
          )}
          {game.tag && (
            <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg2 text-text3 border border-border">
              {game.tag}
            </span>
          )}
          {((game.player_count ?? 0) > 0 || game.coach_names) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {(game.player_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 bg-green text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {game.player_count}
                </span>
              )}
              {game.coach_names && (() => {
                const firstNames = game.coach_names!.split(', ').map(n => n.split(' ')[0]).join(', ');
                return (
                  <span className="inline-flex items-center gap-1 bg-white text-green border border-green text-[11px] font-bold px-2 py-0.5 rounded-full">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {firstNames}
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Resultat / badge */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {isDone && game.result_us !== null ? (
            <>
              <span className="text-lg font-bold text-text1 leading-tight">{game.result_us}–{game.result_them}</span>
              {(() => {
                const us = game.result_us, them = game.result_them!;
                const [label, cls] = us > them ? ['Sejr', 'text-green'] : us < them ? ['Nederlag', 'text-red'] : ['Uafgjort', 'text-text3'];
                return <span className={`text-[10px] font-semibold ${cls}`}>{label}</span>;
              })()}
              {game.motm_player_id && <span className="text-[10px] text-text3">🧸 Fidus</span>}
            </>
          ) : (
            <StatusBadge status={game.status} />
          )}
        </div>
      </button>

      {/* Slet-knap — kun uden for select-mode */}
      {!selecting && (
        <button
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-bg2 flex items-center justify-center text-text3 active:bg-border"
          title="Slet kamp"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─── Badges ──────────────────────────────────────────────────────── */
function DoubleBookingBadge() {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative shrink-0" onClick={e => { e.stopPropagation(); setVisible(v => !v); }}>
      <span onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
        className="inline-flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-default">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="#713f12" strokeWidth="2"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="#713f12" strokeWidth="2"/>
        </svg>
        Dobbelt
      </span>
      {visible && (
        <span className="absolute bottom-full left-0 mb-1.5 z-50 w-52 bg-yellow-900 text-yellow-50 text-[11px] leading-snug px-2.5 py-2 rounded-lg shadow-lg pointer-events-none">
          ⚠️ En eller flere spillere er tilmeldt to kampe samme dag
          <span className="absolute top-full left-3 border-4 border-transparent border-t-yellow-900" />
        </span>
      )}
    </span>
  );
}

function NoKeeperBadge() {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative shrink-0" onClick={e => { e.stopPropagation(); setVisible(v => !v); }}>
      <span onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
        className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-default">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Ingen keeper
      </span>
      {visible && (
        <span className="absolute bottom-full left-0 mb-1.5 z-50 w-52 bg-gray-900 text-white text-[11px] leading-snug px-2.5 py-2 rounded-lg shadow-lg pointer-events-none">
          ⚠️ Ingen spiller er markeret som keeper til denne kamp
          <span className="absolute top-full left-3 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

function StatusBadge({ status }: { status: Game['status'] }) {
  const cfg = {
    planned:  { cls: 'bg-bg2 text-text3',             label: 'Planlagt' },
    done:     { cls: 'bg-green-light text-green-dark', label: 'Spillet' },
    archived: { cls: 'bg-bg2 text-text3',             label: 'Arkiveret' },
  };
  const { cls, label } = cfg[status];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function ChipButton({ children, active, color, onClick }: {
  children: React.ReactNode; active: boolean; color?: string; onClick: () => void;
}) {
  const activeStyle = color ? { backgroundColor: color + '22', borderColor: color, color } : {};
  return (
    <button onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        active ? color ? 'border-transparent' : 'bg-green text-white border-transparent' : 'bg-bg2 text-text2 border-transparent'
      }`}
      style={active && color ? activeStyle : {}}
    >{children}</button>
  );
}
