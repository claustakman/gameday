import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Team, StandingRow } from '../lib/types';

interface StandingData {
  poolName: string;
  rows: StandingRow[];
  lines: { position: number; type: string }[];
}

export default function StandingPage() {
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [standing, setStanding] = useState<StandingData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.get<Team[]>('/teams').then(ts => {
      setTeams(ts);
      const first = ts.find(t => t.standing_url);
      if (first) setSelected(first.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    const team = teams.find(t => t.id === selected);
    if (!team?.standing_url) { setStanding(null); return; }

    const m = team.standing_url.match(/\/puljer\/(\d+)/);
    if (!m) { setError('Ugyldig URL'); return; }

    setLoading(true);
    setError('');
    setStanding(null);
    api.get<StandingData>(`/standing/${m[1]}`)
      .then(d => setStanding(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Kunne ikke hente stilling'))
      .finally(() => setLoading(false));
  }, [selected, teams]);

  const team = teams.find(t => t.id === selected);
  const color = team?.color ?? '#1D9E75';
  const teamsWithStanding = teams.filter(t => t.standing_url);
  const ourTeamNames = teams.map(t => t.name.trim().toLowerCase());

  function isOurs(row: StandingRow) {
    const n = row.teamName.toLowerCase();
    return ourTeamNames.some(own => n.includes(own) || own.includes(n));
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-bg px-4 pt-6 pb-3 border-b border-border">
        <h2 className="text-xl font-bold text-text1 mb-3">Stilling</h2>
        {teamsWithStanding.length === 0 ? (
          <p className="text-sm text-text3">Ingen hold har en stillingsurl endnu. Tilføj den i Indstillinger → Hold.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {teamsWithStanding.map(t => (
              <button key={t.id} onClick={() => setSelected(t.id)}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-colors"
                style={selected === t.id
                  ? { backgroundColor: t.color + '22', borderColor: t.color, color: t.color }
                  : { backgroundColor: '#f5f5f5', borderColor: 'transparent', color: '#4a4a4a' }}
              >{t.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        {loading && (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-sm text-red">{error}</p>}

        {standing && !loading && (
          <>
            <p className="text-xs font-medium text-text3 mb-4 uppercase tracking-wide">{standing.poolName}</p>

            {/* Column headers */}
            <div className="flex items-center px-3 mb-1">
              <span className="w-7 text-[10px] font-semibold text-text3 uppercase">#</span>
              <span className="flex-1 text-[10px] font-semibold text-text3 uppercase">Hold</span>
              <div className="flex gap-0 shrink-0">
                {['K','V','U','T','Mål','P'].map(h => (
                  <span key={h} className={`text-[10px] font-semibold text-text3 uppercase text-center ${h === 'Mål' ? 'w-12' : 'w-7'}`}>{h}</span>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border">
              {standing.rows.map((row, idx) => {
                const mine = isOurs(row);
                const lineAfter = standing.lines.find(l => l.position === row.priority);
                const isLast = idx === standing.rows.length - 1;

                return (
                  <div key={row.teamId}>
                    <div
                      className={`flex items-center py-3 ${!isLast && !lineAfter ? 'border-b border-border' : ''}`}
                      style={mine
                        ? { backgroundColor: color + '12', borderLeft: `4px solid ${color}`, paddingLeft: '10px', paddingRight: '12px' }
                        : { paddingLeft: '12px', paddingRight: '12px' }
                      }
                    >
                      {/* Rank */}
                      <div className="w-7 shrink-0">
                        <span className={`text-sm tabular-nums font-bold ${mine ? '' : 'text-text3'}`}
                          style={mine ? { color } : {}}>
                          {row.priority}
                        </span>
                      </div>

                      {/* Team name */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm truncate block ${mine ? 'font-bold text-text1' : 'text-text1'}`}>
                          {row.teamName}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-0 shrink-0">
                        <span className="w-7 text-xs tabular-nums text-center text-text3">{row.matchCount}</span>
                        <span className="w-7 text-xs tabular-nums text-center text-text2">{row.wins}</span>
                        <span className="w-7 text-xs tabular-nums text-center text-text2">{row.draws}</span>
                        <span className="w-7 text-xs tabular-nums text-center text-text2">{row.losses}</span>
                        <span className="w-12 text-xs tabular-nums text-center text-text2">{row.goalsFor}–{row.goalsAgainst}</span>
                        <span className={`w-7 text-sm tabular-nums text-center font-black ${mine ? '' : 'text-text1'}`}
                          style={mine ? { color } : {}}>
                          {row.points}
                        </span>
                      </div>
                    </div>

                    {lineAfter && (
                      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-bg2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[9px] font-semibold text-text3 uppercase tracking-wide">{lineAfter.type}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
              {[['K','Kampe'],['V','Vundet'],['U','Uafgjort'],['T','Tabt'],['P','Point']].map(([k,v]) => (
                <span key={k} className="text-[11px] text-text3"><span className="font-semibold text-text2">{k}</span> = {v}</span>
              ))}
            </div>
          </>
        )}

        {!loading && !error && !standing && selected && (
          <p className="text-sm text-text3 pt-4">Ingen stillingsdata tilgængelig.</p>
        )}
      </div>
    </div>
  );
}
