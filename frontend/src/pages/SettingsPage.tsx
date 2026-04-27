import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { Team, Coach } from '../lib/types';

const COLORS = [
  { label: 'Grøn',   value: '#1D9E75' },
  { label: 'Blå',    value: '#185FA5' },
  { label: 'Lilla',  value: '#7F77DD' },
  { label: 'Rød',    value: '#A32D2D' },
  { label: 'Orange', value: '#D97706' },
  { label: 'Grå',    value: '#6B7280' },
];

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'coach';
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [teams, setTeams]   = useState<Team[]>([]);
  const [season, setSeason] = useState(() => {
    const y = new Date().getFullYear();
    return `${y}/${String(y + 1).slice(2)}`;
  });
  const [webcalUrl,   setWebcalUrl]   = useState('');
  const [webcalSaved, setWebcalSaved] = useState(false);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [adding,      setAdding]      = useState(false);

  const [newName,        setNewName]        = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor,       setNewColor]       = useState(COLORS[0].value);
  const [newHsId,        setNewHsId]        = useState('');

  // Trænere
  const [coaches,       setCoaches]       = useState<Coach[]>([]);
  const [newCoachName,  setNewCoachName]  = useState('');
  const [newCoachHsId,  setNewCoachHsId]  = useState('');
  const [addingCoach,   setAddingCoach]   = useState(false);
  const [coachSaving,   setCoachSaving]   = useState(false);

  // Brugere (admin)
  const [orgUsers,     setOrgUsers]     = useState<OrgUser[]>([]);
  const [usersLoaded,  setUsersLoaded]  = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName,  setNewUserName]  = useState('');
  const [newUserRole,  setNewUserRole]  = useState<'coach' | 'admin'>('coach');
  const [addingUser,   setAddingUser]   = useState(false);
  const [userSaving,   setUserSaving]   = useState(false);
  const [inviteLink,   setInviteLink]   = useState<{ userId: string; url: string } | null>(null);

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {});
    api.get<Coach[]>('/coaches').then(setCoaches).catch(() => {});
  }, []);

  useEffect(() => {
    setWebcalUrl('');
    setWebcalSaved(false);
    api.get<{ webcal_url: string | null }>(`/seasons/${season}/config`)
      .then(r => setWebcalUrl(r.webcal_url ?? ''))
      .catch(() => {});
  }, [season]);

  useEffect(() => {
    if (!isAdmin || usersLoaded) return;
    api.get<OrgUser[]>('/users').then(u => { setOrgUsers(u); setUsersLoaded(true); }).catch(() => {});
  }, [isAdmin]);

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

  async function addUser() {
    if (!newUserEmail.trim() || !newUserName.trim()) return;
    setUserSaving(true);
    try {
      const created = await api.post<OrgUser>('/users', {
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        role: newUserRole,
      });
      setOrgUsers(u => [...u, created]);
      setNewUserEmail(''); setNewUserName(''); setNewUserRole('coach');
      setAddingUser(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fejl');
    } finally {
      setUserSaving(false);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Slet brugeren?')) return;
    await api.delete(`/users/${id}`);
    setOrgUsers(u => u.filter(x => x.id !== id));
    if (inviteLink?.userId === id) setInviteLink(null);
  }

  async function addCoach() {
    if (!newCoachName.trim()) return;
    setCoachSaving(true);
    try {
      const { id } = await api.post<{ id: string }>('/coaches', { name: newCoachName.trim() });
      if (newCoachHsId.trim()) {
        await api.patch(`/coaches/${id}`, { hs_user_id: newCoachHsId.trim() }).catch(() => {});
      }
      setCoaches(cs => [...cs, { id, org_id: '', name: newCoachName.trim(), hs_user_id: newCoachHsId.trim() || null }]);
      setNewCoachName(''); setNewCoachHsId(''); setAddingCoach(false);
    } finally {
      setCoachSaving(false);
    }
  }

  async function deleteCoach(id: string) {
    if (!confirm('Slet træneren?')) return;
    await api.delete(`/coaches/${id}`);
    setCoaches(cs => cs.filter(c => c.id !== id));
  }

  async function generateInvite(userId: string) {
    const { token } = await api.post<{ token: string }>(`/users/${userId}/invite`, {});
    const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
    setInviteLink({ userId, url: `${base}/invite/${token}` });
  }

  const seasonTeams  = teams.filter(t => t.season === season);
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

  async function deleteTeam(id: string) {
    if (!confirm('Slet holdet?')) return;
    await api.delete(`/teams/${id}`);
    setTeams(ts => ts.filter(t => t.id !== id));
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

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  return (
    <div className="px-4 pt-6 pb-8">
      <h2 className="text-xl font-bold text-text1 mb-6">Indstillinger</h2>

      {/* ── Hold ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text1">Hold</h3>
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="bg-bg2 rounded-lg px-2 py-1 text-sm text-text1 focus:outline-none focus:ring-2 focus:ring-green"
          >
            <option value={season}>{season}</option>
            {otherSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            {!teams.some(t => t.season === nextSeason(season)) && (
              <option value={nextSeason(season)}>{nextSeason(season)} (ny)</option>
            )}
          </select>
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

          {adding ? (
            <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-text1">Nyt hold — {season}</p>
              <input placeholder="Navn" value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} />
              <input placeholder="Beskrivelse (valgfri)" value={newDescription} onChange={e => setNewDescription(e.target.value)} className={inputCls} />
              <input placeholder="Holdsport ID (valgfri)" value={newHsId} onChange={e => setNewHsId(e.target.value)} className={inputCls} />
              <div>
                <p className="text-xs text-text2 mb-1.5">Farve</p>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setNewColor(c.value)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c.value, borderColor: newColor === c.value ? '#1a1a1a' : 'transparent' }}
                      title={c.label} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); setNewName(''); setNewDescription(''); setNewHsId(''); }}
                  className="flex-1 border border-border rounded-lg py-2 text-sm text-text2">Annuller</button>
                <button onClick={addTeam} disabled={!newName.trim() || saving === 'new'}
                  className="flex-1 bg-green text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                  {saving === 'new' ? 'Gemmer…' : 'Opret hold'}
                </button>
              </div>
            </div>
          ) : seasonTeams.length < 3 && (
            <button onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-4 text-sm text-text3 active:bg-bg2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tilføj hold
            </button>
          )}
        </div>
      </section>

      {/* ── Webcal ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h3 className="text-base font-semibold text-text1 mb-3">Kalender — {season}</h3>
        <p className="text-xs text-text2 mb-2">Webcal-link med kampe for alle hold i sæsonen</p>
        <div className="flex gap-2">
          <input type="url" placeholder="webcal://…" value={webcalUrl}
            onChange={e => { setWebcalUrl(e.target.value); setWebcalSaved(false); }}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green min-w-0 bg-bg" />
          <button onClick={saveWebcal} disabled={saving === 'webcal'}
            className="shrink-0 bg-green text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {webcalSaved ? '✓' : saving === 'webcal' ? '…' : 'Gem'}
          </button>
        </div>
      </section>

      {/* ── Trænere ────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text1">Trænere</h3>
          {!addingCoach && (
            <button onClick={() => setAddingCoach(true)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ny træner
            </button>
          )}
        </div>

        {addingCoach && (
          <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-3 mb-3">
            <p className="text-sm font-semibold text-text1">Ny træner</p>
            <input placeholder="Navn" value={newCoachName} onChange={e => setNewCoachName(e.target.value)} className={inputCls} />
            <input placeholder="Holdsport bruger-ID (valgfri)" value={newCoachHsId} onChange={e => setNewCoachHsId(e.target.value)} className={inputCls} />
            <div className="flex gap-2">
              <button onClick={() => { setAddingCoach(false); setNewCoachName(''); setNewCoachHsId(''); }}
                className="flex-1 border border-border rounded-lg py-2 text-sm text-text2">Annuller</button>
              <button onClick={addCoach} disabled={coachSaving || !newCoachName.trim()}
                className="flex-1 bg-green text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                {coachSaving ? 'Gemmer…' : 'Opret'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {coaches.length === 0 && !addingCoach && (
            <p className="text-text3 text-sm text-center py-4">Ingen trænere endnu</p>
          )}
          {coaches.map(c => (
            <div key={c.id} className="bg-bg border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-bg2 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-text2">{c.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text1 truncate">{c.name}</p>
                {c.hs_user_id && <p className="text-xs text-text3">HS: {c.hs_user_id}</p>}
              </div>
              <button onClick={() => deleteCoach(c.id)} className="text-xs text-red px-2 py-1 rounded-lg bg-bg2 shrink-0">Slet</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Holdsport ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-text1">Holdsport</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg2 text-text3 uppercase tracking-wide">Kommer snart</span>
        </div>
        <p className="text-xs text-text2 mb-4">Synkronisér kampe og spillere direkte fra Holdsport</p>
        <div className="flex flex-col gap-2">
          <button disabled
            className="w-full flex items-center gap-3 bg-bg border border-border rounded-xl px-4 py-3.5 opacity-40 cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text2 shrink-0"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <div className="text-left">
              <p className="text-sm font-semibold text-text1">Synkronisér kampe</p>
              <p className="text-xs text-text3">Hent kampprogram fra Holdsport</p>
            </div>
          </button>
          <button disabled
            className="w-full flex items-center gap-3 bg-bg border border-border rounded-xl px-4 py-3.5 opacity-40 cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text2 shrink-0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div className="text-left">
              <p className="text-sm font-semibold text-text1">Synkronisér spillere</p>
              <p className="text-xs text-text3">Importér spillerliste fra Holdsport</p>
            </div>
          </button>
        </div>
      </section>

      {/* ── Brugere (kun admin) ────────────────────────────────────── */}
      {isAdmin && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-text1">Brugere</h3>
            {!addingUser && (
              <button onClick={() => setAddingUser(true)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Ny bruger
              </button>
            )}
          </div>

          {addingUser && (
            <div className="bg-bg border border-border rounded-xl p-4 flex flex-col gap-3 mb-3">
              <p className="text-sm font-semibold text-text1">Ny bruger</p>
              <input placeholder="Navn" value={newUserName} onChange={e => setNewUserName(e.target.value)} className={inputCls} />
              <input placeholder="Email" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className={inputCls} />
              <div>
                <label className="block text-xs font-medium text-text2 mb-1.5">Rolle</label>
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button onClick={() => setNewUserRole('coach')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${newUserRole === 'coach' ? 'bg-green text-white' : 'bg-bg text-text2'}`}>Træner</button>
                  <button onClick={() => setNewUserRole('admin')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${newUserRole === 'admin' ? 'bg-green text-white' : 'bg-bg text-text2'}`}>Admin</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setAddingUser(false); setNewUserEmail(''); setNewUserName(''); setNewUserRole('coach'); }}
                  className="flex-1 border border-border rounded-lg py-2 text-sm text-text2">Annuller</button>
                <button onClick={addUser} disabled={userSaving || !newUserEmail.trim() || !newUserName.trim()}
                  className="flex-1 bg-green text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                  {userSaving ? 'Gemmer…' : 'Opret'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {orgUsers.map(u => (
              <div key={u.id} className="bg-bg border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-text1 text-sm">{u.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-green text-white' : 'bg-bg2 text-text2'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Træner'}
                      </span>
                      {u.id === user?.id && <span className="text-[10px] text-text3">(dig)</span>}
                    </div>
                    <p className="text-xs text-text3 truncate">{u.email}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => generateInvite(u.id)}
                      className="text-xs font-semibold px-2 py-1 rounded-lg bg-bg2 text-text2" title="Generer invitationslink">🔗</button>
                    {u.id !== user?.id && (
                      <button onClick={() => deleteUser(u.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-bg2 text-red">Slet</button>
                    )}
                  </div>
                </div>
                {inviteLink?.userId === u.id && (
                  <div className="mt-3 bg-bg2 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-text2 mb-1">Invitationslink (gyldigt 7 dage)</p>
                    <div className="flex gap-2">
                      <p className="text-[11px] text-text3 flex-1 break-all">{inviteLink.url}</p>
                      <button onClick={() => navigator.clipboard.writeText(inviteLink.url)}
                        className="shrink-0 text-xs font-semibold text-green">Kopiér</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── TeamCard ────────────────────────────────────────────────────── */
function TeamCard({ team, saving, onSave, onDelete }: {
  team: Team; saving: boolean;
  onSave: (patch: Partial<Team>) => void; onDelete: () => void;
}) {
  const [editing,     setEditing]     = useState(false);
  const [name,        setName]        = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [color,       setColor]       = useState(team.color);
  const [hsId,        setHsId]        = useState(team.hs_team_id ?? '');

  function save() {
    onSave({ name: name.trim() || team.name, description: description.trim() || null, color, hs_team_id: hsId.trim() || null });
    setEditing(false);
  }

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green bg-bg';

  if (!editing) return (
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
          <button onClick={() => setEditing(true)} className="text-xs text-blue px-2 py-1 rounded-lg bg-blue-light">Rediger</button>
          <button onClick={onDelete} className="text-xs text-red px-2 py-1 rounded-lg bg-bg2">Slet</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-bg border border-green rounded-xl p-4 flex flex-col gap-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Navn" className={inputCls} />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Beskrivelse (valgfri)" className={inputCls} />
      <input value={hsId} onChange={e => setHsId(e.target.value)} placeholder="Holdsport ID (valgfri)" className={inputCls} />
      <div>
        <p className="text-xs text-text2 mb-1.5">Farve</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c.value} onClick={() => setColor(c.value)}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{ backgroundColor: c.value, borderColor: color === c.value ? '#1a1a1a' : 'transparent' }}
              title={c.label} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(false)} className="flex-1 border border-border rounded-lg py-2 text-sm text-text2">Annuller</button>
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
