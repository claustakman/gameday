import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Game, Team, PlayerStat } from '../lib/types';

interface StatsResponse {
  games: Game[];
  player_stats: PlayerStat[];
}

export default function StatsPage() {
  const [stats,   setStats]   = useState<StatsResponse | null>(null);
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamId, setTeamId] = useState('');
  const [season, setSeason] = useState('');

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (teamId) params.set('team_id', teamId);
    if (season) params.set('season', season);
    api.get<StatsResponse>(`/stats?${params}`)
      .then(s => {
        setStats(s);
        // Default til nyeste sæson første gang
        if (!season && s.games.length > 0) {
          const seasons = [...new Set(s.games.map(g => g.season))].sort().reverse();
          if (seasons[0]) setSeason(seasons[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId, season]);

  const games = stats?.games ?? [];
  const playerStats = stats?.player_stats ?? [];

  const allSeasons = [...new Set(games.map(g => g.season))].sort().reverse();

  const played = games.length;
  const wins   = games.filter(g => g.result_us !== null && g.result_them !== null && g.result_us  > g.result_them!).length;
  const draws  = games.filter(g => g.result_us !== null && g.result_them !== null && g.result_us === g.result_them!).length;
  const losses = games.filter(g => g.result_us !== null && g.result_them !== null && g.result_us  < g.result_them!).length;
  const goalsFor     = games.reduce((s, g) => s + (g.result_us   ?? 0), 0);
  const goalsAgainst = games.reduce((s, g) => s + (g.result_them ?? 0), 0);
  const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

  const tally1 = games.reduce((s, g) => s + g.tally_1, 0);
  const tally2 = games.reduce((s, g) => s + g.tally_2, 0);
  const tally3 = games.reduce((s, g) => s + g.tally_3, 0);
  const latestWithFocus = [...games].reverse().find(g => g.focus_1);
  const focusLabel1 = latestWithFocus?.focus_1 ?? 'Fokus 1';
  const focusLabel2 = latestWithFocus?.focus_2 ?? 'Fokus 2';
  const focusLabel3 = latestWithFocus?.focus_3 ?? 'Fokus 3';

  const currentTeam = teams.find(t => t.id === teamId);
  const accentColor = currentTeam?.color ?? '#1D9E75';

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6" style={{ paddingBottom: 'calc(1.5rem + 4rem + env(safe-area-inset-bottom))' }}>
      <h2 className="text-xl font-bold text-text1 mb-4">Stats</h2>

      {/* Chip-filtre */}
      <div className="flex flex-col gap-2 mb-5">
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
        {allSeasons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {allSeasons.map(s => (
              <ChipButton
                key={s}
                active={season === s}
                onClick={() => setSeason(season === s ? '' : s)}
              >
                {s}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      {played === 0 ? (
        <div className="bg-bg rounded-xl border border-border px-4 py-8 text-center">
          <p className="text-text3 text-sm">Ingen afsluttede kampe i den valgte periode</p>
        </div>
      ) : (
        <>
          {/* Hoved-stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Kampe spillet" value={String(played)} color={accentColor} />
            <StatCard label="Sejrsprocent"  value={`${winPct}%`}   color={accentColor} />
            <StatCard label="Mål for"       value={String(goalsFor)}     color={accentColor} />
            <StatCard label="Mål imod"      value={String(goalsAgainst)} color={accentColor} />
          </div>

          {/* W/D/L bar */}
          <div className="bg-bg rounded-xl border border-border p-4 mb-4">
            <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Resultater</p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
              {wins   > 0 && <div className="bg-green" style={{ flex: wins }} />}
              {draws  > 0 && <div className="bg-bg2 border border-border" style={{ flex: draws }} />}
              {losses > 0 && <div className="bg-red"   style={{ flex: losses }} />}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green font-semibold">{wins} sejr{wins !== 1 ? 'e' : ''}</span>
              <span className="text-text3">{draws} uafgjort</span>
              <span className="text-red font-semibold">{losses} nederlag</span>
            </div>
          </div>

          {/* Spillerstatistik */}
          {playerStats.length > 0 && (
            <div className="bg-bg rounded-xl border border-border p-4 mb-4">
              <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Spillere</p>
              <div className="flex flex-col gap-0">
                {/* Header */}
                <div className="flex items-center gap-2 px-1 pb-2 border-b border-border">
                  <div className="flex-1 min-w-0" />
                  <span className="text-[10px] font-semibold text-text3 w-10 text-center">Kampe</span>
                  <span className="text-[10px] font-semibold text-text3 w-10 text-center">Fremmøde</span>
                  <span className="text-[10px] font-semibold text-text3 w-8 text-center">⭐</span>
                </div>

                {playerStats.map((p, i) => {
                  const pct = played > 0 ? Math.round((p.appearances / played) * 100) : 0;
                  const isTopMOTM = p.motm_count > 0 && p.motm_count === Math.max(...playerStats.map(x => x.motm_count));
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 py-2.5 px-1 ${i < playerStats.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{ backgroundColor: accentColor, color: '#fff' }}
                      >
                        {initials(p.full_name)}
                      </div>

                      {/* Navn */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text1 truncate">
                          {p.nickname ?? p.full_name}
                        </p>
                        {p.nickname && (
                          <p className="text-[10px] text-text3 truncate">{p.full_name}</p>
                        )}
                      </div>

                      {/* Kampe */}
                      <span className="text-sm font-semibold text-text1 w-10 text-center">{p.appearances}</span>

                      {/* Fremmøde% — med mini bar */}
                      <div className="w-10 flex flex-col items-center gap-0.5">
                        <span className="text-xs font-semibold text-text1">{pct}%</span>
                        <div className="w-8 h-1 bg-bg2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                        </div>
                      </div>

                      {/* MOTM */}
                      <div className="w-8 text-center">
                        {p.motm_count > 0 ? (
                          <span className={`text-xs font-bold ${isTopMOTM ? 'text-green' : 'text-text2'}`}>
                            {p.motm_count > 1 ? `×${p.motm_count}` : '⭐'}
                          </span>
                        ) : (
                          <span className="text-text3 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fokuspunkter — total */}
          {(tally1 > 0 || tally2 > 0 || tally3 > 0) && (
            <div className="bg-bg rounded-xl border border-border p-4 mb-4">
              <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Fokuspunkter — total</p>
              <div className="flex flex-col gap-3">
                {([[focusLabel1, tally1], [focusLabel2, tally2], [focusLabel3, tally3]] as [string, number][])
                  .filter(([, count]) => count > 0)
                  .map(([label, count], i) => {
                    const max = Math.max(tally1, tally2, tally3, 1);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text1 font-medium truncate pr-2">{label}</span>
                          <span className="font-bold shrink-0" style={{ color: accentColor }}>{count}</span>
                        </div>
                        <div className="h-1.5 bg-bg2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, backgroundColor: accentColor }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Seneste kampe */}
          <div className="bg-bg rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Seneste kampe</p>
            <div className="flex flex-col gap-2">
              {games.slice(0, 8).map(g => {
                const won = g.result_us !== null && g.result_them !== null ? g.result_us > g.result_them! : null;
                const d = new Date(g.date + 'T00:00:00');
                const motmPlayer = g.motm_player_id
                  ? playerStats.find(p => p.id === g.motm_player_id)
                  : null;
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: won ? '#1D9E75' : won === false ? '#A32D2D' : '#9CA3AF' }} />
                    <span className="text-xs text-text3 w-14 shrink-0">
                      {d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-text1 truncate block">{g.opponent}</span>
                      {motmPlayer && (
                        <span className="text-[10px] text-text3">⭐ {motmPlayer.nickname ?? motmPlayer.full_name}</span>
                      )}
                    </div>
                    {g.result_us !== null && (
                      <span className={`text-sm font-bold shrink-0 ${won ? 'text-green' : won === false ? 'text-red' : 'text-text3'}`}>
                        {g.result_us}–{g.result_them}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded-xl border border-border p-4">
      <p className="text-xs text-text2 mb-1">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

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
