/**
 * HsImportGamesModal — two-step game import from Holdsport.
 * Step 1: pick date range
 * Step 2: review filtered activities, assign to app team, pick which to import
 */

import { useState, useRef } from 'react';
import { api } from '../lib/api';
import type { Team } from '../lib/types';

interface HsActivity {
  id: number;
  name?: string;
  starttime?: string;
  place?: string;
  event_type_id?: number;  // 1=Kamp, 2=Træning, 4=Stævne
  event_type?: string;
}

interface ActivityRow {
  act: HsActivity;
  selected: boolean;
  teamId: string;
  opponent: string;
  isHome: boolean;
  tag: string;
}

function parseLocalTime(ts?: string): { date: string; time: string | null } {
  if (!ts) return { date: '', time: null };
  const local = ts.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
  const [date, timePart] = local.split('T');
  const time = (!timePart || timePart.startsWith('00:00')) ? null : timePart.slice(0, 5);
  return { date, time };
}

function fmtDate(ts?: string): string {
  if (!ts) return '—';
  const { date, time } = parseLocalTime(ts);
  if (!date) return '—';
  const d = new Date(date + 'T12:00:00');
  const weekdays = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  const months   = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const wd = weekdays[d.getDay()];
  const dd = d.getDate();
  const mo = months[d.getMonth()];
  return `${wd} ${dd}. ${mo}${time ? ' · ' + time : ''}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(s: string, days: number) {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function teamMatches(titleSide: string, teamName: string): boolean {
  const t = titleSide.toLowerCase();
  const n = teamName.toLowerCase();
  if (n.includes(t) || t.includes(n)) return true;
  const words = t.split(/\s+/).filter(w => w.length > 1);
  return words.length > 0 && words.every(w => n.includes(w));
}

function guessOpponent(name: string, teamName: string): { opponent: string; isHome: boolean } {
  // Strip prefix before ": "
  const withoutPrefix = name.includes(': ') ? name.split(': ').slice(1).join(': ') : name;
  // Strip trailing parenthetical
  const clean = withoutPrefix.replace(/\s*\([^)]*\)\s*$/, '').trim();

  const dashIdx = clean.indexOf(' - ');
  if (dashIdx === -1) return { opponent: clean, isHome: true };

  const left  = clean.slice(0, dashIdx).trim();
  const right = clean.slice(dashIdx + 3).trim();

  if (teamMatches(left, teamName))  return { opponent: right, isHome: true };
  if (teamMatches(right, teamName)) return { opponent: left,  isHome: false };
  return { opponent: right, isHome: true };
}

export default function HsImportGamesModal({
  hsTeamId, teams, onImported, onClose,
}: {
  hsTeamId: string;
  teams: Team[];
  onImported: (count: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'range' | 'pick'>('range');
  const [from, setFrom] = useState(todayStr);
  const [to,   setTo]   = useState(() => addDays(todayStr(), 90));

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const [rows, setRows] = useState<ActivityRow[]>([]);

  // Tag autocomplete
  const [tagOptions,  setTagOptions]  = useState<string[]>([]);
  const [tagsFetched, setTagsFetched] = useState(false);
  const [openTagIdx,  setOpenTagIdx]  = useState<number | null>(null);
  const tagBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function ensureTags() {
    if (tagsFetched) return;
    try { const res = await api.get<string[]>('/games/tags'); setTagOptions(res); } catch { /* silent */ }
    setTagsFetched(true);
  }


  async function fetchActivities() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ preview: HsActivity[] } | HsActivity[]>(
        `/holdsport/activities/${hsTeamId}?per_page=100`
      );
      const all: HsActivity[] = Array.isArray(data) ? data : (data as { preview: HsActivity[] }).preview ?? [];

      // Sort teams by name length descending so "Ajax København 2" is checked before "Ajax København"
      const sortedTeams = [...teams].sort((a, b) => b.name.length - a.name.length);

      // Filter: event_type_id 1=Kamp, 4=Stævne — or fallback to title parsing for older data
      const filtered = all.filter(a => {
        if (!((a.name || '').includes(' - '))) return false;
        if (a.event_type_id !== undefined) return a.event_type_id === 1 || a.event_type_id === 4;
        // Fallback: require a team name in the title
        const n = (a.name || '').toLowerCase();
        return sortedTeams.some(t => n.includes(t.name.toLowerCase()));
      });

      // Also filter by date range
      const inRange = filtered.filter(a => {
        const { date } = parseLocalTime(a.starttime);
        return date >= from && date <= to;
      });

      // Build rows — guess team and opponent from name
      const newRows: ActivityRow[] = inRange.map(act => {
        const name = act.name || '';
        // Find which team matches — use sortedTeams (longest name first) to avoid substring false matches
        let matchedTeam = sortedTeams[0];
        for (const t of sortedTeams) {
          if (name.toLowerCase().includes(t.name.toLowerCase())) {
            matchedTeam = t;
            break;
          }
        }
        const { opponent, isHome } = guessOpponent(name, matchedTeam.name);
        return {
          act,
          selected: true,
          teamId: matchedTeam.id,
          opponent,
          isHome,
          tag: 'turnering',
        };
      });

      setRows(newRows);
      setStep('pick');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    const selected = rows.filter(r => r.selected && r.teamId && r.opponent.trim());
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const items = selected.map(r => {
        const { date, time } = parseLocalTime(r.act.starttime);
        return {
          hs_activity_id: String(r.act.id),
          team_id: r.teamId,
          opponent: r.opponent.trim(),
          is_home: r.isHome,
          location: r.act.place || null,
          date,
          time,
          tag: r.tag.trim() || 'turnering',
        };
      });
      const res = await api.post<{ imported: number; skipped: number }>('/holdsport/import-games', { items });
      onImported(res.imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fejl ved import');
      setSaving(false);
    }
  }

  function updateRow(idx: number, patch: Partial<ActivityRow>) {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  const selectedCount = rows.filter(r => r.selected).length;

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green bg-bg w-full';

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex flex-col justify-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg rounded-t-2xl flex flex-col"
        style={{ maxHeight: 'calc(95dvh)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <div>
            <p className="font-bold text-text1 text-base">
              {step === 'range' ? 'Importer kampe fra Holdsport' : `${rows.length} aktiviteter fundet`}
            </p>
            {step === 'pick' && rows.length > 0 && (
              <p className="text-xs text-text3">{selectedCount} valgt til import</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-bg2 text-text2 text-lg">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4">

          {/* ── Step 1: Date range ── */}
          {step === 'range' && (
            <div className="py-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text2 mb-1">Fra</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text2 mb-1">Til</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[{l:'1 måned', d:30},{l:'3 måneder', d:90},{l:'6 måneder', d:180}].map(({l,d}) => (
                  <button key={l} onClick={() => setTo(addDays(from, d))}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg2 text-text2 active:bg-border">
                    {l}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red">{error}</p>}
            </div>
          )}

          {/* ── Step 2: Activity picker ── */}
          {step === 'pick' && (
            <div className="py-3 flex flex-col gap-0">
              {rows.length === 0 && (
                <p className="text-sm text-text3 text-center py-8">
                  Ingen aktiviteter med holdnavne fundet i perioden
                </p>
              )}
              {rows.map((row, idx) => {
                const { date } = parseLocalTime(row.act.starttime);
                return (
                  <div key={row.act.id}
                    className={`py-3 border-b border-border ${!row.selected ? 'opacity-40' : ''}`}>
                    {/* Top row: checkbox + name + date */}
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => updateRow(idx, { selected: !row.selected })}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${row.selected ? 'bg-green border-green' : 'border-border bg-bg'}`}
                      >
                        {row.selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="1,6 5,10 11,2" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text1 truncate">{row.act.name}</p>
                        <p className="text-xs text-text3">{fmtDate(row.act.starttime)}{row.act.place ? ` · ${row.act.place}` : ''}</p>
                      </div>
                    </div>

                    {/* Edit fields when selected */}
                    {row.selected && (
                      <div className="mt-2 ml-8 flex flex-col gap-2">
                        {/* Team selector */}
                        {teams.length > 1 && (
                          <select value={row.teamId} onChange={e => updateRow(idx, { teamId: e.target.value })}
                            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-bg text-text1 focus:outline-none focus:ring-2 focus:ring-green">
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        {/* Opponent + home/away */}
                        <div className="flex gap-2">
                          <input
                            value={row.opponent}
                            onChange={e => updateRow(idx, { opponent: e.target.value })}
                            placeholder="Modstander"
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-bg focus:outline-none focus:ring-2 focus:ring-green"
                          />
                          <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
                            <button onClick={() => updateRow(idx, { isHome: true })}
                              className={`px-2 py-1.5 text-xs font-medium ${row.isHome ? 'bg-green text-white' : 'bg-bg text-text2'}`}>
                              Hjemme
                            </button>
                            <button onClick={() => updateRow(idx, { isHome: false })}
                              className={`px-2 py-1.5 text-xs font-medium ${!row.isHome ? 'bg-green text-white' : 'bg-bg text-text2'}`}>
                              Ude
                            </button>
                          </div>
                        </div>
                        {/* Tag */}
                        <div className="relative">
                          <input
                            value={row.tag}
                            onChange={e => { updateRow(idx, { tag: e.target.value }); setOpenTagIdx(idx); }}
                            onFocus={() => { ensureTags(); setOpenTagIdx(idx); }}
                            onBlur={() => { tagBlurRef.current = setTimeout(() => setOpenTagIdx(null), 150); }}
                            placeholder="Tag (fx turnering)"
                            className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-bg focus:outline-none focus:ring-2 focus:ring-green"
                          />
                          {openTagIdx === idx && tagOptions.length > 0 && (() => {
                            const filtered = tagOptions.filter(t => t.toLowerCase().includes(row.tag.toLowerCase()) && t !== row.tag);
                            const opts = row.tag ? filtered : tagOptions;
                            return opts.length > 0 ? (
                              <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-bg border border-border rounded-lg shadow-lg overflow-hidden">
                                {opts.map(t => (
                                  <li key={t}>
                                    <button type="button"
                                      onMouseDown={() => { updateRow(idx, { tag: t }); setOpenTagIdx(null); }}
                                      className="w-full text-left px-3 py-2 text-xs text-text1 hover:bg-bg2">
                                      {t}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null;
                          })()}
                        </div>
                        {/* Date info */}
                        <p className="text-[11px] text-text3">Dato: {date}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {error && <p className="text-xs text-red py-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0 flex gap-3">
          {step === 'range' ? (
            <>
              <button onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm text-text2">Annuller</button>
              <button onClick={fetchActivities} disabled={loading || !from || !to}
                className="flex-1 bg-green text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
                {loading ? 'Henter…' : 'Hent aktiviteter →'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('range'); setRows([]); setError(''); }}
                className="border border-border rounded-lg px-4 py-2.5 text-sm text-text2 shrink-0">
                ← Tilbage
              </button>
              <button onClick={doImport} disabled={saving || selectedCount === 0}
                className="flex-1 bg-green text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
                {saving ? 'Importerer…' : `Importer ${selectedCount > 0 ? selectedCount : ''} kamp${selectedCount !== 1 ? 'e' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
