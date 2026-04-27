import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';
import NewGameSheet from '../components/NewGameSheet';

export default function GamesPage() {
  const navigate = useNavigate();
  const [games, setGames]   = useState<Game[]>([]);
  const [teams, setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const [teamId,       setTeamId]       = useState('');
  const [season,       setSeason]       = useState('');
  const [status,       setStatus]       = useState('');
  const [search,       setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  // Debounce søgning 300ms — undgår flickering ved hver keystroke
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

  useEffect(() => {
    fetchGames();
  }, [teamId, season, status, debouncedSearch]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const seasons = [...new Set(games.map(g => g.season))].sort().reverse();

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
          <h2 className="text-xl font-bold text-text1">Kampe</h2>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 bg-green text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ny kamp
          </button>
        </div>

        {/* Søgefelt */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Søg modstander…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg2 rounded-lg pl-9 pr-3 py-2 text-sm text-text1 placeholder-text3 focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>

        {/* Chip-filtre */}
        <div className="flex flex-col gap-2">
          {/* Hold chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <ChipButton active={teamId === ''} onClick={() => setTeamId('')}>Alle hold</ChipButton>
            {teams.map(t => (
              <ChipButton
                key={t.id}
                active={teamId === t.id}
                color={t.color}
                onClick={() => setTeamId(teamId === t.id ? '' : t.id)}
              >
                {t.name}
              </ChipButton>
            ))}
          </div>

          {/* Status + sæson chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {statusOptions.map(opt => (
              <ChipButton
                key={opt.value}
                active={status === opt.value}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
              </ChipButton>
            ))}
            {seasons.length > 0 && <span className="w-px bg-border shrink-0 mx-1" />}
            {seasons.map(s => (
              <ChipButton
                key={s}
                active={season === s}
                onClick={() => setSeason(season === s ? '' : s)}
              >
                {s}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-2">
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
              onClick={() => navigate(`/games/${game.id}`)}
            />
          ))
        )}
      </div>

      {showNew && (
        <NewGameSheet
          teams={teams}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            fetchGames();
          }}
        />
      )}
    </div>
  );
}

function ChipButton({
  children, active, color, onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  const activeStyle = color
    ? { backgroundColor: color + '22', borderColor: color, color }
    : {};
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
        active
          ? color ? 'border-transparent' : 'bg-green text-white border-transparent'
          : 'bg-bg2 text-text2 border-transparent'
      }`}
      style={active && color ? activeStyle : {}}
    >
      {children}
    </button>
  );
}

function GameRow({ game, team, onClick }: { game: Game; team?: Team; onClick: () => void }) {
  const d = new Date(game.date + 'T00:00:00');
  const day   = d.toLocaleDateString('da-DK', { weekday: 'short' });
  const dayNum = d.getDate();
  const mon   = d.toLocaleDateString('da-DK', { month: 'short' });
  const isHome = game.is_home === 1;
  const isDone = game.status === 'done';

  const color = team?.color;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 flex items-center gap-3 active:opacity-80 transition-opacity"
      style={color ? { backgroundColor: color + '12', borderLeft: `3px solid ${color}` } : { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
    >
      {/* Dato-blok */}
      <div
        className="shrink-0 w-11 flex flex-col items-center justify-center rounded-lg py-1.5"
        style={color ? { backgroundColor: color + '22' } : { backgroundColor: 'var(--color-bg2)' }}
      >
        <span className="text-[10px] font-medium text-text3 uppercase">{day}</span>
        <span className="text-lg font-bold text-text1 leading-tight">{dayNum}</span>
        <span className="text-[10px] font-medium text-text3">{mon}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] text-text3">{isHome ? 'Hjemme vs.' : 'Ude mod'}</span>
          {team && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: team.color }}
            >
              {team.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-text1 text-sm truncate">{game.opponent}</p>
          {game.has_double_booking === 1 && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          )}
        </div>
        {game.time && (
          <p className="text-xs text-text3 mt-0.5">{game.time}{game.location ? ` · ${game.location}` : ''}</p>
        )}
        {!game.time && game.location && (
          <p className="text-xs text-text3 mt-0.5 truncate">{game.location}</p>
        )}
      </div>

      {/* Højre: resultat eller badge */}
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {isDone && game.result_us !== null ? (
          <>
            <span className="text-lg font-bold text-text1 leading-tight">{game.result_us}–{game.result_them}</span>
            {(() => {
              const us = game.result_us, them = game.result_them!;
              const [label, cls] = us > them ? ['Sejr', 'text-green'] : us < them ? ['Nederlag', 'text-red'] : ['Uafgjort', 'text-text3'];
              return <span className={`text-[10px] font-semibold ${cls}`}>{label}</span>;
            })()}
            {game.motm_player_id && <span className="text-[10px] text-text3">⭐ MOTM</span>}
          </>
        ) : (
          <StatusBadge status={game.status} />
        )}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: Game['status'] }) {
  const cfg = {
    planned:  { cls: 'bg-bg2 text-text3',            label: 'Planlagt' },
    done:     { cls: 'bg-green-light text-green-dark', label: 'Spillet' },
    archived: { cls: 'bg-bg2 text-text3',            label: 'Arkiveret' },
  };
  const { cls, label } = cfg[status];
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}
