import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';

export default function HomePage() {
  const navigate = useNavigate();
  const [games, setGames]   = useState<Game[]>([]);
  const [teams, setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Team[]>('/teams').catch(() => [] as Team[]),
      api.get<Game[]>('/games?').catch(() => [] as Game[]),
    ]).then(([t, g]) => {
      setTeams(t);
      setGames(g);
    }).finally(() => setLoading(false));
  }, []);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const today = new Date().toISOString().slice(0, 10);

  // Næste kampe per hold (planlagt, dato >= i dag)
  const upcoming = games
    .filter(g => g.status === 'planned' && g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Seneste resultater (done), max 5
  const recent = games
    .filter(g => g.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Næste kamp per hold
  const nextByTeam = new Map<string, Game>();
  for (const g of upcoming) {
    if (!nextByTeam.has(g.team_id)) nextByTeam.set(g.team_id, g);
  }
  const nextCards = Array.from(nextByTeam.values());

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6" style={{ paddingBottom: 'calc(1rem + 4rem + env(safe-area-inset-bottom))' }}>
      {/* Greeting */}
      <h2 className="text-xl font-bold text-text1 mb-5">Hjem</h2>

      {/* Næste kampe */}
      {nextCards.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Næste kamp</p>
          <div className="flex flex-col gap-3">
            {nextCards.map(game => (
              <NextGameCard
                key={game.id}
                game={game}
                team={teamMap[game.team_id]}
                onClick={() => navigate(`/games/${game.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {nextCards.length === 0 && (
        <section className="mb-6">
          <div className="bg-bg rounded-xl border border-border px-4 py-6 text-center">
            <p className="text-text3 text-sm">Ingen kommende kampe planlagt</p>
          </div>
        </section>
      )}

      {/* Seneste resultater */}
      {recent.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Seneste resultater</p>
          <div className="flex flex-col gap-2">
            {recent.map(game => (
              <RecentResultRow
                key={game.id}
                game={game}
                team={teamMap[game.team_id]}
                onClick={() => navigate(`/games/${game.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NextGameCard({ game, team, onClick }: { game: Game; team?: Team; onClick: () => void }) {
  const d = new Date(game.date + 'T00:00:00');
  const weekday = d.toLocaleDateString('da-DK', { weekday: 'long' });
  const dateStr = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
  const color = team?.color ?? '#1D9E75';
  const isHome = game.is_home === 1;

  const daysUntil = Math.round((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  const daysLabel = daysUntil === 0 ? 'I dag' : daysUntil === 1 ? 'I morgen' : `Om ${daysUntil} dage`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 overflow-hidden relative active:opacity-90 transition-opacity"
      style={{ backgroundColor: color + '18', borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full text-white mb-2 inline-block"
            style={{ backgroundColor: color }}
          >
            {team?.name ?? 'Hold'}
          </span>
          <p className="text-xs text-text3 mt-1">{daysLabel}</p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      <p className="text-text3 text-xs mb-0.5">{isHome ? 'Hjemme vs.' : 'Ude mod'}</p>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xl font-bold text-text1">{game.opponent}</p>
        {game.has_double_booking === 1 && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-text2">
        <span>{capitalize(weekday)} {dateStr}</span>
        {game.time && <span>· {game.time}</span>}
        {game.meetup_time && <span>· Mødes {game.meetup_time}</span>}
      </div>

      {game.location && (
        <p className="text-xs text-text3 mt-1 truncate">📍 {game.location}</p>
      )}
    </button>
  );
}

function RecentResultRow({ game, team, onClick }: { game: Game; team?: Team; onClick: () => void }) {
  const d = new Date(game.date + 'T00:00:00');
  const day    = d.toLocaleDateString('da-DK', { weekday: 'short' });
  const dayNum = d.getDate();
  const mon    = d.toLocaleDateString('da-DK', { month: 'short' });
  const isHome = game.is_home === 1;
  const color  = team?.color;

  const us = game.result_us, them = game.result_them;
  const won = us !== null && them !== null ? us > them ? 'win' : us < them ? 'loss' : 'draw' : null;
  const resultColor = won === 'win' ? 'text-green' : won === 'loss' ? 'text-red' : 'text-text3';
  const resultLabel = won === 'win' ? 'Sejr' : won === 'loss' ? 'Nederlag' : 'Uafgjort';

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
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: team.color }}>
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
      </div>

      {/* Resultat */}
      {us !== null && (
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className={`text-lg font-bold leading-tight ${resultColor}`}>{us}–{them}</span>
          <span className={`text-[10px] font-semibold ${resultColor}`}>{resultLabel}</span>
          {game.motm_player_id && <span className="text-[10px] text-text3">⭐ MOTM</span>}
        </div>
      )}
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
