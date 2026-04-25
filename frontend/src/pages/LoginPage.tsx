import { useState, FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; email: string; name: string; role: 'admin' | 'coach' } }>(
        '/auth/login', { email, password }
      );
      login(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl ved login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green mb-1">Gameday</h1>
        <p className="text-text2 text-sm mb-8">Ajax U11 holdstyringsapp</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text1 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-text1 bg-bg focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text1 mb-1">Adgangskode</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-text1 bg-bg focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  );
}
