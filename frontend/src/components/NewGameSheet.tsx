import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Team } from '../lib/types';

interface Props {
  teams: Team[];
  onCreated: (gameId: string) => void;
  onClose: () => void;
}

const EMPTY_FOCUS = { focus: '', goal: '' };

export default function NewGameSheet({ teams, onCreated, onClose }: Props) {
  const currentSeason = (() => {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  })();

  const seasons     = [...new Set(teams.map(t => t.season))].sort().reverse();
  const [season, setSeason] = useState(seasons[0] ?? currentSeason);
  const seasonTeams = teams.filter(t => t.season === season);

  const [teamId,     setTeamId]     = useState('');
  const [date,       setDate]       = useState('');
  const [time,       setTime]       = useState('');
  const [meetupTime, setMeetupTime] = useState('');
  const [opponent,   setOpponent]   = useState('');
  const [location,   setLocation]   = useState('');
  const [isHome,     setIsHome]     = useState(true);
  const [focuses,    setFocuses]    = useState([{ ...EMPTY_FOCUS }]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    setTeamId(seasonTeams[0]?.id ?? '');
  }, [season]);

  function setFocusField(i: number, field: 'focus' | 'goal', value: string) {
    setFocuses(fs => fs.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  }

  function addFocus() {
    if (focuses.length < 3) setFocuses(fs => [...fs, { ...EMPTY_FOCUS }]);
  }

  function removeFocus(i: number) {
    setFocuses(fs => fs.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!teamId || !date || !opponent.trim()) {
      setError('Udfyld hold, dato og modstander');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>('/games', {
        team_id: teamId,
        date,
        time: time || null,
        meetup_time: meetupTime || null,
        opponent: opponent.trim(),
        location: location.trim() || null,
        is_home: isHome,
      });

      // Gem fokuspunkter hvis udfyldt
      const filled = focuses.filter(f => f.focus.trim());
      if (filled.length > 0) {
        await api.post(`/games/${res.id}/focus`, {
          focus_1: filled[0]?.focus.trim() ?? null,
          goal_1:  filled[0]?.goal.trim()  ?? null,
          focus_2: filled[1]?.focus.trim() ?? null,
          goal_2:  filled[1]?.goal.trim()  ?? null,
          focus_3: filled[2]?.focus.trim() ?? null,
          goal_3:  filled[2]?.goal.trim()  ?? null,
        });
      }

      onCreated(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed bottom-14 left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl max-h-[calc(92dvh-3.5rem)] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Scrollbart indhold */}
        <div className="overflow-y-auto flex-1 px-4 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-text1">Ny kamp</h2>
            <button onClick={onClose} className="text-text3 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {seasons.length > 1 && (
              <Field label="Sæson">
                <select value={season} onChange={e => setSeason(e.target.value)} className={selectCls}>
                  {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}

            <Field label="Hold">
              {seasonTeams.length === 0 ? (
                <p className="text-sm text-red">Ingen hold for {season} — opret hold under Indstillinger</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {seasonTeams.map(t => (
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
              )}
            </Field>

            <Field label="Modstander">
              <input
                type="text"
                placeholder="Klubnavn"
                value={opponent}
                onChange={e => setOpponent(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Hvor">
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setIsHome(true)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${isHome ? 'bg-green text-white' : 'bg-bg text-text2'}`}
                >
                  Hjemme
                </button>
                <button
                  onClick={() => setIsHome(false)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${!isHome ? 'bg-green text-white' : 'bg-bg text-text2'}`}
                >
                  Ude
                </button>
              </div>
            </Field>

            <Field label="Dato">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </Field>

            <div className="flex gap-3">
              <Field label="Kampstart" className="flex-1">
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Mødetid" className="flex-1">
                <input type="time" value={meetupTime} onChange={e => setMeetupTime(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Lokation (valgfri)">
              <input
                type="text"
                placeholder="Bane, adresse…"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Fokuspunkter */}
            <div>
              <p className="text-xs font-medium text-text2 mb-2">Fokuspunkter (valgfri)</p>
              <div className="flex flex-col gap-3">
                {focuses.map((f, i) => (
                  <div key={i} className="bg-bg2 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text2">#{i + 1}</span>
                      {focuses.length > 1 && (
                        <button onClick={() => removeFocus(i)} className="text-text3">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Fokuspunkt (fx Presspil)"
                      value={f.focus}
                      onChange={e => setFocusField(i, 'focus', e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Mål (fx Vi presser efter hvert skud)"
                      value={f.goal}
                      onChange={e => setFocusField(i, 'goal', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}
                {focuses.length < 3 && (
                  <button
                    onClick={addFocus}
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
        </div>

        {/* Fast knap i bunden — over tab-bar */}
        <div className="shrink-0 px-4 pt-3 pb-4 border-t border-border bg-bg">
          <button
            onClick={submit}
            disabled={saving || !teamId}
            className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Opretter…' : 'Opret kamp'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-text2 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls  = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';
const selectCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green bg-bg';
