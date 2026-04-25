import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { Team } from '../lib/types';

const COLORS = [
  { label: 'Grøn',   value: '#1D9E75' },
  { label: 'Blå',    value: '#185FA5' },
  { label: 'Lilla',  value: '#7F77DD' },
  { label: 'Rød',    value: '#A32D2D' },
  { label: 'Orange', value: '#D97706' },
  { label: 'Grå',    value: '#6B7280' },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [teams, setTeams]     = useState<Team[]>([]);
  const [season, setSeason]   = useState(() => {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  });
  const [webcalUrl, setWebcalUrl]   = useState('');
  const [webcalSaved, setWebcalSaved] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const [adding, setAdding]   = useState(false);

  const [newName,        setNewName]        = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor,       setNewColor]       = useState(COLORS[0].value);
  const [newHsId,        setNewHsId]        = useState('');

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    setWebcalUrl('');
    setWebcalSaved(false);
    api.get<{ webcal_url: string | null }>(`/seasons/${season}/config`)
      .then(r => setWebcalUrl(r.webcal_url ?? ''))
      .catch(() => {});
  }, [season]);

  async function saveWebcal() {
    setSaving('webcal');
    try {
      await api.put(`/seasons/${season}/config`, { webcal_url: webcalUrl.trim() || null });
      setWebcalSaved(true);
      setTimeout(() => setWebcalSaved(false), 2000);
    } finally {
      setSaving(null);
    }
  }

  const seasonTeams = teams.filter(t => t.season === season);
  const otherSeasons = [...new Set(teams.map(t => t.season).filter(s => s !== season))].sort().reverse();

  async function saveTeam(id: string, patch: Partial<Team>) {
    setSaving(id);
    try {
      await api.patch(`/teams/${id}`, patch);
      setTeams(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    } finally {
      setSaving(null);
    }
  }

  async function addTeam() {
    if (!newName.trim()) return;
    setSaving('new');
    try {
      const { id } = await api.post<{ id: string }>('/teams', {
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
        season,
        hs_team_id: newHsId.trim() || null,
      });
      setTeams(ts => [...ts, {
        id, name: newName.trim(), description: newDescription.trim() || null,
        color: newColor, season, hs_team_id: newHsId.trim() || null,
      }]);
      setNewName(''); setNewDescription(''); setNewColor(COLORS[0].value); setNewHsId('');
      setAdding(false);
    } finally {
      setSaving(null);
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm('Slet holdet?')) return;
    await api.delete(`/teams/${id}`);
    setTeams(ts => ts.filter(t => t.id !== id));
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h2 className="text-xl font-bold text-text1 mb-6">Indstillinger</h2>

      {/* Hold-sektion */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text1">Hold</h3>
          {/* Sæsonvælger */}
          <div className="flex items-center gap-2">
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              className="bg-bg2 rounded-lg px-2 py-1 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green"
            >
              <option value={season}>{season}</option>
              {otherSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              {/* Mulighed for ny sæson */}
              {!teams.some(t => t.season === nextSeason(season)) && (
                <option value={nextSeason(season)}>{nextSeason(season)} (ny)</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {seasonTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              saving={saving === team.id}
              onSave={patch => saveTeam(team.id, patch)}
              onDelete={() => deleteTeam(team.id)}
            />
          ))}

          {seasonTeams.length === 0 && !adding && (
            <p className="text-text3 text-sm text-center py-4">Ingen hold for {season}</p>
          )}

          {/* Nyt hold formular */}
          {adding ? (
            <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-text1">Nyt hold — {season}</p>
              <input
                placeholder="Navn (samme som i Holdsport)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
              />
              <input
                placeholder="Beskrivelse (valgfri)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
              />
              <input
                placeholder="Holdsport ID (valgfri)"
                value={newHsId}
                onChange={e => setNewHsId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
              />
              <div>
                <p className="text-xs text-text2 mb-1.5">Farve</p>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setNewColor(c.value)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c.value,
                        borderColor: newColor === c.value ? '#1a1a1a' : 'transparent',
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAdding(false); setNewName(''); setNewDescription(''); setNewHsId(''); }}
                  className="flex-1 border border-border rounded-lg py-2 text-sm text-text2"
                >
                  Annuller
                </button>
                <button
                  onClick={addTeam}
                  disabled={!newName.trim() || saving === 'new'}
                  className="flex-1 bg-green text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {saving === 'new' ? 'Gemmer…' : 'Opret hold'}
                </button>
              </div>
            </div>
          ) : seasonTeams.length < 3 && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-4 text-sm text-text3 active:bg-bg2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tilføj hold
            </button>
          )}
        </div>
      </section>

      {/* Webcal */}
      <section className="mb-8">
        <h3 className="text-base font-semibold text-text1 mb-3">Kalender — {season}</h3>
        <p className="text-xs text-text2 mb-2">Webcal-link med kampe for alle hold i sæsonen</p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="webcal://…"
            value={webcalUrl}
            onChange={e => { setWebcalUrl(e.target.value); setWebcalSaved(false); }}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green min-w-0"
          />
          <button
            onClick={saveWebcal}
            disabled={saving === 'webcal'}
            className="shrink-0 bg-green text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {webcalSaved ? '✓' : saving === 'webcal' ? '…' : 'Gem'}
          </button>
        </div>
      </section>

      {/* Bruger */}
      <section className="border-t border-border pt-6">
        {user && (
          <p className="text-text2 text-sm mb-4">Logget ind som <strong className="text-text1">{user.name}</strong></p>
        )}
        <button
          onClick={logout}
          className="w-full border border-red text-red rounded-lg py-3 text-sm font-semibold"
        >
          Log ud
        </button>
      </section>
    </div>
  );
}

function TeamCard({ team, saving, onSave, onDelete }: {
  team: Team;
  saving: boolean;
  onSave: (patch: Partial<Team>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name,        setName]        = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [color,       setColor]       = useState(team.color);
  const [hsId,        setHsId]        = useState(team.hs_team_id ?? '');

  function save() {
    onSave({
      name: name.trim() || team.name,
      description: description.trim() || null,
      color,
      hs_team_id: hsId.trim() || null,
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="bg-bg border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
            <div>
              <p className="font-semibold text-text1 text-sm">{team.name}</p>
              {team.description && <p className="text-xs text-text2">{team.description}</p>}
              {team.hs_team_id && <p className="text-xs text-text3">HS: {team.hs_team_id}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs text-blue px-2 py-1 rounded-lg bg-blue-light">
              Rediger
            </button>
            <button onClick={onDelete} className="text-xs text-red px-2 py-1 rounded-lg bg-bg2">
              Slet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg border border-green rounded-xl p-4 flex flex-col gap-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Navn"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
      />
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Beskrivelse (valgfri)"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
      />
      <input
        value={hsId}
        onChange={e => setHsId(e.target.value)}
        placeholder="Holdsport ID (valgfri)"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
      />
      <div>
        <p className="text-xs text-text2 mb-1.5">Farve</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{ backgroundColor: c.value, borderColor: color === c.value ? '#1a1a1a' : 'transparent' }}
              title={c.label}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(false)} className="flex-1 border border-border rounded-lg py-2 text-sm text-text2">
          Annuller
        </button>
        <button onClick={save} disabled={saving} className="flex-1 bg-green text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Gemmer…' : 'Gem'}
        </button>
      </div>
    </div>
  );
}

function nextSeason(current: string): string {
  const year = parseInt(current.split('/')[0]) + 1;
  return `${year}/${String(year + 1).slice(2)}`;
}
