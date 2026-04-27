import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Game, Team } from '../lib/types';

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game,    setGame]    = useState<Game | null>(null);
  const [team,    setTeam]    = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Finish game sheet
  const [showFinish, setShowFinish] = useState(false);
  const [resultUs,   setResultUs]   = useState('');
  const [resultThem, setResultThem] = useState('');
  const [wentWell,   setWentWell]   = useState('');
  const [wentBad,    setWentBad]    = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Game>(`/games/${id}`)
      .then(g => {
        setGame(g);
        return api.get<Team[]>('/teams').then(ts => {
          const t = ts.find(x => x.id === g.team_id);
          setTeam(t ?? null);
        });
      })
      .catch(() => setError('Kunne ikke hente kamp'))
      .finally(() => setLoading(false));
  }, [id]);

  async function incTally(field: 'tally_1' | 'tally_2' | 'tally_3', delta: 1 | -1) {
    if (!game || !id) return;
    await api.patch(`/games/${id}/tally`, { field, delta });
    setGame(g => g ? { ...g, [field]: Math.max(0, (g[field] ?? 0) + delta) } : g);
  }

  async function finishGame() {
    if (!id) return;
    const us = parseInt(resultUs);
    const them = parseInt(resultThem);
    if (isNaN(us) || isNaN(them)) return;
    setSaving(true);
    try {
      await api.post(`/games/${id}/finish`, {
        result_us: us,
        result_them: them,
        went_well: wentWell.trim() || null,
        went_bad:  wentBad.trim()  || null,
      });
      setGame(g => g ? { ...g, status: 'done', result_us: us, result_them: them, went_well: wentWell.trim() || null, went_bad: wentBad.trim() || null } : g);
      setShowFinish(false);
    } finally {
      setSaving(false);
    }
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
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-text3 text-sm mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          Tilbage
        </button>
        <p className="text-red text-sm">{error || 'Kamp ikke fundet'}</p>
      </div>
    );
  }

  const d = new Date(game.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  const isHome = game.is_home === 1;
  const isDone = game.status === 'done';
  const color  = team?.color ?? '#1D9E75';

  const focuses = [
    { focus: game.focus_1, goal: game.goal_1, tally: game.tally_1, field: 'tally_1' as const },
    { focus: game.focus_2, goal: game.goal_2, tally: game.tally_2, field: 'tally_2' as const },
    { focus: game.focus_3, goal: game.goal_3, tally: game.tally_3, field: 'tally_3' as const },
  ].filter(f => f.focus);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 bg-bg border-b border-border">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-text3 text-sm mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          Kampe
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-text3">{isHome ? 'Hjemme vs.' : 'Ude mod'}</span>
              {team && (
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: color }}
                >
                  {team.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text1">{game.opponent}</h1>
          </div>

          {isDone && game.result_us !== null && (
            <div className="text-right">
              <span className="text-3xl font-black text-text1">{game.result_us}–{game.result_them}</span>
              <p className="text-xs text-text3 mt-0.5">
                {game.result_us > game.result_them! ? 'Sejr' : game.result_us < game.result_them! ? 'Nederlg' : 'Uafgjort'}
              </p>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <MetaItem icon="📅">{capitalize(dateStr)}</MetaItem>
          {game.time && <MetaItem icon="⏰">{game.time}{game.meetup_time ? ` (møder ${game.meetup_time})` : ''}</MetaItem>}
          {game.location && <MetaItem icon="📍">{game.location}</MetaItem>}
        </div>

        {/* Status badge */}
        <div className="mt-3">
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
                  <div className="flex items-start justify-between">
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

                    {/* Tæller — kun hvis ikke done */}
                    {!isDone && (
                      <div className="flex items-center gap-2 ml-3 shrink-0">
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
                    )}
                    {isDone && (
                      <span className="text-2xl font-black ml-3" style={{ color }}>{f.tally}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evaluering (kun når done) */}
        {isDone && (game.went_well || game.went_bad) && (
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
                  <p className="text-xs font-semibold text-red mb-1">⚠️ Det kan vi gøre bedre</p>
                  <p className="text-sm text-text1">{game.went_bad}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Afslut kamp-knap */}
        {!isDone && (
          <div className="mt-2">
            <button
              onClick={() => setShowFinish(true)}
              className="w-full rounded-xl py-3.5 font-semibold text-sm text-white"
              style={{ backgroundColor: color }}
            >
              Afslut kamp
            </button>
          </div>
        )}
      </div>

      {/* Finish sheet */}
      {showFinish && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowFinish(false)} />
          <div className="fixed bottom-14 left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="px-4 pt-2 pb-4">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-text1">Afslut kamp</h3>
                <button onClick={() => setShowFinish(false)} className="text-text3 p-1">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Resultat */}
              <p className="text-xs font-medium text-text2 mb-2">Resultat</p>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="number"
                  min="0"
                  placeholder="Os"
                  value={resultUs}
                  onChange={e => setResultUs(e.target.value)}
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-2xl font-bold text-center text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
                />
                <span className="text-xl font-bold text-text3">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Dem"
                  value={resultThem}
                  onChange={e => setResultThem(e.target.value)}
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-2xl font-bold text-center text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg"
                />
              </div>

              {/* Det gik godt */}
              <p className="text-xs font-medium text-text2 mb-1.5">Det gik godt (valgfri)</p>
              <textarea
                placeholder="Hvad fungerede?"
                value={wentWell}
                onChange={e => setWentWell(e.target.value)}
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg resize-none mb-3"
              />

              {/* Det kan vi gøre bedre */}
              <p className="text-xs font-medium text-text2 mb-1.5">Det kan vi gøre bedre (valgfri)</p>
              <textarea
                placeholder="Hvad skal vi arbejde på?"
                value={wentBad}
                onChange={e => setWentBad(e.target.value)}
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg resize-none mb-4"
              />

              <button
                onClick={finishGame}
                disabled={saving || resultUs === '' || resultThem === ''}
                className="w-full rounded-xl py-3.5 font-semibold text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {saving ? 'Gemmer…' : 'Gem resultat'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetaItem({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs text-text2">
      <span>{icon}</span>
      <span>{children}</span>
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
