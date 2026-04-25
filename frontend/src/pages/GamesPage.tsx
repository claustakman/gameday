import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';

export default function GamesPage() {
  const navigate = useNavigate();
  const [games, setGames]   = useState<Game[]>([]);
  const [teams, setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamId,  setTeamId]  = useState('');
  const [season,  setSeason]  = useState('');
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (teamId) params.set('team_id', teamId);
    if (season) params.set('season', season);
    if (status) params.set('status', status);
    if (search) params.set('opponent', search);

    api.get<Game[]>(`/games?${params}`)
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }, [teamId, season, status, search]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const seasons = [...new Set(games.map(g => g.season))].sort().reverse();

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-bg px-4 pt-6 pb-3 border-b border-border">
        <h2 className="text-xl font-bold text-text1 mb-3">Kampe</h2>

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

        {/* Filtre */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            className="shrink-0 bg-bg2 rounded-lg px-3 py-1.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green"
          >
            <option value="">Alle hold</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="shrink-0 bg-bg2 rounded-lg px-3 py-1.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green"
          >
            <option value="">Alle sæsoner</option>
            {seasons.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="shrink-0 bg-bg2 rounded-lg px-3 py-1.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green"
          >
            <option value="">Alle statusser</option>
            <option value="planned">Planlagt</option>
            <option value="done">Spillet</option>
            <option value="archived">Arkiveret</option>
          </select>
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
            <GameCard
              key={game.id}
              game={game}
              team={teamMap[game.team_id]}
              onClick={() => navigate(`/games/${game.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function GameCard({ game, team, onClick }: { game: Game; team?: Team; onClick: () => void }) {
  const date = formatDate(game.date);
  const isHome = game.is_home === 1;
  const isDone = game.status === 'done';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg rounded-xl border border-border p-3.5 active:bg-bg2 transition-colors"
    >
      {/* Top row: dato + hold-badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text3 font-medium">{date}{game.time ? ` · ${game.time}` : ''}</span>
        <div className="flex items-center gap-1.5">
          {team && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: team.color }}
            >
              {team.name}
            </span>
          )}
          <StatusBadge status={game.status} />
        </div>
      </div>

      {/* Modstander */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-text3">{isHome ? 'Hjemme vs.' : 'Ude mod'}</span>
        <span className="font-semibold text-text1">{game.opponent}</span>
      </div>

      {/* Resultat eller lokation */}
      {isDone && game.result_us !== null ? (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-lg font-bold text-text1">{game.result_us}–{game.result_them}</span>
          {game.motm_player_id && (
            <span className="text-xs text-text3">⭐ MOTM</span>
          )}
        </div>
      ) : game.location ? (
        <p className="text-xs text-text2 truncate">{game.location}</p>
      ) : null}
    </button>
  );
}

function StatusBadge({ status }: { status: Game['status'] }) {
  if (status === 'planned') return null;
  const styles = {
    done:     'bg-green-light text-green-dark',
    archived: 'bg-bg2 text-text3',
  } as const;
  const labels = { done: 'Spillet', archived: 'Arkiveret' } as const;
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}
