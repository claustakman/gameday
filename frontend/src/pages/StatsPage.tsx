import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';

export default function StatsPage() {
  const [games,  setGames]  = useState<Game[]>([]);
  const [teams,  setTeams]  = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamId, setTeamId] = useState('');
  const [season, setSeason] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Team[]>('/teams').catch(() => [] as Team[]),
      api.get<Game[]>('/games?status=done').catch(() => [] as Game[]),
    ]).then(([t, g]) => {
      setTeams(t);
      setGames(g);
      // Default til nyeste sæson
      const seasons = [...new Set(g.map(x => x.season))].sort().reverse();
      if (seasons[0]) setSeason(seasons[0]);
    }).finally(() => setLoading(false));
  }, []);

  const seasons = [...new Set(games.map(g => g.season))].sort().reverse();

  const filtered = games.filter(g => {
    if (teamId && g.team_id !== teamId) return false;
    if (season && g.season !== season)  return false;
    return true;
  });

  const played = filtered.length;
  const wins   = filtered.filter(g => g.result_us !== null && g.result_them !== null && g.result_us > g.result_them).length;
  const draws  = filtered.filter(g => g.result_us !== null && g.result_them !== null && g.result_us === g.result_them).length;
  const losses = filtered.filter(g => g.result_us !== null && g.result_them !== null && g.result_us < g.result_them!).length;
  const goalsFor     = filtered.reduce((s, g) => s + (g.result_us ?? 0), 0);
  const goalsAgainst = filtered.reduce((s, g) => s + (g.result_them ?? 0), 0);
  const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

  // Tally totals per focus-slot across all filtered games
  const tally1 = filtered.reduce((s, g) => s + g.tally_1, 0);
  const tally2 = filtered.reduce((s, g) => s + g.tally_2, 0);
  const tally3 = filtered.reduce((s, g) => s + g.tally_3, 0);

  // Focus labels from most recent game that has them
  const latestWithFocus = [...filtered].reverse().find(g => g.focus_1);
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
    <div className="px-4 pt-6 pb-6">
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
        {seasons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
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
            <StatCard label="Sejrsprocent" value={`${winPct}%`} color={accentColor} />
            <StatCard label="Mål for" value={String(goalsFor)} color={accentColor} />
            <StatCard label="Mål imod" value={String(goalsAgainst)} color={accentColor} />
          </div>

          {/* W/D/L bar */}
          <div className="bg-bg rounded-xl border border-border p-4 mb-4">
            <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Resultater</p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
              {wins   > 0 && <div className="bg-green"   style={{ flex: wins }} />}
              {draws  > 0 && <div className="bg-bg2 border border-border" style={{ flex: draws }} />}
              {losses > 0 && <div className="bg-red"     style={{ flex: losses }} />}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green font-semibold">{wins} sejr{wins !== 1 ? 'e' : ''}</span>
              <span className="text-text3">{draws} uafgjort</span>
              <span className="text-red font-semibold">{losses} nederlg</span>
            </div>
          </div>

          {/* Fokus tæller-totaler */}
          {(tally1 > 0 || tally2 > 0 || tally3 > 0) && (
            <div className="bg-bg rounded-xl border border-border p-4 mb-4">
              <p className="text-xs font-semibold text-text2 uppercase tracking-wide mb-3">Fokuspunkter — total</p>
              <div className="flex flex-col gap-3">
                {[[focusLabel1, tally1], [focusLabel2, tally2], [focusLabel3, tally3]].map(([label, count], i) => {
                  const max = Math.max(tally1, tally2, tally3, 1);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-text1 font-medium truncate pr-2">{label as string}</span>
                        <span className="font-bold shrink-0" style={{ color: accentColor }}>{count as number}</span>
                      </div>
                      <div className="h-1.5 bg-bg2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${((count as number) / max) * 100}%`, backgroundColor: accentColor }}
                        />
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
              {filtered.slice(0, 8).map(g => {
                const won = g.result_us !== null && g.result_them !== null ? g.result_us > g.result_them : null;
                const d = new Date(g.date + 'T00:00:00');
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: won ? '#1D9E75' : won === false ? '#A32D2D' : '#9CA3AF' }}
                    />
                    <span className="text-xs text-text3 w-14 shrink-0">
                      {d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-sm text-text1 flex-1 truncate">{g.opponent}</span>
                    {g.result_us !== null && (
                      <span className={`text-sm font-bold ${won ? 'text-green' : won === false ? 'text-red' : 'text-text3'}`}>
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
