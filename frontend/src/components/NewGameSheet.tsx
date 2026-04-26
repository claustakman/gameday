import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Team } from '../lib/types';

interface Props {
  teams: Team[];
  onCreated: (gameId: string) => void;
  onClose: () => void;
}

export default function NewGameSheet({ teams, onCreated, onClose }: Props) {
  const currentSeason = (() => {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  })();

  const seasons = [...new Set(teams.map(t => t.season))].sort().reverse();
  const [season, setSeason]       = useState(seasons[0] ?? currentSeason);
  const seasonTeams               = teams.filter(t => t.season === season);

  const [teamId,     setTeamId]     = useState('');
  const [date,       setDate]       = useState('');
  const [time,       setTime]       = useState('');
  const [meetupTime, setMeetupTime] = useState('');
  const [opponent,   setOpponent]   = useState('');
  const [location,   setLocation]   = useState('');
  const [isHome,     setIsHome]     = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // Sæt første hold som default når sæson ændres
  useEffect(() => {
    setTeamId(seasonTeams[0]?.id ?? '');
  }, [season]);

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
      onCreated(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-4 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-text1">Ny kamp</h2>
            <button onClick={onClose} className="text-text3 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Sæson + hold */}
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

            {/* Modstander */}
            <Field label="Modstander">
              <input
                type="text"
                placeholder="Klubnavn"
                value={opponent}
                onChange={e => setOpponent(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Hjemme / ude */}
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

            {/* Dato */}
            <Field label="Dato">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Tidspunkter */}
            <div className="flex gap-3">
              <Field label="Kampstart" className="flex-1">
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Mødetid" className="flex-1">
                <input
                  type="time"
                  value={meetupTime}
                  onChange={e => setMeetupTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Lokation */}
            <Field label="Lokation (valgfri)">
              <input
                type="text"
                placeholder="Bane, adresse…"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputCls}
              />
            </Field>

            {error && <p className="text-red text-sm">{error}</p>}

            <button
              onClick={submit}
              disabled={saving || !teamId}
              className="w-full bg-green text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50 mt-1"
            >
              {saving ? 'Opretter…' : 'Opret kamp'}
            </button>
          </div>
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
